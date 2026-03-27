const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const { auth, adminOnly } = require('../middleware/auth');

// Get all products for logged-in admin
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const products = await Product.find({ admin: req.user._id }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get products by admin ID (for staff viewing)
router.get('/by-admin/:adminId', auth, async (req, res) => {
  try {
    const products = await Product.find({ admin: req.params.adminId }).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get low stock alerts
router.get('/alerts', auth, adminOnly, async (req, res) => {
  try {
    const products = await Product.find({ admin: req.user._id });
    const lowStock = products.filter(p => p.quantity < p.minThreshold);
    res.json(lowStock);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single product
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create product
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, sku, category, description, quantity, minThreshold, price, supplier, location } = req.body;
    if (!name || !sku || !category || price === undefined || price === '') {
      return res.status(400).json({ message: 'Name, SKU, category, and price are required' });
    }
    const existing = await Product.findOne({ sku, admin: req.user._id });
    if (existing) return res.status(400).json({ message: 'SKU already exists for this admin' });

    const product = new Product({
      name, sku, category, description,
      quantity: quantity || 0,
      minThreshold: minThreshold || 10,
      price, supplier, location,
      admin: req.user._id
    });
    await product.save();

    await AuditLog.create({
      action: 'PRODUCT_CREATED',
      performedBy: req.user._id,
      targetModel: 'Product',
      targetId: product._id,
      details: { name, sku, category, quantity: product.quantity, price }
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update product
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, admin: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const before = { quantity: product.quantity, price: product.price, name: product.name };
    const fields = ['name', 'sku', 'category', 'description', 'quantity', 'minThreshold', 'price', 'supplier', 'location'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) product[f] = req.body[f];
    });
    product.updatedAt = new Date();
    await product.save();

    await AuditLog.create({
      action: 'PRODUCT_UPDATED',
      performedBy: req.user._id,
      targetModel: 'Product',
      targetId: product._id,
      details: { before, after: { quantity: product.quantity, price: product.price, name: product.name } }
    });

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete product
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, admin: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    await AuditLog.create({
      action: 'PRODUCT_DELETED',
      performedBy: req.user._id,
      targetModel: 'Product',
      targetId: product._id,
      details: { name: product.name, sku: product.sku }
    });

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
