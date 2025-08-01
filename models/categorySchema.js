const mongoose = require('mongoose');
const {Schema} = mongoose;


const categorySchema = new mongoose.Schema({
    categoryName: {
    type: String,
    required: true,
    unique: true,
    trim: true // removes extra space
  },
  description: {
    type: String,
    default: ''
  },
  skinConcern: {
    type: [String], // e.g., ['Acne', 'Dryness']
    default: []
  },
  suitableForSkinType: {
    type: [String],
    enum: ['Oily', 'Dry', 'Combination', 'Sensitive', 'Normal'],
    default: []
  },
  image: {
    type: String, // for category display banner/image
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isListed:{
    type:Boolean,
    default:true
  },
   categoryOffer: {
    type: Number, // % discount
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
},{timestamps:true})


const Category = mongoose.model("Category",categorySchema);
module.exports = Category;