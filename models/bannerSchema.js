const mongoose = require('mongoose');
const { Schema } = mongoose;

const bannerSchema = new Schema({
  image: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiredAt: {
    type: Date,
    required: true
  },
  link:{
    type:String,
  },
   startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  description: {
  type: String,
  required: false,
  trim: true
}
}, { timestamps: true }); // automatically adds createdAt & updatedAt


const Banner = mongoose.model("Banner",bannerSchema)

module.exports = Banner;