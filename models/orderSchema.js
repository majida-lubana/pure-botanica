const mongoose = require('mongoose');
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid')


const orderSchema = new mongoose.Schema({
    orderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    orderItems:[{
        product:{
            type:Schema.Types.ObjectId,
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
        enum: ['ordered', 'shipped', 'delivered', 'cancelled', 'returned'],
        default: 'ordered'
      }
    }
  ], 
  totalPrice:{
    type:Number,
    required:true
  },
  discount:{
    type:Number,
    default:0
  },
  finalAmount:{
    type:Number,
    required:true
  },
  address :{
    type:Schema.Types.ObjectId,
    ref:"User",
    required:true
  },
  invoiceDate:{
    type:Date
  },
  status:{
    type:String,
    required:true,
    enum:['pending','ordered', 'shipped', 'delivered', 'cancelled', 'returned']
  },
  createdOn:{
    type:Date,
    default:Date.now,
    required:true
  },
  couponApplied:{
    type:Boolean,
    default:false
  },
  paymentId: {
  type: Schema.Types.ObjectId,
  ref: 'Payment'
}
},{timestamps:true})

const Order = mongoose.model("Order",orderSchema);
module.exports = Order