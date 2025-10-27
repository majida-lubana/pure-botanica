const mongoose = require('mongoose');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

exports.getCheckoutPage = async (req, res) => {
  try {
    const userId = req.user?._id;
    console.log('getCheckoutPage: userId:', userId);
    if (!userId) {
      console.log('getCheckoutPage: No userId, redirecting to login');
      return res.redirect("/user/login");
    }

    console.log('getCheckoutPage: Fetching cart for userId:', userId);
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' }
    });
    console.log('getCheckoutPage: Cart found:', cart ? cart : 'No cart found');

    if (!cart || !cart.items||cart.items.length===0) {
      console.log('getCheckoutPage: Cart is empty or not found, redirecting to cart');
      return res.redirect('/cart');
    }

    cart.items = cart.items.filter(item=>item.productId)
    await cart.save()


    console.log('getCheckoutPage: Fetching user addresses');
    const addressDoc = await Address.findOne({ userId });
    console.log('getCheckoutPage: User addresses found:', addressDoc ? addressDoc.address : 'No addresses');


    const userAddresses = addressDoc && Array.isArray(addressDoc.address) ? addressDoc.address : [];

    let subtotal = 0;
    let shippingCost = 50;
    let discount = 0;

    subtotal = cart.items.reduce((sum, item) => {
      if (item.productId && item.productId.salePrice) {
        const salePrice = item.productId.salePrice;
        const regularPrice = item.productId.regularPrice || salePrice;
        discount += (regularPrice - salePrice) * item.quantity;
        return sum + (salePrice * item.quantity);
      }
      return sum;
    }, 0);

    shippingCost = subtotal > 1000 ? 0 : 50;
    const tax = subtotal * 0.1;
    const total = subtotal - discount + shippingCost + tax;

    console.log('getCheckoutPage: Rendering checkout page with addresses:', userAddresses);
    res.render('user/checkout', {
      cart: cart || { items: [] },
      user: req.user,
      userAddresses : userAddresses || [],
      subtotal,
      shippingCost,
      tax,
      total,
      discount
    });
  } catch (error) {
    console.error('Error loading checkout page:', error.stack);
    res.status(500).render('user/page-404', {
      message: 'An error occurred while loading the checkout page.',
      pageTitle: 'Error'
    });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { fullName, phone, address, city, state, country, pincode, addressType, isDefault } = req.body;

    console.log('[addAddress] Request data:', { userId, fullName, phone, address, city, state, country, pincode, addressType, isDefault });

 
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

 
    if (!fullName || !phone || !address || !city || !state || !country || !pincode || !addressType) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }


    const pinCode = Number(pincode);
    if (isNaN(pinCode)) {
      return res.status(400).json({ success: false, message: 'Invalid pincode' });
    }

  
    let addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      addressDoc = new Address({ userId, address: [] });
    }


    if (isDefault === 'true' || isDefault === true) {
      addressDoc.address.forEach(addr => (addr.isDefault = false));
    }

    const newAddress = {
      _id: new mongoose.Types.ObjectId(),
      addressType,
      name: fullName,
      address,
      city,
      state,
      country,
      pinCode,
      phone,
      isDefault: isDefault === 'true' || isDefault === true
    };

    addressDoc.address.push(newAddress);
    await addressDoc.save();

    console.log('[addAddress] Address saved:', newAddress);

 
    if (req.session) {
      req.session.userAddresses = addressDoc.address;
    }


    res.json({
      success: true,
      message: 'Address added successfully',
      address: newAddress
    });
  } catch (error) {
    console.error('[addAddress] Error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error adding address' });
  }
};



exports.getAddress = async (req, res) => {
  try {
    const userId = req.user?._id;
    const addressId = req.params.addressId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

    const addressDoc = await Address.findOne({ userId,'address._id':addressId });
    const addresses = addressDoc && Array.isArray(addressDoc.address) ? addressDoc.address : [];

    res.json({
      success: true,
      addresses: addresses.map(addr => ({
        _id: addr._id,
        name: addr.name,
        fullName: addr.name,
        phone: addr.phone,
        address: addr.address,
        city: addr.city,
        state: addr.state,
        country: addr.country || 'India',
        pinCode: addr.pinCode,
        pincode: addr.pinCode,
        addressType: addr.addressType,
        isDefault: addr.isDefault
      }))
    });
  } catch (error) {
    console.error('[getAllAddresses] Error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error fetching addresses' });
  }
};
exports.editAddress = async (req, res) => {
    try {
      console.log("[PUT /address/edit/:id] Session ID:", req.sessionID);
      console.log("[PUT /address/edit/:id] Session:", req.session);

      const addressId = req.params.addressId;
      const userId = req.session.user?.id || req.session.user;
      console.log("[PUT /address/edit/:id] User in session:", userId);
      console.log("addressId",addressId)

      if (!userId) {
        console.log("[PUT /address/edit/:id] No user in session");
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      console.log("[PUT /address/edit/:id] User found:", userId);
      console.log("req.body:", req.body);
      const {
        fullName,
        phone,
        address,
        city,
        state,
        country,
        pincode,
        addressType,
        isDefault,
      } = req.body;

     
      if (
        !fullName ||
        !phone ||
        !address ||
        !city ||
        !state ||
        !country ||
        !pincode ||
        !addressType
      ) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }

      
      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be exactly 10 digits",
        });
      }

     
      if (!/^\d{6}$/.test(pincode) || pincode === "000000") {
        return res.status(400).json({
          success: false,
          message: "Invalid pincode format",
        });
      }
      const  objectAddressId = new mongoose.Types.ObjectId(addressId)
      console.log("123456789",objectAddressId)
     
      const existingAddress = await Address.findOne({userId,'address._id':objectAddressId});

      if (!existingAddress) {
        return res.status(404).json({
          success: false,
          message: "Address not found",
        });
      }

     
      if (isDefault) {
        await Address.updateMany(
          { userId, 'address.isDefault':true,'address._id':{ $ne: objectAddressId } },
          { $set: { isDefault: false } }
        );
      }

    const updatedAddress = await Address.findOneAndUpdate(
      {userId,'address._id':objectAddressId},
      {
        $set:{
          'address.$.name':fullName.trim(),
          'address.$.phone':phone.trim(),
          'address.$.city':city.trim(),
          'address.$.address':address.trim(),
          'address.$.pinCode':pincode.trim(),
          'address.$.state':state.trim(),
          'address.$.country':country.trim(),
          'address.$.addressType':addressType,
          'address.$.isDefault':Boolean(isDefault),
          'address.$.updatedAt':new Date()
        } 
      },
      {new:true}
    )

    if(!updatedAddress){
      return res.status(404).json({success:false, message: "Address not found" })
    }

    const updatedDetails = updatedAddress.address.find(a=>a._id.equals(objectAddressId))
      res.json({
        success: true,
        message: "Address updated successfully",
        address:{
          id:updatedDetails._id,
          fullName:updatedDetails.name,
          name:updatedDetails.name,
          phone:updatedDetails.phone,
          address:updatedDetails.address,
          city:updatedDetails.city,
          state:updatedDetails.state,
          country:updatedDetails.country||'India',
          pinCode:updatedDetails.pinCode,
          pincode:updatedDetails.pinCode,
          addressType:updatedDetails.addressType,
          isDefault:updatedDetails.isDefault

        }
      });
    } catch (error) {
      console.error("Edit address error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update address. Please try again.",
        address:{
          id:updatedDetails._id,
          fullName:updatedDetails.name,
          name:updatedDetails.name,
          phone:updatedDetails.phone,
          address:updatedDetails.address,
          city:updatedDetails.city,
          state:updatedDetails.state,
          country:updatedDetails.country||'India',
          pinCode:updatedDetails.pinCode,
          pincode:updatedDetails.pinCode,
          addressType:updatedDetails.addressType,
          isDefault:updatedDetails.isDefault

        }
      });
    }
  }

exports.removeAddress = async (req, res) => {
  try {
    const userId = req.user?._id;
    const addressId = req.params.addressId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      return res.status(404).json({ success: false, message: 'No addresses found' });
    }

    addressDoc.address.pull({ _id: addressId });
    await addressDoc.save();

    res.json({ success: true, message: 'Address removed successfully' });
  } catch (error) {
    console.error('[removeAddress] Error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error removing address' });
  }
};

exports.placeOrder = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { selectedAddress, paymentMethod } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const addressDoc = await Address.findOne({ userId });

    if (!cart || !cart.items.length) {
      return res.status(400).json({ success: false, message: 'Cart is empty or not found' });
    }

    

    const address = addressDoc?.address.id(selectedAddress);
    if (!address) {
      return res.status(400).json({ success: false, message: 'Selected address not found' });
    }

   for(const item of cart.items){
    const p = item.productId

    if(!p){
      return res.status(400).json({
        success:false,
        message:'A product in your cart was not found.'
      })
    }

    if (p.isActive !== true || p.isBlocked === true || p.status !== 'Available') {
    console.log('Product blocked:', { name: p.productName, isActive: p.isActive, isBlocked: p.isBlocked, status: p.status });
    return res.status(400).json({
      success: false,
      message: `Product "${p.productName}" is no longer available for purchase.`
    });
  }

    if(p.quantity===0){
      return res.status(400).json({
        success: false, 
        message: `Product "${item.productId.productName}" is out of stock.`
      })
    }

    if(item.quantity>p.quantity){

      return res.status(400).json({
        success: false, 
        message: `Not enough stock for "${item.productId.productName}". Available: ${p.quantity}`
      })
    }
   }

    const subtotal = cart.items.reduce((sum, item) =>
      sum + (item.productId.salePrice * item.quantity), 0
    );
    const discount = cart.items.reduce((sum, item) => {
      const regularPrice = item.productId.regularPrice || item.productId.salePrice;
      return sum + ((regularPrice - item.productId.salePrice) * item.quantity);
    }, 0);
    const shippingCost = subtotal > 1000 ? 0 : 50;
    const tax = subtotal * 0.1;
    const finalAmount = subtotal - discount + shippingCost + tax;

    const addressSnapshot = {
      fullName: address.name,
      address: address.address,
      city: address.city,
      state: address.state,
      country: address.country,
      pincode: address.pinCode,
      phone: address.phone,
      addressType: address.addressType,
      isDefault: address.isDefault
    };

    const orderItems = cart.items.map(item => ({
      product: item.productId._id,
      purchasePrice: item.productId.salePrice,
      quantity: item.quantity,
      status: 'ordered',
      productName: item.productId.productName,
      productImage: item.productId.productImage
    }));
   console.log('order.item',orderItems.product)

    const order = new Order({
      user: userId,
      orderItems,
      totalPrice: subtotal,
      discount,
      finalAmount,
      address: addressSnapshot,
      invoiceDate: new Date(),
      status: 'processing',
      couponApplied: discount > 0,
      message: '',
      paymentId: null,
      paymentMethod,
      shipping: shippingCost,
      tax
    });

    await order.save();

    
    
    for (const item of order.orderItems) {
      console.log("items inside the cart",item);
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -item.quantity } } 
      );
    }

    await Cart.findOneAndDelete({ userId });

    res.json({
      success: true,
      orderId: order._id,
      finalAmount,
      paymentMethod
    });
  } catch (error) {
    console.error('[placeOrder] Error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error placing order', error: error.message });
  }
};

exports.getOrderSuccessPage = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      console.log('[getOrderSuccessPage] No userId, redirecting to /login');
      return res.redirect('/user/login');
    }

    const { orderId } = req.query;
    if (!orderId) {
      console.log('[getOrderSuccessPage] No orderId provided');
      return res.redirect('/user/order-error?message=Invalid%20Order&details=Order%20ID%20not%20provided');
    }

    const order = await Order.findById(orderId).populate('orderItems.product');
    if (!order || order.user.toString() !== userId.toString()) {
      console.log('[getOrderSuccessPage] Order not found or user mismatch');
      return res.redirect('/user/order-error?message=Order%20Not%20Found&details=Invalid%20order%20ID');
    }

    res.render('user/order-success', {
      message: 'Your order has been placed successfully!',
      orderId: order._id.toString(),
      paymentMethod: order.paymentMethod,
      orderItems: order.orderItems,
      subtotal: order.totalPrice,
      discount: order.discount || 0,
      shippingCost: order.shipping,
      tax: order.tax,
      finalAmount: order.finalAmount,
      shippingAddress: order.address
    });
  } catch (error) {
    console.error('[getOrderSuccessPage] Error:', error.message, error.stack);
    res.redirect('/user/order-error?message=Server%20Error&details=An%20error%20occurred%20while%20loading%20order%20details');
  }
};

exports.getOrderErrorPage = async (req, res) => {
  try {
    const { message, details, code, orderId, finalAmount } = req.query;
    console.log('[getOrderErrorPage] Query params:', { message, details, code, orderId, finalAmount });

    res.render('user/order-error', {
      errorMessage: message || "We couldn't process your order",
      errorDetails: details || "There was an issue with your transaction. Please try again.",
      errorCode: code || null,
      orderId: orderId || 'N/A',
      finalAmount: finalAmount ? parseFloat(finalAmount) : undefined
    });
  } catch (error) {
    console.error('[getOrderErrorPage] Error:', error.message, error.stack);
    res.redirect('/user');
  }
};
