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
    default: 0
  },
  quantity: {
    type: Number,
     min:[0,'Quantity cannot be negative']
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

const Product = mongoose.model("Product", productSchema);
module.exports = Product;