const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    default: ''
  },
  skinConcern: {
    type: [String],
    default: []
  },
  suitableForSkinType: {
    type: [String],
    enum: ['Oily', 'Dry', 'Combination', 'Sensitive', 'Normal', 'All Skin Types'],
    default: []
  },
  image: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isListed: {
    type: Boolean,
    default: true
  },
  categoryOffer: {
    type: Number,
    default: 0
  },
  offerActive: {
    type: Boolean,
    default: false
  },
  offerStart: {
    type: Date
  },
  offerEnd: {
    type: Date
  }
}, { timestamps: true });

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;