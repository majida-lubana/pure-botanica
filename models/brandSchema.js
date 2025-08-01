const mongoose = require('mongoose');
const {Schema} = mongoose;

const brandSchema = new mongoose.Schema({
    brandName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  image: {
    type: String, // logo or brand banner
    default: ''
  },
  isListed: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
},{timestamps:true})

const Brand = mongoose.model("Brand",brandSchema)
module.exports = Brand