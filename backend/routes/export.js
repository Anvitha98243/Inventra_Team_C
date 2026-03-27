const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockRequest = require('../models/StockRequest');
const AuditLog = require('../models/AuditLog');
const { auth, adminOnly } = require('../middleware/auth');

// Export products data as JSON (frontend will generate PDF/Excel)
router.get('/products', auth, adminOnly, async (req, res) => {
  try {
    const products = await Product.find({ admin: req.user._id }).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Export transactions
router.get('/transactions', auth, adminOnly, async (req, res) => {
  try {
    const requests = await StockRequest.find({ admin: req.user._id })
      .populate('product', 'name sku category')
      .populate('staff', 'username')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Export audit logs
router.get('/audit', auth, adminOnly, async (req, res) => {
  try {
    const logs = await AuditLog.find({ performedBy: req.user._id })
      .populate('performedBy', 'username role')
      .sort({ createdAt: -1 })
      .limit(1000);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
