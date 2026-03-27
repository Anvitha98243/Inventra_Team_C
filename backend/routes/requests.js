const express = require('express');
const router = express.Router();
const StockRequest = require('../models/StockRequest');
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const { auth, adminOnly } = require('../middleware/auth');

// Staff: create a request
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'staff') return res.status(403).json({ message: 'Only staff can create requests' });
    const { productId, adminId, type, quantity, reason } = req.body;
    if (!productId || !adminId || !type || !quantity) {
      return res.status(400).json({ message: 'productId, adminId, type and quantity are required' });
    }
    if (!['stock-in', 'stock-out'].includes(type)) {
      return res.status(400).json({ message: 'Type must be stock-in or stock-out' });
    }
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const request = new StockRequest({
      product: productId,
      staff: req.user._id,
      admin: adminId,
      type,
      quantity,
      reason
    });
    await request.save();

    await AuditLog.create({
      action: 'STOCK_REQUEST_CREATED',
      performedBy: req.user._id,
      targetModel: 'StockRequest',
      targetId: request._id,
      details: { type, quantity, productId, reason }
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Staff: get own requests
router.get('/my', auth, async (req, res) => {
  try {
    const requests = await StockRequest.find({ staff: req.user._id })
      .populate('product', 'name sku category')
      .populate('admin', 'username')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: get all requests for this admin
router.get('/admin', auth, adminOnly, async (req, res) => {
  try {
    const requests = await StockRequest.find({ admin: req.user._id })
      .populate('product', 'name sku category quantity')
      .populate('staff', 'username email')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: approve or reject
router.put('/:id/resolve', auth, adminOnly, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const request = await StockRequest.findOne({ _id: req.params.id, admin: req.user._id });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already resolved' });
    }

    request.status = status;
    request.adminNote = adminNote || '';
    request.resolvedAt = new Date();
    await request.save();

    if (status === 'approved') {
      const product = await Product.findById(request.product);
      if (!product) return res.status(404).json({ message: 'Product not found' });

      if (request.type === 'stock-in') {
        product.quantity += request.quantity;
      } else {
        if (product.quantity < request.quantity) {
          return res.status(400).json({ message: 'Insufficient stock to fulfill stock-out request' });
        }
        product.quantity -= request.quantity;
      }
      product.updatedAt = new Date();
      await product.save();

      await AuditLog.create({
        action: 'STOCK_REQUEST_APPROVED',
        performedBy: req.user._id,
        targetModel: 'StockRequest',
        targetId: request._id,
        details: {
          type: request.type,
          quantity: request.quantity,
          productId: request.product,
          newQuantity: product.quantity
        }
      });
    } else {
      await AuditLog.create({
        action: 'STOCK_REQUEST_REJECTED',
        performedBy: req.user._id,
        targetModel: 'StockRequest',
        targetId: request._id,
        details: { type: request.type, quantity: request.quantity, adminNote }
      });
    }

    const populated = await StockRequest.findById(request._id)
      .populate('product', 'name sku category quantity')
      .populate('staff', 'username email');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
