const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');
const Transaction = require('../../models/transactionSchema');
const User = require('../../models/userSchema');
const referralController = require('../user/referralController');
const STATUS = require('../../constants/statusCode');
const MESSAGES = require('../../constants/messages'); // Centralized messages

const computeOrderStatus = (orderItems) => {
  const statuses = orderItems.map(i => i.status);

  const allDelivered = statuses.every(s => s === 'delivered');
  const allCancelled = statuses.every(s => s === 'cancelled');
  const allReturned   = statuses.every(s => s === 'returned');

  const hasDelivered       = statuses.includes('delivered');
  const hasCancelled       = statuses.includes('cancelled');
  const hasReturned        = statuses.includes('returned');
  const hasReturnRequested = statuses.includes('return requested');
  const hasReturnRejected  = statuses.includes('return rejected');
  const hasShipped         = statuses.includes('shipped');

  if (allDelivered)                 return 'delivered';
  if (allCancelled)                 return 'cancelled';
  if (allReturned)                  return 'returned';
  if (hasReturned && !allReturned)  return 'partially_returned';
  if (hasCancelled && !allCancelled) return 'partially_cancelled';
  if (hasReturnRequested)           return 'return_requested';
  if (hasReturnRejected)            return 'return_rejected';
  if (hasShipped)                   return 'shipped';
  if (hasDelivered && !allDelivered) return 'processing';

  return 'pending';
};

async function updateOrderStatus(order, session = null) {
  const newStatus = computeOrderStatus(order.orderItems);

  if (order.status !== newStatus) {
    order.status = newStatus;

    const exists = order.timeline.some(t => t.label.toLowerCase().includes(newStatus));
    if (!exists) {
      order.timeline.push({
        label: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        completed: ['delivered','cancelled','returned'].includes(newStatus),
        current: true,
        date: new Date(),
      });
    }

    order.timeline.forEach((step, idx, arr) => {
      step.current = (idx === arr.length - 1);
    });
  }

  await order.save({ session });
}

exports.placeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.session.user || req.user._id;

    const {
      orderItems,
      address,
      paymentMethod,
      totalAmount,
      discount,
      couponDiscount,
      finalAmount,
    } = req.body;

    const newOrder = await Order.create([{
      user: userId,
      orderItems: orderItems,
      address: address,
      paymentMethod: paymentMethod,
      totalAmount: totalAmount,
      discount: discount,
      couponDiscount: couponDiscount,
      finalAmount: finalAmount,
      status: 'pending',
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
    }], { session });

    const order = newOrder[0];

    for (const item of orderItems) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -item.quantity } },
        { session }
      );
    }

    const previousOrdersCount = await Order.countDocuments({
      user: userId,
      _id: { $ne: order._id } 
    });

    if (previousOrdersCount === 0) {
      try {
        await referralController.processReferralReward(userId);
      } catch (referralError) {
        console.error('Referral reward processing failed (non-critical):', referralError);
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(STATUS.OK).json({
      success: true,
      message: MESSAGES.ORDER.PLACED_SUCCESS || 'Order placed successfully',
      orderId: order.orderId,
      orderNumber: order.orderNumber || order.orderId
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Order placement error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.ORDER.PLACED_FAILED || 'Failed to place order',
      error: error.message
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { itemId, status } = req.body;
    const { orderId } = req.params;

    const validStatuses = ['ordered', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.ORDER.INVALID_STATUS || 'Invalid status' 
      });
    }

    const order = await Order.findOne({ orderId }).populate('user');
    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.ORDER.NOT_FOUND || 'Order not found' 
      });
    }

    const item = order.orderItems.find(item => item.ord_id.toString() === itemId);
    if (!item) {
      return res.status(STATUS.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.ORDER.ITEM_NOT_FOUND || 'Item not found in order' 
      });
    }

    item.status = status;

    await updateOrderStatus(order);

    res.status(STATUS.OK).json({
      success: true,
      message: MESSAGES.ORDER.STATUS_UPDATED || 'Item status updated successfully',
      orderStatus: order.status,
      orderId: order._id
    });

  } catch (error) {
    console.error('Error updating item status:', error.stack);
    res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false, 
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG 
    });
  }
};

exports.renderOrderManage = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = 5;
    let skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments();

    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('address')
      .populate({
        path: 'orderItems.product',
        select: 'productName productImages', 
      })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); 

    for (const order of orders) {
      const newStatus = computeOrderStatus(order.orderItems);
      if (order.status !== newStatus) {
        order.status = newStatus;
        await Order.updateOne({ _id: order._id }, { status: newStatus });
      }

      order.orderItems.forEach(item => {
        const product = item.product;
        item.displayName = product?.productName || 'Unknown Product';

        const imageFile = product?.productImages?.[0];
        item.displayImage = imageFile
          ? `/Uploads/product-images/${imageFile}`
          : 'https://via.placeholder.com/80?text=No+Image';
      });
    }

    res.render('admin/orderManage', {
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      admin: req.session.admin,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(STATUS.INTERNAL_ERROR).render('admin/admin-error', {
      pageTitle: 'Admin Error',
      heading: 'Oops! Something Went Wrong',
      userName: 'Admin',
      imageURL: '/images/admin-avatar.jpg',
      errorMessage: MESSAGES.ORDER.LOAD_FAILED || 'Failed to load orders'
    });
  }
};

exports.renderOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('user', 'name email')
      .populate({
        path: 'orderItems.product',
        select: 'productName productImages',
      })
      .lean();

    if (!order) {
      return res.status(STATUS.NOT_FOUND).render('admin/admin-error', {
        pageTitle: 'Admin Error',
        heading: 'Order Not Found',
        userName: 'Admin',
        imageURL: '/images/admin-avatar.jpg',
        errorMessage: MESSAGES.ORDER.NOT_FOUND || 'Order not found'
      });
    }

    const newStatus = computeOrderStatus(order.orderItems);
    if (order.status !== newStatus) {
      order.status = newStatus;
      await Order.updateOne({ _id: order._id }, { status: newStatus });
    }

    order.orderItems = order.orderItems.map(item => {
      const product = item.product;
      const imageFile = product?.productImages?.[0];
      const productImage = imageFile 
        ? `/Uploads/product-images/${imageFile}` 
        : 'https://via.placeholder.com/120?text=No+Image';

      return {
        ...item,
        productName: product?.productName || 'Unknown Product',
        productImage,
        status: item.status || 'ordered',
        productId: product?._id?.toString() || 'N/A',
      };
    });

    if (!order.timeline || order.timeline.length === 0) {
      order.timeline = [{ label: 'Ordered', current: true, completed: false, date: new Date() }];
    }

    order.address = order.address || {
      fullName: 'N/A', address: '', city: '', state: '', country: '',
      pincode: '', phone: 'N/A', addressType: 'N/A'
    };

    res.render('admin/orderDetails', { order, admin: req.session.admin });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(STATUS.INTERNAL_ERROR).render('admin/admin-error', {
      pageTitle: 'Admin Error',
      heading: 'Oops! Something Went Wrong',
      userName: 'Admin',
      imageURL: '/images/admin-avatar.jpg',
      errorMessage: MESSAGES.COMMON.SOMETHING_WENT_WRONG
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('user', 'name email')
      .populate({
        path: 'orderItems.product',
        select: 'productName productImages',
      })
      .lean();

    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.ORDER.NOT_FOUND || 'Order not found' 
      });
    }

    order.orderItems = order.orderItems.map(item => ({
      ...item,
      productName: item.productName || (item.product?.productName || 'Unknown Product'),
      productImage: item.productImage || (item.product?.productImages?.[0] ? `/uploads/product-images/${item.product.productImages[0]}` : '/default-image.jpg'),
      status: item.status || 'ordered',
      productId: item.product?._id?.toString() || item.product || 'N/A',
    }));

    order.timeline = order.timeline || [{ label: 'Ordered', current: true, completed: false, date: new Date() }];
    order.address = order.address || {
      fullName: 'N/A',
      address: '',
      city: '',
      state: '',
      country: '',
      pincode: '',
      phone: 'N/A',
      addressType: 'N/A',
    };

    order.paymentStatus = order.paymentStatus || 'Pending';
    order.transactionId = order.paymentId || 'N/A';

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false, 
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG 
    });
  }
};

exports.verifyReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemId, action } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.ORDER.NOT_FOUND || 'Order not found' 
      });
    }

    const item = order.orderItems.find(i => i.ord_id.toString() === itemId);
    if (!item || item.status !== 'return requested') {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.ORDER.INVALID_RETURN_REQUEST || 'Invalid item or status' 
      });
    }

    if (action === 'accepted') {
      item.status = 'returned';
      
      await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });

      const refundAmount = item.purchasePrice * item.quantity;

      const pendingTxn = await Transaction.findOne({
        orderId: order._id,
        itemId: item._id,
        status: 'pending',
        type: 'refund'
      });

      if (pendingTxn) {
        pendingTxn.status = 'completed';
        await pendingTxn.save();

        let wallet = await Wallet.findOne({ userId: order.user });
        if (!wallet) {
          wallet = new Wallet({ userId: order.user, balance: 0 });
        }
        wallet.balance += refundAmount;
        await wallet.save();

        await Transaction.create({
          userId: order.user,
          orderId: order._id,
          amount: refundAmount,
          type: 'credit',
          status: 'completed',
          description: `Refund Approved - ${item.productName} (Order #${order.orderId})`
        });
      }

      await updateOrderStatus(order);

      return res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.ORDER.RETURN_ACCEPTED || 'Return request accepted and refunded to wallet',
        orderStatus: order.status
      });

    } else if (action === 'rejected') {
      item.status = 'return rejected';

      await Transaction.updateOne(
        {
          orderId: order._id,
          itemId: item._id,
          status: 'pending',
          type: 'refund'
        },
        {
          status: 'rejected',
          description: `Return Rejected - ${item.productName} (Order #${order.orderId})`
        }
      );

      await updateOrderStatus(order);

      return res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.ORDER.RETURN_REJECTED || 'Return request rejected',
        orderStatus: order.status
      });

    } else {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.COMMON.INVALID_REQUEST || 'Invalid action' 
      });
    }
  } catch (error) {
    console.error('Error verifying return:', error);
    return res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG
    });
  }
};

module.exports = exports;