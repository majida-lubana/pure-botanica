const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  couponCode: {
    type: String,
    required: true,
    unique: true
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true
  },
  expireOn: {
    type: Date,
    required: true
  },
  offerPrice: {
    type: Number,
    required: true
  },
  minimumPrice: {
    type: Number,
    required: true
  },
  usageLimit: {
    type: Number,
    default: 1
  },
  quantity: {
    type: Number,
    default: 1
  },
  isListed: {
    type: Boolean,
    default: true,
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User"
  }
});


const Coupon = mongoose.model("Coupen",couponSchema)
module.exports = Coupon