

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const { Schema } = mongoose;


const generateOrderId = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const uuidPart = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
  return `ORD-${datePart}-${uuidPart}`;
};


const generateOrderItemId = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const uuidPart = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
  return `ITEM-${datePart}-${uuidPart}`;
};

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: generateOrderId,
    unique: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderItems: [{
    ord_id: {
      type: String,
      default: generateOrderItemId,
      unique: true
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
      enum: [
        'ordered',
        'payment failed',
        'shipped',
        'delivered',
        'cancelled',
        'return requested',
        'return rejected',
        'returned'
      ],
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
    enum: [
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
      'partially_returned',
      'partially_cancelled',
      'return_requested',
      'return_rejected',
      'return_approved',
      'payment_failed',
      'payment_pending'
    ],
    default: 'pending'
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
  couponCode: {
    type: String,
    trim: true
  },
  couponDiscount: {
    type: Number,
    default: 0
  },
  message: {
    type: String
  },
  timeline: [{
    label: { type: String, required: true },
    completed: { type: Boolean, default: false },
    current: { type: Boolean, default: false },
    date: { type: Date }
  }],
  paymentId: {
    type: String,
    required: false
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    required: true
  },
  paymentRetryExpiry: {
    type: Date
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

const Order = mongoose.model('Order', orderSchema);

export default Order;