

import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  useInCheckout: {
    type: Boolean,
    default: false
  },
  walletUsed: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;