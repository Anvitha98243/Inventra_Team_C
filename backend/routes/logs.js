const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { auth, adminOnly } = require('../middleware/auth');

// Admin: get audit logs for their scope
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const logs = await AuditLog.find({
      $or: [
        { performedBy: req.user._id },
        { 'details.adminId': req.user._id.toString() }
      ]
    })
      .populate('performedBy', 'username role')
      .sort({ createdAt: -1 })
      .limit(500);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: get transaction logs (stock in/out)
router.get('/transactions', auth, adminOnly, async (req, res) => {
  try {
    const logs = await AuditLog.find({
      performedBy: req.user._id,
      action: { $in: ['STOCK_REQUEST_APPROVED', 'STOCK_REQUEST_REJECTED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED'] }
    })
      .populate('performedBy', 'username role')
      .sort({ createdAt: -1 })
      .limit(500);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
