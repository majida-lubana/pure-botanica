const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  couponCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    set: v => v.toUpperCase()          // <-- force uppercase
  },
  startDate: {
    type: Date,
    required: true
  },
  expireOn: {
    type: Date,
    required: true
  },
  offerPrice: {
    type: Number,
    required: true,
    min: 0
  },
  minimumPrice: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  usageLimit: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  isListed: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed'
  },
  createdOn: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for better query performance
couponSchema.index({ couponCode: 1 });
couponSchema.index({ isListed: 1, startDate: 1, expireOn: 1 });

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;