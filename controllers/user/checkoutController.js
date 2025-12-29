const mongoose = require('mongoose');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Coupon = require('../../models/couponSchema');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Wallet = require('../../models/walletSchema');
const Transaction = require('../../models/transactionSchema');
const { calculatePricing } = require('../../utils/calculatePricing');
const { processReferralReward } = require('../../utils/referralUtils');
const STATUS = require('../../constants/statusCode');
const MESSAGES = require('../../constants/messages');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

const calculateTotals = (items) => {
  let subtotal = 0;
  let originalSubtotal = 0;

  items.forEach(item => {
    const p = item.productId;
    if (p?.pricing) {
      subtotal += p.pricing.displayPrice * item.quantity;
      originalSubtotal += p.pricing.originalPrice * item.quantity;
    }
  });

  const offerDiscount = originalSubtotal - subtotal;
  const shippingCost = subtotal > 1000 ? 0 : 50;
  const tax = Number((subtotal * 0.1).toFixed(2));
  const total = Number((subtotal + shippingCost + tax).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    originalSubtotal: Number(originalSubtotal.toFixed(2)),
    offerDiscount: Number(offerDiscount.toFixed(2)),
    shippingCost,
    tax,
    total
  };
};

exports.getCheckoutPage = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.redirect("/user/login");
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' }
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    let cartUpdated = false;

    cart.items = cart.items.filter(item => {
      const p = item.productId;
      return (
        p &&
        p.isActive === true &&
        p.isBlocked === false &&
        p.status === 'Available' &&
        p.quantity > 0
      );
    });

    cart.items = cart.items.map(item => {
      const p = item.productId;
      if (!p) return item;

      if (p.quantity === 0) {
        cartUpdated = true;
        return null;
      }

      if (item.quantity > p.quantity) {
        item.quantity = p.quantity;
        cartUpdated = true;
      }
      return item;
    }).filter(item => item !== null);

    cart.items.forEach(item => {
      if (item.productId) {
        item.productId.pricing = calculatePricing(item.productId);
      }
    });

    if (cartUpdated) {
      await cart.save();
    }

    const totals = calculateTotals(cart.items);
    const { subtotal, originalSubtotal, offerDiscount, shippingCost, tax, total } = totals;

    const addressDoc = await Address.findOne({ userId });
    const userAddresses = addressDoc && Array.isArray(addressDoc.address) ? addressDoc.address : [];

    res.render('user/checkout', {
      cart: cart || { items: [] },
      user: req.user,
      userAddresses: userAddresses || [],
      subtotal,
      originalSubtotal,
      shippingCost,
      tax,
      total,
      discount: offerDiscount
    });
  } catch (error) {
    console.error('Error loading checkout page:', error.stack);
    res.status(STATUS.INTERNAL_ERROR).render('user/page-404', {
      message: MESSAGES.CHECKOUT.LOAD_FAILED || 'An error occurred while loading the checkout page.',
      pageTitle: 'Error'
    });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { fullName, phone, address, city, state, country, pincode, addressType, isDefault } = req.body;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login'
      });
    }

    if (!fullName || !phone || !address || !city || !state || !country || !pincode || !addressType) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.VALIDATION.REQUIRED_FIELDS || 'All fields are required'
      });
    }

    const pinCode = Number(pincode);
    if (isNaN(pinCode)) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ADDRESS.INVALID_PINCODE || 'Invalid pincode'
      });
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

    if (req.session) {
      req.session.userAddresses = addressDoc.address;
    }

    res.json({
      success: true,
      message: MESSAGES.ADDRESS.ADDED_SUCCESS || 'Address added successfully',
      address: newAddress
    });
  } catch (error) {
    console.error('[addAddress] Error:', error.message, error.stack);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.ADDRESS.ADD_FAILED || 'Error adding address'
    });
  }
};

exports.getAddress = async (req, res) => {
  try {
    const userId = req.user?._id;
    const addressId = req.params.addressId;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login'
      });
    }

    const addressDoc = await Address.findOne({ userId, 'address._id': addressId });
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
    console.error('[getAddress] Error:', error.message, error.stack);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.ADDRESS.LOAD_FAILED || 'Error fetching addresses'
    });
  }
};

exports.editAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.UNAUTHORIZED || 'Unauthorized'
      });
    }

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

    if (!fullName || !phone || !address || !city || !state || !country || !pincode || !addressType) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.VALIDATION.REQUIRED_FIELDS || 'All fields are required'
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ADDRESS.INVALID_PHONE || 'Phone number must be exactly 10 digits'
      });
    }

    if (!/^\d{6}$/.test(pincode) || pincode === "000000") {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ADDRESS.INVALID_PINCODE || 'Invalid pincode format'
      });
    }

    const objectAddressId = new mongoose.Types.ObjectId(addressId);

    const existingAddress = await Address.findOne({ userId, 'address._id': objectAddressId });

    if (!existingAddress) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ADDRESS.NOT_FOUND || 'Address not found'
      });
    }

    if (isDefault) {
      await Address.updateMany(
        { userId, 'address.isDefault': true, 'address._id': { $ne: objectAddressId } },
        { $set: { 'address.$.isDefault': false } }
      );
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { userId, 'address._id': objectAddressId },
      {
        $set: {
          'address.$.name': fullName.trim(),
          'address.$.phone': phone.trim(),
          'address.$.city': city.trim(),
          'address.$.address': address.trim(),
          'address.$.pinCode': pincode.trim(),
          'address.$.state': state.trim(),
          'address.$.country': country.trim(),
          'address.$.addressType': addressType,
          'address.$.isDefault': Boolean(isDefault),
          'address.$.updatedAt': new Date()
        }
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ADDRESS.NOT_FOUND || 'Address not found'
      });
    }

    const updatedDetails = updatedAddress.address.find(a => a._id.equals(objectAddressId));

    res.json({
      success: true,
      message: MESSAGES.ADDRESS.UPDATED_SUCCESS || 'Address updated successfully',
      address: {
        id: updatedDetails._id,
        fullName: updatedDetails.name,
        name: updatedDetails.name,
        phone: updatedDetails.phone,
        address: updatedDetails.address,
        city: updatedDetails.city,
        state: updatedDetails.state,
        country: updatedDetails.country || 'India',
        pinCode: updatedDetails.pinCode,
        pincode: updatedDetails.pinCode,
        addressType: updatedDetails.addressType,
        isDefault: updatedDetails.isDefault
      }
    });
  } catch (error) {
    console.error("Edit address error:", error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.ADDRESS.UPDATE_FAILED || 'Failed to update address. Please try again.'
    });
  }
};

exports.removeAddress = async (req, res) => {
  try {
    const userId = req.user?._id;
    const addressId = req.params.addressId;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login'
      });
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ADDRESS.NO_ADDRESSES || 'No addresses found'
      });
    }

    addressDoc.address.pull({ _id: addressId });
    await addressDoc.save();

    res.json({
      success: true,
      message: MESSAGES.ADDRESS.DELETED_SUCCESS || 'Address removed successfully'
    });
  } catch (error) {
    console.error('[removeAddress] Error:', error.message, error.stack);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.ADDRESS.DELETE_FAILED || 'Error removing address'
    });
  }
};

exports.placeOrder = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { selectedAddress, paymentMethod, couponCode } = req.body;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login'
      });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' }
    });

    const addressDoc = await Address.findOne({ userId });

    if (!cart || !cart.items.length) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.CART.EMPTY || 'Cart is empty'
      });
    }

    const address = addressDoc?.address.id(selectedAddress);
    if (!address) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ADDRESS.NOT_FOUND || 'Address not found'
      });
    }

    for (const item of cart.items) {
      const p = item.productId;
      if (!p) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.PRODUCT.MISSING || 'Product missing'
        });
      }

      if (!p.isActive || p.isBlocked || p.status !== 'Available') {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.PRODUCT.NOT_AVAILABLE || `"${p.productName}" unavailable`
        });
      }
    }

    cart.items.forEach(item => {
      if (item.productId) {
        item.productId.pricing = calculatePricing(item.productId);
      }
    });

    const totals = calculateTotals(cart.items);
    const { subtotal, originalSubtotal, offerDiscount, shippingCost, tax } = totals;

    let couponDiscount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        couponCode: couponCode.toUpperCase(),
        isListed: true,
      });

      if (!coupon) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.COUPON.INVALID || 'Invalid coupon code'
        });
      }

      const now = new Date();
      if (now < new Date(coupon.startDate) || now > new Date(coupon.expireOn)) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.COUPON.EXPIRED || 'Coupon expired or not active'
        });
      }

      if (subtotal < coupon.minimumPrice) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.COUPON.MINIMUM_NOT_MET || `Minimum ₹${coupon.minimumPrice} required`
        });
      }

      const alreadyUsed = await Order.findOne({
        user: userId,
        couponCode: coupon.couponCode,
        status: { $nin: ['cancelled', 'payment_failed'] },
      });
      if (alreadyUsed) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.COUPON.ALREADY_USED || 'Coupon already used'
        });
      }

      const totalUsed = await Order.countDocuments({
        couponCode: coupon.couponCode,
        status: { $nin: ['cancelled', 'payment_failed'] },
      });
      if (totalUsed >= coupon.usageLimit) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.COUPON.LIMIT_EXCEEDED || 'Coupon limit exceeded'
        });
      }

      couponDiscount = coupon.discountType === 'percentage'
        ? (subtotal * coupon.offerPrice) / 100
        : coupon.offerPrice;

      couponDiscount = Number(Math.min(couponDiscount, subtotal).toFixed(2));
      appliedCoupon = coupon;
    }

    const totalDiscount = Number((offerDiscount + couponDiscount).toFixed(2));
    const finalAmount = Number((subtotal - couponDiscount + shippingCost + tax).toFixed(2));

    const addressSnapshot = {
      fullName: address.name,
      address: address.address,
      city: address.city,
      state: address.state,
      country: address.country,
      pincode: address.pinCode,
      phone: address.phone,
      addressType: address.addressType,
      isDefault: address.isDefault,
    };

    const orderItems = cart.items.map(i => ({
      product: i.productId._id,
      purchasePrice: i.productId.pricing.displayPrice,
      quantity: i.quantity,
      status: 'ordered',
      productName: i.productId.productName,
      productImage: i.productId.productImages?.[0] || i.productId.productImage,
    }));

    // RAZORPAY PAYMENT
    if (paymentMethod === 'razorpay') {
      const receipt = `o_${uuidv4().slice(0, 35)}`;
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(finalAmount * 100),
        currency: 'INR',
        receipt,
        payment_capture: 1,
      });

      const retryExpiry = new Date(Date.now() + 10 * 60 * 1000);

      const pendingOrder = new Order({
        user: userId,
        orderItems,
        totalPrice: subtotal,
        discount: totalDiscount,
        finalAmount,
        address: addressSnapshot,
        invoiceDate: new Date(),
        status: 'payment_pending',
        couponApplied: !!appliedCoupon,
        couponCode: appliedCoupon?.couponCode || null,
        couponDiscount,
        paymentMethod,
        paymentId: razorpayOrder.id,
        paymentRetryExpiry: retryExpiry,
        shipping: shippingCost,
        tax,
        paymentStatus: 'pending'
      });
      await pendingOrder.save();

      return res.json({
        success: true,
        razorpay: true,
        key_id: process.env.RAZORPAY_KEY_ID,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        orderId: pendingOrder._id.toString(),
        finalAmount: finalAmount
      });
    }

    // WALLET PAYMENT
    if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ userId }).lean();

      if (!wallet || wallet.balance < finalAmount) {
        const available = wallet?.balance ?? 0;
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.WALLET.INSUFFICIENT_BALANCE || 
            `Insufficient wallet balance. Required: ₹${finalAmount.toFixed(2)}, Available: ₹${available.toFixed(2)}`
        });
      }

      const updatedWallet = await Wallet.findOneAndUpdate(
        { userId, balance: { $gte: finalAmount } },
        { $inc: { balance: -finalAmount } },
        { new: true }
      ).lean();

      if (!updatedWallet) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.WALLET.DEDUCTION_FAILED || 'Wallet deduction failed. Please try again.'
        });
      }

      const order = new Order({
        user: userId,
        orderItems,
        totalPrice: subtotal,
        discount: totalDiscount,
        finalAmount,
        address: addressSnapshot,
        invoiceDate: new Date(),
        status: 'processing',
        couponApplied: !!appliedCoupon,
        couponCode: appliedCoupon?.couponCode || null,
        couponDiscount,
        paymentMethod: 'wallet',
        paymentId: null,
        shipping: shippingCost,
        tax,
        paidViaWallet: true,
        paymentStatus: 'paid'
      });
      await order.save();

      await Transaction.create({
        userId: userId,
        orderId: order._id,
        amount: finalAmount,
        type: 'debit',
        description: `Order #${order._id} payment`,
      });

      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: -item.quantity } });
      }

      await Cart.findOneAndDelete({ userId });

      await processReferralReward(userId);

      return res.json({
        success: true,
        orderId: order._id.toString(),
        finalAmount,
        paymentMethod: 'wallet',
        newWalletBalance: Number(updatedWallet.balance).toFixed(2),
        message: MESSAGES.ORDER.PLACED_WALLET || 'Order placed with wallet!'
      });
    }

    if (paymentMethod === 'cod' && finalAmount >= 1000) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ORDER.COD_LIMIT_EXCEEDED || 'Cash on Delivery is only available for orders below ₹1000'
      });
    }

    // CASH ON DELIVERY
    const order = new Order({
      user: userId,
      orderItems,
      totalPrice: subtotal,
      discount: totalDiscount,
      finalAmount,
      address: addressSnapshot,
      invoiceDate: new Date(),
      status: 'processing',
      couponApplied: !!appliedCoupon,
      couponCode: appliedCoupon?.couponCode || null,
      couponDiscount,
      paymentMethod,
      paymentId: null,
      shipping: shippingCost,
      tax,
      paymentStatus: 'pending'
    });
    await order.save();

    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { quantity: -item.quantity } });
    }

    await Cart.findOneAndDelete({ userId });

    await processReferralReward(userId);

    res.json({
      success: true,
      orderId: order._id.toString(),
      finalAmount,
      paymentMethod,
    });

  } catch (error) {
    console.error('[placeOrder] Error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.ORDER.PLACEMENT_FAILED || 'Order failed'
    });
  }
};

// The remaining functions (verifyRazorpayPayment, retryPayment, handlePaymentFailure, getOrderSuccessPage, getOrderErrorPage)
// follow the same pattern: replace hardcoded messages with MESSAGES constants.

exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;
    const userId = req.user?._id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.PAYMENT.MISSING_DETAILS || 'Missing payment details'
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await Order.findOneAndUpdate(
        { _id: orderId, user: userId },
        { status: 'payment_failed', paymentStatus: 'failed' }
      );

      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.PAYMENT.INVALID_SIGNATURE || 'Invalid payment signature'
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      status: 'payment_pending'
    }).populate('orderItems.product');

    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ORDER.NOT_FOUND || 'Order not found or already processed'
      });
    }

    order.status = 'processing';
    order.paymentId = razorpay_payment_id;
    order.paymentStatus = 'paid';
    await order.save();

    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -item.quantity } },
        { new: true }
      );
    }

    await Cart.findOneAndDelete({ userId });

    res.json({
      success: true,
      orderId: order._id.toString(),
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      message: MESSAGES.ORDER.PAYMENT_VERIFIED || 'Payment verified and order confirmed'
    });
  } catch (error) {
    console.error('[verifyRazorpayPayment] Error:', error.message, error.stack);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.PAYMENT.VERIFICATION_FAILED || 'Payment verification failed'
    });
  }
};

exports.retryPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login'
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      status: { $in: ['payment_pending', 'payment_failed'] }
    });

    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ORDER.NOT_RETRYABLE || 'Order not found or cannot be retried'
      });
    }

    if (order.paymentRetryExpiry && new Date() > order.paymentRetryExpiry) {
      order.status = 'payment_failed';
      order.paymentStatus = 'failed';
      await order.save();
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.PAYMENT.RETRY_EXPIRED || 'Payment retry period has expired'
      });
    }

    const shortReceipt = `retry_${uuidv4().slice(0, 30)}`;

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.finalAmount * 100),
      currency: 'INR',
      receipt: shortReceipt,
      payment_capture: 1,
    });

    order.paymentId = razorpayOrder.id;
    order.status = 'payment_pending';
    order.paymentStatus = 'pending';
    await order.save();

    res.json({
      success: true,
      razorpay: true,
      key_id: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      orderId: order._id.toString(),
    });
  } catch (error) {
    console.error('[retryPayment] Error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.PAYMENT.RETRY_FAILED || 'Failed to retry payment'
    });
  }
};

exports.handlePaymentFailure = async (req, res) => {
  try {
    const { orderId, error } = req.body;
    const userId = req.user?._id;

    if (!userId || !orderId) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.COMMON.INVALID_REQUEST || 'Invalid request'
      });
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, user: userId, status: 'payment_pending' },
      {
        status: 'payment_failed',
        paymentStatus: 'failed'
      },
      { new: true }
    );

    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ORDER.NOT_FOUND || 'Order not found'
      });
    }

    res.json({
      success: true,
      message: MESSAGES.PAYMENT.FAILURE_RECORDED || 'Payment failure recorded',
      orderId: order._id.toString()
    });
  } catch (error) {
    console.error('[handlePaymentFailure] Error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.PAYMENT.FAILURE_RECORD_FAILED || 'Failed to record payment failure'
    });
  }
};

exports.getOrderSuccessPage = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.redirect('/user/login');
    }

    const { orderId } = req.query;
    if (!orderId) {
      return res.redirect('/user/order-error?message=' + 
        encodeURIComponent(MESSAGES.ORDER.INVALID_ID || 'Invalid Order') +
        '&details=' + encodeURIComponent('Order ID not provided')
      );
    }

    const order = await Order.findById(orderId).populate('orderItems.product');
    if (!order || order.user.toString() !== userId.toString()) {
      return res.redirect('/user/order-error?message=' +
        encodeURIComponent(MESSAGES.ORDER.NOT_FOUND || 'Order Not Found') +
        '&details=' + encodeURIComponent('Invalid order ID')
      );
    }

    res.render('user/order-success', {
      message: MESSAGES.ORDER.PLACED_SUCCESS || 'Your order has been placed successfully!',
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
    res.redirect('/user/order-error?message=' +
      encodeURIComponent(MESSAGES.ORDER.LOAD_FAILED || 'Server Error') +
      '&details=' + encodeURIComponent('An error occurred while loading order details')
    );
  }
};

exports.getOrderErrorPage = async (req, res) => {
  try {
    const { message, details, code, orderId, finalAmount } = req.query;

    res.render('user/order-error', {
      errorMessage: message || MESSAGES.ORDER.PLACEMENT_FAILED || "We couldn't process your order",
      errorDetails: details || MESSAGES.ORDER.TRY_AGAIN || "There was an issue with your transaction. Please try again.",
      errorCode: code || null,
      orderId: orderId || 'N/A',
      finalAmount: finalAmount ? parseFloat(finalAmount) : undefined
    });
  } catch (error) {
    console.error('[getOrderErrorPage] Error:', error.message, error.stack);
    res.redirect('/user');
  }
};