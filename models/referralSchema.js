const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  invitedUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    email: String,
    name: String,
    invitedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending'
    },
    rewardAmount: {
      type: Number,
      default: 100
    },
    firstOrderCompleted: {
      type: Boolean,
      default: false
    },
    firstOrderAt: Date
  }],
  totalEarned: {
    type: Number,
    default: 0
  },
  totalInvites: {
    type: Number,
    default: 0
  },
  pendingRewards: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Generate unique referral code
referralSchema.statics.generateUniqueCode = async function(userName) {
  const baseCode = userName.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
  let code = baseCode + Math.random().toString(36).substring(2, 6).toUpperCase();
  
  // Ensure uniqueness
  let exists = await this.findOne({ referralCode: code });
  while (exists) {
    code = baseCode + Math.random().toString(36).substring(2, 6).toUpperCase();
    exists = await this.findOne({ referralCode: code });
  }
  
  return code;
};

module.exports = mongoose.model('Referral', referralSchema);