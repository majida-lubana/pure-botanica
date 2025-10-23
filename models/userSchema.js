const mongoose = require('mongoose')
const {Schema} = mongoose;

const userSchema = new mongoose.Schema({
    name:{
        type :String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phone:{
        type:String,
        required:false,
        unique:false,
        sparse:true,
        default:null
    },
    googleId:{
        type:String,
        unique:true,
        sparse:true  // Add this line - allows multiple null values
    },
    password:{
        type:String,
        required:true,
        select:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    cart:[{
        type:Schema.Types.ObjectId,
        ref:"Cart"
    }],
    wallet:{
        type:Number,
        default:0
    },
    wishList:[{
        type:Schema.Types.ObjectId,
        ref:"WhishList"
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn:{
        type:Date,
        default:Date.now
    },
    referalCode:{
        type:String
    },
    redeemed:{
        type:Boolean
    },
    redeemedUsers:[{
        type:Schema.Types.ObjectId,
        ref:"User"
    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:"Category"
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now
        }
    }]
},{timestamps:true})

const User = mongoose.model("User",userSchema);

module.exports = User;