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

    // Ensure userAddresses is always an array
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

    // Validate user
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

    // Validate required fields
    if (!fullName || !phone || !address || !city || !state || !country || !pincode || !addressType) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Validate pincode
    const pinCode = Number(pincode);
    if (isNaN(pinCode)) {
      return res.status(400).json({ success: false, message: 'Invalid pincode' });
    }

    // Find or create address document
    let addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      addressDoc = new Address({ userId, address: [] });
    }

    // Enforce single default address
    if (isDefault === 'true' || isDefault === true) {
      addressDoc.address.forEach(addr => (addr.isDefault = false));
    }

    // Create new address object with a unique _id
    const newAddress = {
      _id: new mongoose.Types.ObjectId(), // Generate a unique ID for the address
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

    // Update session (if used)
    if (req.session) {
      req.session.userAddresses = addressDoc.address;
    }

    // Return the newly added address
    res.json({
      success: true,
      message: 'Address added successfully',
      data: newAddress
    });
  } catch (error) {
    console.error('[addAddress] Error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error adding address' });
  }
};


// In your checkout controller
exports.getAddress = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

    const addressDoc = await Address.findOne({ userId });
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
    const userId = req.user?._id;
    const addressId = req.params.addressId;
    const { fullName, phone, address, city, state, country, pincode, addressType, isDefault } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

    if (!fullName || !phone || !address || !city || !state || !country || !pincode || !addressType) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      return res.status(404).json({ success: false, message: 'No addresses found' });
    }

    const addr = addressDoc.address.id(addressId);
    if (!addr) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    addr.name = fullName;
    addr.phone = phone;
    addr.address = address;
    addr.city = city;
    addr.state = state;
    addr.country = country;
    addr.pinCode = Number(pincode);
    addr.addressType = addressType;
    addr.isDefault = isDefault === 'true' || isDefault === true;

    if (addr.isDefault) {
      addressDoc.address.forEach(a => {
        if (a._id.toString() !== addressId) {
          a.isDefault = false;
        }
      });
    }

    await addressDoc.save();
    res.json({ success: true, message: 'Address updated successfully' });
  } catch (error) {
    console.error('[editAddress] Error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error updating address' });
  }
};

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
