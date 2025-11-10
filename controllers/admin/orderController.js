const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');
const Transaction = require('../../models/transactionSchema');
const User = require('../../models/userSchema');
const referralController = require('../user/referralController');

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

    console.log(`User ${userId} has ${previousOrdersCount} previous orders`);


    if (previousOrdersCount === 0) {
      console.log('🎉 First order detected! Processing referral reward...');
      try {
        await referralController.processReferralReward(userId);
        console.log('✅ Referral reward processed successfully');
      } catch (referralError) {
        console.error('⚠️ Referral reward processing failed (non-critical):', referralError);

      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Order placed successfully',
      orderId: order.orderId,
      orderNumber: order.orderNumber || order.orderId
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Order placement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place order',
      error: error.message
    });
  }
};


exports.updateOrderStatus = async (req, res) => {
  console.log('updateOrderStatus hit', req.params, req.body);
  
  try {
    const { itemId, status } = req.body;
    const { orderId } = req.params;

    const validStatuses = ['ordered', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findOne({ orderId }).populate('user');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const item = order.orderItems.find(item => item.ord_id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }

    const previousStatus = item.status;
    item.status = status;

    await updateOrderStatus(order);

    res.status(200).json({
      success: true,
      message: 'Item status updated successfully',
      orderStatus: order.status,
      orderId: order._id
    });

  } catch (error) {
    console.error('Error updating item status:', error.stack);
    res.status(500).json({ message: 'An error occurred while updating the status.' });
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


        if (!product) {
          console.warn(`Order ${order.orderId} has item with missing product. Item ID: ${item._id}`);
        }


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
    res.status(500).send('Internal Server Error');
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

    if (!order) return res.status(404).send('Order not found');


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
    res.status(500).send('Server Error');
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
      return res.status(404).json({ success: false, message: 'Order not found' });
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
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


exports.verifyReturn = async (req, res) => {
  console.log("verifyReturn hit");
  console.log("Params:", req.params);
  console.log("Body:", req.body);

  try {
    const { orderId } = req.params;
    const { itemId, action } = req.body;

    const order = await Order.findOne({ orderId });
    console.log("Order found?", !!order);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.orderItems.find(i => i.ord_id.toString() === itemId);
    console.log("Item found?", !!item, "Status:", item?.status);

    if (!item || item.status !== 'return requested') {
      return res.status(400).json({ success: false, message: 'Invalid item or status' });
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

    } else {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    await updateOrderStatus(order);
    console.log("Order saved");

    return res.status(200).json({
      success: true,
      message: `Return request ${action}ed successfully${action === 'accepted' ? ' and refunded to wallet' : ''}`,
      orderStatus: order.status
    });
  } catch (error) {
    console.error('Error verifying return:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
};

module.exports = exports;