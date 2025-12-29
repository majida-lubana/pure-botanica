const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: false
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  regularPrice: {
    type: Number,
    required: true
  },
  salePrice: {
    type: Number,
    required: true
  },
  productOffer: {
    type: Number,
    default: 0,
    min: [0, 'Offer cannot be negative'],
    max: [100, 'Offer cannot exceed 100%']
  },
  quantity: {
    type: Number,
    required:true,
    default:1,
    min: [0, 'Quantity cannot be negative']
  },
  skinType: {
    type: String,
    required: true,
    enum: ['Oily', 'Dry', 'Combination', 'Sensitive', 'Normal', 'All Skin Types']
  },
  skinConcern: {
    type: String,
    required: true,
    enum: ['Acne', 'Dryness', 'Oiliness', 'Aging', 'Pigmentation', 'Sensitivity']
  },
  ingredients: {
    type: [String],
    default: []
  },
  howToUse: {
    type: String
  },
  warnings: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  productImages: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ["Available", "Out Of Stock", "Inactive", "Deleted"],
    default: "Available",
    required: true
  },
  review: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });


productSchema.virtual('finalPrice').get(function () {
  const offerPrice = this.regularPrice - (this.regularPrice * (this.productOffer || 0) / 100);
  return Math.min(this.regularPrice, this.salePrice || this.regularPrice, offerPrice).toFixed(2);
});


productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });
// =========================

const Product = mongoose.model("Product", productSchema);
module.exports = Product;