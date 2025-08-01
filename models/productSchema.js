const mongoose = require('mongoose')
const {Schema} = mongoose;


const productSchema = new mongoose.Schema ({
    productName:{
        type:String,
        required:true
    },
    productDescription :{
        type:String,
        required:true
    },
    brand:{
        type:String,
        required:true
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },
    regularPrice:{
        type:Number,
        required:true
    },
    salePrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0
    },
    quantity:{
        type:Number,
        default:0
    },
    skinType: {
        type: [String], // e.g., ['Oily', 'Dry', 'Sensitive']
        enum: ['Oily', 'Dry', 'Sensitive', 'Combination', 'Normal'],
        default: []
    },
    ingredients: {
        type: [String], // e.g., ['Vitamin C', 'Retinol']
        default: []
    },
    howToUse: {
        type: String
    },
    warnings: {
       type: String
    },
    isActive: {
       type: Boolean,
       default: true
    },
    productImages: {
       type: [String], // Store image URLs or file paths
       default: []
    },
    status: {
       type: String,
       enum: ["Available", "Out Of Stock", "Inactive", "Deleted"],
       default: "Available",
       required: true
    },
    createdAt: {
    type: Date,
    default: Date.now
  }
},{timestamps:true});

const Product = mongoose.model("Product",ProductSchema)
module.exprts = Product;