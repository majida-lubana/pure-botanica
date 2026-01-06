

import mongoose from 'mongoose';

const { Schema } = mongoose;

const addressSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  address: [{
    addressType: {
      type: String,
      required: true,
      enum: ['Home', 'Work', 'Other']
    },
    name: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    },
    pinCode: {
      type: String,
      required: true,
      match: [/^\d{6}$/, 'Pincode must be exactly 6 digits'],
    },
    phone: {
      type: String,
      required: true,
      match: [/^\d{10}$/, 'Phone number must be exactly 10 digits'],
    },
    altPhone: {
      type: String,
      required: false
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }]
});


addressSchema.index({ userId: 1 });

const Address = mongoose.model('Address', addressSchema);

export default Address;