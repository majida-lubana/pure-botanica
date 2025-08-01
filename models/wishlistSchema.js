const mongoose = require('mongoose')
const {Schema} = mongoose;

const wishListSchema = new mongoose.Schema({
    user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
 products: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    addedOn: {
      type: Date,
      default: Date.now
    }
  }]
},{timestamps:true})

const WishList = mongoose.model("WishList",wishListSchema) 
module.exports = WishList;