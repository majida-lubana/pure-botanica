

import mongoose from 'mongoose';

const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    couponCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      set: v => v.toUpperCase(), 
    },
    startDate: {
      type: Date,
      required: true,
    },
    expireOn: {
      type: Date,
      required: true,
    },
    offerPrice: {
      type: Number,
      required: true,
      min: [0.01, 'Offer price must be greater than 0'],
      
      validate: {
        validator: function(value) {
          if (this.discountType === 'percentage') {
            return value >= 1 && value <= 100;
          }
          return value > 0;
        },
        message: props => {
          if (props.value > 100 && this.discountType === 'percentage') {
            return 'Percentage discount cannot exceed 100%';
          }
          if (props.value < 1 && this.discountType === 'percentage') {
            return 'Percentage discount must be at least 1%';
          }
          return 'Offer price must be a positive number';
        }
      }
    },
    minimumPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    usageLimit: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    isListed: {
      type: Boolean,
      default: true,
    },
    discountType: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed',
      required: true
    },
    maxDiscount: {
    
      type: Number,
      min: 0,
      default: null,
    },
    usedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    usageCount: {
      
      type: Number,
      default: 0,
      min: 0,
    },
    createdOn: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);


couponSchema.index({ isListed: 1, startDate: 1, expireOn: 1 });
couponSchema.index({ usageCount: 1 });
couponSchema.index({ usedBy: 1 });


couponSchema.virtual('remainingUses').get(function () {
  return Math.max(0, this.usageLimit - this.usageCount);
});


couponSchema.pre('save', function (next) {
  if (this.isModified('usedBy')) {
    
    const previous = this._originalUsedBy || [];
    const added = this.usedBy.filter(
      uid => !previous.some(p => p.toString() === uid.toString())
    );
    this.usageCount = (this.usageCount || 0) + added.length;
  }
 
  this._originalUsedBy = this.usedBy.slice();
  next();
});


couponSchema.statics.reserveForUser = async function (couponCode, userId) {
  const code = couponCode.toUpperCase();

  const result = await this.findOneAndUpdate(
    {
      couponCode: code,
      isListed: true,
      startDate: { $lte: new Date() },
      expireOn: { $gte: new Date() },
      usageCount: { $lt: this.usageLimit }, 
      usedBy: { $ne: userId },
    },
    {
      $push: { usedBy: userId },
      $inc: { usageCount: 1 },
    },
    { new: true, runValidators: true }
  );

  if (!result) {
    const coupon = await this.findOne({ couponCode: code });
    if (!coupon) throw new Error('Coupon not found');
    if (!coupon.isListed) throw new Error('Coupon is not listed');
    if (new Date() < coupon.startDate) throw new Error('Coupon not active yet');
    if (new Date() > coupon.expireOn) throw new Error('Coupon expired');
    if (coupon.usedBy.some(u => u.toString() === userId.toString())) {
      throw new Error('You have already used this coupon');
    }
    throw new Error('Coupon usage limit reached');
  }

  return result;
};

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;