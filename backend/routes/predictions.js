const express = require('express');
const router = express.Router();
const StockRequest = require('../models/StockRequest');
const Product = require('../models/Product');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/predictions  — admin sees predictions for all their products
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const products = await Product.find({ admin: req.user._id });

    // Fetch last 90 days of approved requests for this admin's products
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const requests = await StockRequest.find({
      admin: req.user._id,
      status: 'approved',
      resolvedAt: { $gte: since }
    }).populate('product', 'name sku category');

    const predictions = products.map(product => {
      const pid = product._id.toString();

      // All approved transactions for this product, sorted oldest → newest
      const txns = requests
        .filter(r => r.product && r.product._id.toString() === pid)
        .sort((a, b) => new Date(a.resolvedAt) - new Date(b.resolvedAt));

      const outTxns = txns.filter(r => r.type === 'stock-out');
      const inTxns  = txns.filter(r => r.type === 'stock-in');

      const totalOut = outTxns.reduce((s, r) => s + r.quantity, 0);
      const totalIn  = inTxns.reduce((s, r) => s + r.quantity, 0);

      // ── Demand trend ──────────────────────────────────────────────
      // Split the 90-day window into three equal 30-day buckets
      // and compare demand (stock-out qty) across them.
      const now = Date.now();
      const buckets = [0, 0, 0]; // oldest → newest
      outTxns.forEach(r => {
        const daysAgo = (now - new Date(r.resolvedAt).getTime()) / 86400000;
        if (daysAgo <= 30)       buckets[2] += r.quantity;
        else if (daysAgo <= 60)  buckets[1] += r.quantity;
        else                     buckets[0] += r.quantity;
      });

      let trend = 'stable';
      let trendDetail = '';
      const [old30, mid30, new30] = buckets;

      if (outTxns.length === 0) {
        trend = 'no-data';
        trendDetail = 'No stock-out transactions recorded yet.';
      } else if (new30 > mid30 * 1.25 || (mid30 === 0 && new30 > 0)) {
        trend = 'increasing';
        trendDetail = `Demand rose from ${mid30} → ${new30} units in the last 30 days.`;
      } else if (new30 < mid30 * 0.75 && mid30 > 0) {
        trend = 'decreasing';
        trendDetail = `Demand dropped from ${mid30} → ${new30} units in the last 30 days.`;
      } else {
        trend = 'stable';
        trendDetail = `Consistent demand around ${Math.round((old30 + mid30 + new30) / 3)} units per 30 days.`;
      }

      // ── Avg daily consumption (stock-out rate) ────────────────────
      // Only use the last 30 days for a more relevant rate
      const recentOut = outTxns.filter(r => {
        const daysAgo = (now - new Date(r.resolvedAt).getTime()) / 86400000;
        return daysAgo <= 30;
      }).reduce((s, r) => s + r.quantity, 0);

      // Use 30-day window; fall back to full 90-day avg if no recent data
      const avgDailyConsumption = recentOut > 0
        ? recentOut / 30
        : totalOut > 0 ? totalOut / 90 : 0;

      // ── Recommended reorder date ──────────────────────────────────
      // Lead time assumption: 7 days. Safety buffer: 1.5× minThreshold.
      const LEAD_TIME_DAYS = 7;
      const safetyStock = product.minThreshold;
      let reorderDate = null;
      let reorderDaysFromNow = null;
      let reorderNote = '';
      let stockoutDate = null;
      let daysUntilStockout = null;

      if (avgDailyConsumption > 0) {
        // Days until stock hits safety buffer
        daysUntilStockout = Math.max(0, Math.floor(
          (product.quantity - safetyStock) / avgDailyConsumption
        ));
        stockoutDate = new Date(now + daysUntilStockout * 86400000);

        // Reorder should be placed LEAD_TIME_DAYS before reaching safety stock
        reorderDaysFromNow = Math.max(0, daysUntilStockout - LEAD_TIME_DAYS);
        reorderDate = new Date(now + reorderDaysFromNow * 86400000);

        if (reorderDaysFromNow === 0) {
          reorderNote = 'Reorder now — stock will hit safety level before next delivery.';
        } else if (reorderDaysFromNow <= 3) {
          reorderNote = `Reorder within ${reorderDaysFromNow} day(s) to avoid stockout.`;
        } else {
          reorderNote = `Place order by ${reorderDate.toDateString()} to maintain safe stock.`;
        }
      } else if (product.quantity < product.minThreshold) {
        reorderNote = 'Currently below minimum threshold. Reorder recommended immediately.';
        reorderDaysFromNow = 0;
        reorderDate = new Date(now);
      } else {
        reorderNote = 'No consumption recorded — monitor and reorder when needed.';
      }

      // ── Suggested reorder quantity ────────────────────────────────
      // Aim to cover 30 days of demand + safety stock
      const suggestedQty = avgDailyConsumption > 0
        ? Math.ceil(avgDailyConsumption * 30 + safetyStock - product.quantity)
        : product.minThreshold * 2;
      const finalSuggestedQty = Math.max(0, suggestedQty);

      return {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        currentStock: product.quantity,
        minThreshold: product.minThreshold,
        price: product.price,
        // transaction summary
        totalStockOut: totalOut,
        totalStockIn: totalIn,
        transactionCount: txns.length,
        avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
        // trend
        trend,
        trendDetail,
        demandLast30Days: new30,
        demandPrev30Days: mid30,
        // reorder
        reorderDate: reorderDate ? reorderDate.toISOString() : null,
        reorderDaysFromNow,
        reorderNote,
        suggestedQty: finalSuggestedQty,
        // stockout
        stockoutDate: stockoutDate ? stockoutDate.toISOString() : null,
        daysUntilStockout,
      };
    });

    // Sort: products needing attention first (lowest reorderDaysFromNow)
    predictions.sort((a, b) => {
      const aD = a.reorderDaysFromNow ?? 9999;
      const bD = b.reorderDaysFromNow ?? 9999;
      return aD - bD;
    });

    res.json(predictions);
  } catch (err) {
    console.error('Predictions error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
