

import mongoose from 'mongoose';

const { Schema } = mongoose;

const wishListSchema = new Schema({
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
}, { timestamps: true });

const WishList = mongoose.model('WishList', wishListSchema);

export default WishList;