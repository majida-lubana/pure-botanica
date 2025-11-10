// models/couponSchema.js
const mongoose = require('mongoose');
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
      set: v => v.toUpperCase(), // always store uppercase
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
      min: 0,
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
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed',
    },
    /** NEW FIELDS **/
    maxDiscount: {
      // only meaningful for percentage coupons
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
      // cached total usage (incremented atomically)
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

/* ------------------------------------------------------------------
   INDEXES – make every query in the controller O(log n)
------------------------------------------------------------------- */
couponSchema.index({ couponCode: 1 }); // unique already
couponSchema.index({ isListed: 1, startDate: 1, expireOn: 1 });
couponSchema.index({ usageCount: 1 });
couponSchema.index({ usedBy: 1 });

/* ------------------------------------------------------------------
   VIRTUAL – remaining uses (nice for UI)
------------------------------------------------------------------- */
couponSchema.virtual('remainingUses').get(function () {
  return Math.max(0, this.usageLimit - this.usageCount);
});

/* ------------------------------------------------------------------
   PRE-SAVE – keep usageCount in sync when we manually push to usedBy
------------------------------------------------------------------- */
couponSchema.pre('save', function (next) {
  if (this.isModified('usedBy')) {
    // count only *new* users added in this save
    const previous = this._originalUsedBy || [];
    const added = this.usedBy.filter(
      uid => !previous.some(p => p.toString() === uid.toString())
    );
    this.usageCount = (this.usageCount || 0) + added.length;
  }
  // store original for next diff (only needed in same request)
  this._originalUsedBy = this.usedBy.slice();
  next();
});

/* ------------------------------------------------------------------
   METHOD – atomically reserve a slot for a user
   Returns the updated coupon or throws.
------------------------------------------------------------------- */
couponSchema.statics.reserveForUser = async function (couponCode, userId) {
  const code = couponCode.toUpperCase();

  const result = await this.findOneAndUpdate(
    {
      couponCode: code,
      isListed: true,
      startDate: { $lte: new Date() },
      expireOn: { $gte: new Date() },
      usageCount: { $lt: mongoose.ref('Coupon').usageLimit }, // < limit
      'usedBy': { $ne: userId }, // user hasn't used it yet
    },
    {
      $push: { usedBy: userId },
      $inc: { usageCount: 1 },
    },
    { new: true, runValidators: true }
  );

  if (!result) {
    // figure out why it failed
    const coupon = await this.findOne({ couponCode: code });
    if (!coupon) throw new Error('Coupon not found');
    if (!coupon.isListed) throw new Error('Coupon is not listed');
    if (new Date() < coupon.startDate) throw new Error('Coupon not active yet');
    if (new Date() > coupon.expireOn) throw new Error('Coupon expired');
    if (coupon.usedBy.includes(userId)) throw new Error('You have already used this coupon');
    throw new Error('Coupon usage limit reached');
  }

  return result;
};

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;