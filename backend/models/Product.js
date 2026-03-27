const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['Components', 'Consumer Electronics', 'Spare Parts', 'Accessories', 'Other'],
    required: true
  },
  description: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  minThreshold: { type: Number, required: true, default: 10 },
  price: { type: Number, required: true, min: 0 },
  supplier: { type: String, trim: true },
  location: { type: String, trim: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.virtual('isLowStock').get(function () {
  return this.quantity < this.minThreshold;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
