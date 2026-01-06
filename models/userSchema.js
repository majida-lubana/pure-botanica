

import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: false,
    unique: false,
    sparse: true,
    default: null
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true // Allows multiple null values for Google OAuth users
  },
  password: {
    type: String,
    select: false // Excludes password from query results by default
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  cart: [{
    type: Schema.Types.ObjectId,
    ref: "Cart"
  }],
  wallet: {
    type: Number,
    default: 0
  },
  wishList: [{
    type: Schema.Types.ObjectId,
    ref: "WishList" // Fixed typo: "WhishList" → "WishList"
  }],
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: "Order"
  }],
  createdOn: {
    type: Date,
    default: Date.now
  },
  referalCode: {
    type: String
  },
  redeemed: {
    type: Boolean
  },
  redeemedUsers: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  searchHistory: [{
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category"
    },
    brand: {
      type: String
    },
    searchOn: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;