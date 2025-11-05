const mongoose = require('mongoose');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Transaction = require('../../models/transactionSchema')
const { creditWallet } = require('../../utils/walletUtils');
const {calculatePricing} = require('../../utils/calculatePricing')

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

    const labelExists = order.timeline.some(t =>
      t.label.toLowerCase().includes(newStatus.toLowerCase())
    );

    if (!labelExists) {
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

exports.loadOrderPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect('/login');

    const user = await User.findById(userId).select('avatar name email phone');
    if (!user) return res.status(404).send('User not found');

    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;
   
    const filter = { user: userId };
    
    if (req.query.search && req.query.search.trim() !== '') {
      const searchTerm = req.query.search.trim();
      const searchRegex = { $regex: searchTerm, $options: 'i' };

      const productSearch = { 'orderItems.productName': searchRegex };
      const statusSearch = { status: searchRegex };

      filter.$or = [productSearch, statusSearch];
    }
   
    const validStatuses = ['processing', 'completed'];
    if (req.query.status && req.query.status !== '' && validStatuses.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);
  
    const orders = await Order.find(filter)
      .select('orderId createdOn status finalAmount paymentMethod paymentId orderItems')
      .populate({
        path: 'orderItems.product', 
        select: 'productName productImages',
      })
      .sort({createdAt:-1})
      .skip(skip)
      .limit(limit)
      .lean(); 

 
    for (const order of orders) {
      const newStatus = computeOrderStatus(order.orderItems);
      if (order.status !== newStatus) {
        order.status = newStatus;
        await Order.updateOne({ _id: order._id }, { status: newStatus });
      }
    }
orders.map((order) => {
  order.orderItems.map((item) => {
    console.log(item.productImage);
  });
});


    const message = orders.length === 0 ? 'No orders found for selected filter' : null;

    res.render('user/orders', {
      user: {
        avatar: user.avatar || '/default-avatar.jpg',
        name: user.name || 'User Name',
        email: user.email || 'user@example.com',
        phone: user.phone || '+1234567890',
      },
      orders: orders.map(order => ({
        _id: order._id,
        orderID: order.orderId,
        createdAt: order.createdOn,
        paymentStatus: order.paymentId ? 'Paid' : 'Pending',
        status: order.status || 'processing',
        finalAmount: order.finalAmount || 0,
        orderItems: order.orderItems.map(item => ({
          productId: item.product?._id,
          productName: item.productName || item.product?.productName || 'Unknown Product',
          image: item.productImage 
        })),
      })),
      message,
      filters: req.query, 
      currentPage: page,
      totalPages: totalPages
    });
  } catch (err) {
    console.error('Error loading orders page:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.getOrderDetailsPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect('/user/login');
    }

    const orderId = req.params.orderId;
    const query = mongoose.Types.ObjectId.isValid(orderId)
      ? { _id: orderId, user: userId }
      : { orderId: orderId, user: userId };

    const order = await Order.findOne(query)
      .populate('user', 'name email')
      .populate({
        path: 'orderItems.product',
        select: 'productName productImages regularPrice salePrice productOffer category',
        populate: { path: 'category', select: 'categoryOffer' }
      })
      .lean();

    if (!order) {
      return res.status(404).send('Order not found');
    }


    let recalculatedSubtotal = 0;
    let originalSubtotal = 0;

    const items = order.orderItems.map(item => {
      const product = item.product;
      let displayPrice = item.purchasePrice;
      let originalPrice = item.purchasePrice;

      if (product) {
        const pricing = calculatePricing(product);
        displayPrice = pricing.displayPrice;
        originalPrice = pricing.originalPrice;
      }

      const itemTotal = displayPrice * item.quantity;
      const itemOriginal = originalPrice * item.quantity;

      recalculatedSubtotal += itemTotal;
      originalSubtotal += itemOriginal;

   
      let imagePath = '/images/placeholder.jpg'; 
      if (item.productImage) {
       
        if (item.productImage.startsWith('/uploads') || item.productImage.startsWith('http')) {
          imagePath = item.productImage;
        } else {
  
          imagePath = `/uploads/product-images/${item.productImage}`;
        }
      } else if (product?.productImages?.[0]) {

        imagePath = `/uploads/product-images/${product.productImages[0]}`;
      }

      return {
        productId: product?._id || item.product,
        productName: item.productName || product?.productName || 'Unknown Product',
        purchasePrice: displayPrice,
        originalPrice,
        quantity: item.quantity,
        productImage: imagePath,
        productStatus: item.status || 'Unknown',
      };
    });

    const offerDiscount = Number((originalSubtotal - recalculatedSubtotal).toFixed(2));
    const couponDiscount = order.couponDiscount || 0;
    const totalDiscount = Number((offerDiscount + couponDiscount).toFixed(2));

    const shipping = order.shipping || 0;
    const tax = order.tax || 0;
    const finalAmount = Number((recalculatedSubtotal - couponDiscount + shipping + tax).toFixed(2));

    const timelineSteps = (order.timeline || []).map(step => ({
      title: step.label,
      completed: step.completed,
      current: step.current,
      date: step.date || null,
    }));

    const orderData = {
      _id: order._id,
      orderID: order.orderId,
      orderStatus: order.status,
      orderDate: order.createdOn,
      invoiceDate: order.invoiceDate || order.createdOn,
      paymentMethod: order.paymentMethod || 'N/A',
      paymentStatus: order.paymentId ? 'Paid' : 'Pending',
      transactionId: order.paymentId || 'N/A',
      shippingAddress: {
        name: order.address.fullName,
        address: order.address.address,
        city: order.address.city,
        state: order.address.state,
        country: order.address.country || 'India',
        pinCode: order.address.pincode || order.address.pinCode,
        phone: order.address.phone,
        addressType: order.address.addressType,
      },
      user: order.user || { name: 'N/A', email: 'N/A' },
      items,
      timeline: timelineSteps,

 
      originalSubtotal: Number(originalSubtotal.toFixed(2)),
      offerDiscount,
      couponApplied: order.couponApplied || false,
      couponDiscount,
      subtotal: Number(recalculatedSubtotal.toFixed(2)),
      shipping,
      tax,
      totalDiscount,
      total: finalAmount,

      message: order.message || '',
    };

    res.render('user/order-details', { 
      order: orderData, 
      user: req.session.user 
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).send('Internal Server Error');
  }
};

exports.cancelItem = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or product ID' });
    }

    const order = await Order.findById(orderId);
    if (!order || order.user.toString() !== userId) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    const item = order.orderItems.find(i => i.product.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    if (!['pending', 'ordered'].includes(item.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Item cannot be cancelled (current status: ${item.status})` 
      });
    }

    item.status = 'cancelled';
    
    await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });

    if (order.paymentMethod !== 'cod' || order.paymentId) {
      const refundAmount = item.purchasePrice * item.quantity;
      
      await creditWallet(
        userId,
        refundAmount,
        order._id,
        `Refund - Cancelled ${item.productName} (Order #${order.orderId})`
      );
    }

    order.timeline.push({
      label: `Item ${item.productName} Cancelled`,
      completed: true,
      current: false,
      date: new Date(),
      notes: `Reason: ${reason || 'No reason provided'}`,
    });

    await updateOrderStatus(order);
    await order.save();

    res.json({ 
      success: true, 
      message: 'Item cancelled and refunded to wallet', 
      orderStatus: order.status 
    });

  } catch (error) {
    console.error('Error cancelling item:', error);
    res.status(500).json({ success: false, message: `Failed to cancel item: ${error.message}` });
  }
};

exports.returnItem = async (req, res) => {
  console.log("Return request initiated");

  try {
    const { orderId, productId, reason } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.orderItems.find(item => item.product.toString() === productId);
    if (!item || item.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Item cannot be returned' });
    }

    const RETURN_EXPIRY_DAYS = 7;
    const deliveryDate = item.deliveryDate ? new Date(item.deliveryDate) : new Date(order.createdOn);
    const expiryDate = new Date(deliveryDate);
    expiryDate.setDate(deliveryDate.getDate() + RETURN_EXPIRY_DAYS);

    if (new Date() > expiryDate) {
      return res.status(400).json({ success: false, message: 'Return period has expired' });
    }

    item.status = 'return requested';
    
    order.timeline.push({
      label: `Return Requested for ${item.productName}`,
      completed: true,
      current: false,
      date: new Date(),
      notes: `Reason: ${reason}`,
    });

    const refundAmount = item.purchasePrice * item.quantity;
    
    await Transaction.create({
      userId: order.user,
      orderId: order._id,
      amount: refundAmount,
      type: 'refund',
      status: 'pending',
      description: `Return Request - ${item.productName} (Order #${order.orderId})`,
      itemId: item._id,
    });

    await updateOrderStatus(order);  
    await order.save();              

    res.json({ 
      success: true, 
      message: 'Return request submitted. Refund pending admin approval.',
      orderStatus: order.status   
    });

  } catch (error) {
    console.error('Error requesting return:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};