const mongoose = require('mongoose');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');


async function updateOrderStatus(order, session = null) {
  const allItemsDone = order.orderItems.every(item =>
    ['delivered', 'cancelled', 'returned'].includes(item.status)
  );
  const newStatus = allItemsDone ? 'completed' : 'processing';
  
  if (order.status !== newStatus) {
    order.status = newStatus;
    order.timeline.push({
      label: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      completed: newStatus === 'completed',
      current: true,
      date: new Date(),
    });
    
    // Mark previous timeline steps as not current
    order.timeline.forEach(step => {
      if (step !== order.timeline[order.timeline.length - 1]) {
        step.current = false;
      }
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
    const limit = 5;
    const skip = (page - 1) * limit;
   
    const filter = { user: userId };
   
    const validStatuses = ['processing', 'completed'];
    if (req.query.status && req.query.status !== '' && validStatuses.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.payment && req.query.payment !== '') {
      if (req.query.payment === 'Paid') filter.paymentId = { $exists: true };
      if (req.query.payment === 'Pending') filter.paymentId = { $exists: false };
    }

    if (req.query.dateRange && req.query.dateRange !== 'all') {
      const now = new Date();
      let fromDate;
      switch (req.query.dateRange) {
        case '30days':
          fromDate = new Date(now);
          fromDate.setDate(now.getDate() - 30);
          break;
        case '3months':
          fromDate = new Date(now);
          fromDate.setMonth(now.getMonth() - 3);
          break;
        case '1year':
          fromDate = new Date(now);
          fromDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      filter.createdOn = { $gte: fromDate }; 
    }

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);
  
    const orders = await Order.find(filter)
      .select('orderId createdOn status finalAmount paymentMethod paymentId orderItems')
      .populate({
        path: 'orderItems.product', 
        select: 'productName productImages',
      })
      .skip(skip)
      .limit(limit);

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
          image: item.productImage || 
            (item.product?.productImages?.[0] ? `/uploads/product-images/${item.product.productImages[0]}` : '/default-image.jpg'),
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
      console.log('User not logged in, redirecting to login page.');
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
        select: 'productName productImages regularPrice',
      })
      .lean();

    if (!order) {
      console.log('Order not found for user:', userId, 'and Order ID:', orderId);
      return res.status(404).send('Order not found');
    }

    // Use schema's timeline array
    const timelineSteps = order.timeline.map(step => ({
      title: step.label,
      completed: step.completed,
      current: step.current,
      date: step.date || null,
    }));

    // Map order data for EJS
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
        country: order.address.country,
        pinCode: order.address.pincode,
        phone: order.address.phone,
        addressType: order.address.addressType,
      },
      user: order.user || { name: 'N/A', email: 'N/A' },
      items: order.orderItems.filter(item => item).map((item, index) => {
        const mappedItem = {
          productId: item.product?._id || item.product || 'N/A',
          productName: item.productName || item.product?.productName || 'Unknown Product',
          purchasePrice: item.purchasePrice || 0,
          quantity: item.quantity || 1,
          productImage: item.productImage || 
            (item.product?.productImages?.[0] ? `/uploads/product-images/${item.product.productImages[0]}` : '/default-image.jpg'),
          productStatus: item.status || 'Unknown',
        };
        console.log(`Mapped item ${index}:`, JSON.stringify(mappedItem, null, 2));
        return mappedItem;
      }),
      timeline: timelineSteps,
      originalAmount: order.totalPrice || 0,
      offerDiscount: order.discount || 0,
      couponApplied: order.couponApplied || false,
      couponDiscount: order.couponApplied ? order.discount || 0 : 0,
      subtotal: order.totalPrice - (order.discount || 0),
      shipping: order.shipping || 0,
      tax: order.tax || 0,
      total: order.finalAmount || 0,
      message: order.message || '',
    };

    // Log for debugging
    console.log('Mapped orderData.items count:', orderData.items.length);
    console.log('Mapped orderData.items:', JSON.stringify(orderData.items, null, 2));

    // Validate finalAmount
    if (orderData.total < 0) {
      console.warn('Negative final amount detected:', orderData.total);
      orderData.totalWarning = 'Warning: Negative total amount. Please verify order calculations.';
    }

    res.render('user/order-details', { order: orderData, user: req.session.user });
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

    const item = order.orderItems.find(item => item.product.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    if (!['pending', 'ordered'].includes(item.status)) {
      return res.status(400).json({ success: false, message: `Item cannot be cancelled (current status: ${item.status})` });
    }

    item.status = 'cancelled';
    const product = await Product.findById(item.product);
    if (product) {
      product.quantity += item.quantity;
      await product.save();
    } else {
      console.warn(`Product ${item.product} not found for quantity update`);
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

    res.json({ success: true, message: 'Item cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling item:', error);
    res.status(500).json({ success: false, message: `Failed to cancel item: ${error.message}` });
  }
};

exports.returnItem = async (req, res) => {
  console.log("Return request hit");

  try {
    const { orderId, productId, reason } = req.body;

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Find the item inside the order
    const item = order.orderItems.find(item => item.product.toString() === productId);
    if (!item || item.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Item cannot be returned' });
    }

    // Check if within return period (7 days)
    const RETURN_EXPIRY_DAYS = 7;
    const deliveryDate = item.deliveryDate ? new Date(item.deliveryDate) : new Date(order.createdOn);
    const expiryDate = new Date(deliveryDate);
    expiryDate.setDate(deliveryDate.getDate() + RETURN_EXPIRY_DAYS);

    if (new Date() > expiryDate) {
      return res.status(400).json({ success: false, message: 'Return period has expired' });
    }

    // Update item status
    item.status = 'returned';

    // Add to order timeline
    order.timeline.push({
      label: `Return Requested for ${item.productName}`,
      completed: true,
      current: false,
      date: new Date(),
      notes: `Reason: ${reason}`,
    });

    // Save the order
    await order.save();

    res.json({ success: true, message: 'Return request submitted successfully' });
  } catch (error) {
    console.error('Error requesting return:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

