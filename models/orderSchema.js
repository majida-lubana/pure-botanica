
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');
const { string } = require('zod');

const generateOrderId = () => {
  const datePart = new Date().toISOString().slice(0,10).replace(/-/g, ''); 
  const uuidPart = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase(); 
  return `ORD-${datePart}-${uuidPart}`; 
};

const generateOrderItemId = () => {
  const datePart = new Date().toISOString().slice(0,10).replace(/-/g, '');
  const uuidPart = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
  return `ITEM-${datePart}-${uuidPart}`;
};

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    default:generateOrderId,
    unique: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderItems: [{
    ord_id:{
      type:String,
      default:generateOrderItemId ,
      unique:true
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    purchasePrice: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['ordered', 'shipped', 'delivered', 'cancelled', ,'return requested','return rejected','returned'],
      default: 'ordered'
    },
    productName: {
      type: String,
      required: true
    },
    productImage: {
      type: String
    }
  }],
  totalPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  address: {
    fullName: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    pincode: { type: Number, required: true },
    phone: { type: String, required: true },
    addressType: { type: String, required: true },
    isDefault: { type: Boolean, default: false }
  },
  invoiceDate: {
    type: Date
  },
  status: {
    type: String,
    required: true,
    enum: ['processing','completed']
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true
  },
  couponApplied: {
    type: Boolean,
    default: false
  },
  message: {
    type: String
  },
  timeline: [{
  label: { type: String, required: true },   // e.g. "Ordered", "Shipped"
  completed: { type: Boolean, default: false },
  current: { type: Boolean, default: false },
  date: { type: Date }
}],
  paymentId: {
    type: Schema.Types.ObjectId,
    ref: 'Payment'
  },
  paymentMethod: {
    type: String,
    required: true
  },
  shipping: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    required: true
  }
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;