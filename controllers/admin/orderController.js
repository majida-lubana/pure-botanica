const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');

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
      .limit(limit);

    orders.forEach(order => {
      if (!order.user) console.warn(`Order ${order.orderId} has no valid user reference. User ID: ${order.user}`);
      if (!order.address) console.warn(`Order ${order.orderId} has no valid address reference. Address ID: ${order.address}`);
      order.orderItems.forEach(item => {
        if (!item.product) console.warn(`Order ${order.orderId} has an item with no valid product reference. Product ID: ${item.product}`);
        item.displayName = item.productName || (item.product?.productName || 'Unknown Product');
        item.displayImage = item.productImage || (item.product?.productImages?.[0] ? `/uploads/product-images/${item.product.productImages[0]}` : '/default-image.jpg');
      });
    });
orders.forEach((order)=>{
  console.log("&&&&&&&&&&",order.orderId)
})
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
    console.log('Fetching order details for orderId:', req.params.orderId);

    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('user', 'name email')
      .populate({
        path: 'orderItems.product',
        select: 'productName productImages',
      })
      .lean();

    if (!order) {
      console.log('Order not found for orderId:', req.params.orderId);
      return res.status(404).send('Order not found');
    }

    // Process orderItems
    order.orderItems = order.orderItems.map(item => ({
      ...item,
      productName: item.productName || (item.product?.productName || 'Unknown Product'),
      productImage: item.productImage || (item.product?.productImages?.[0] ? `/uploads/product-images/${item.product.productImages[0]}` : '/default-image.jpg'),
      status: item.status || 'ordered',
      productId: item.product?._id?.toString() || item.product || 'N/A', // Add productId for EJS
    }));

    // Ensure timeline
    order.timeline = order.timeline || [{ label: 'Ordered', current: true, completed: false, date: new Date() }];

    // Ensure address
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

    // Add payment fallbacks
    order.paymentStatus = order.paymentStatus || 'Pending';
    order.transactionId = order.paymentId || 'N/A';

    console.log('Processed order:', order);

    res.render('admin/orderDetails', {
      order,
      admin: req.session.admin,
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).send('Server Error');
  }
};
exports.getOrderById = async (req, res) => {
  try {
    // Use orderId (string) instead of _id, for consistency
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

    // Process orderItems
    order.orderItems = order.orderItems.map(item => ({
      ...item,
      productName: item.productName || (item.product?.productName || 'Unknown Product'),
      productImage: item.productImage || (item.product?.productImages?.[0] ? `/uploads/product-images/${item.product.productImages[0]}` : '/default-image.jpg'),
      status: item.status || 'ordered',
      productId: item.product?._id?.toString() || item.product || 'N/A',
    }));

    // Ensure timeline
    order.timeline = order.timeline || [{ label: 'Ordered', current: true, completed: false, date: new Date() }];

    // Ensure address
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

    // Add payment fallbacks
    order.paymentStatus = order.paymentStatus || 'Pending';
    order.transactionId = order.paymentId || 'N/A';

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  console.log('updateOrderStatus hit', req.params, req.body);
  try {
    const { productId, status } = req.body;
    const { orderId } = req.params;
    console.log("Order id",JSON.stringify(orderId))
    console.log('Received productId:', productId, 'status:', status);
    
    // Validate status
    const validStatuses = ['ordered', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    console.log(orderId)
    const order = await Order.findOne({orderId:orderId});
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    console.log('123893921',order)
    const item = order.orderItems.find(item => item.ord_id.toString() === productId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }
    console.log("www",item)
    item.status = status;
    await order.save();

    res.status(200).json({ message: 'Item status updated successfully' });
  } catch (error) {
    console.error('Error updating item status:', error.stack);
    res.status(500).json({ message: 'An error occurred while updating the status.' });
  }
};




exports.updateAllItemsStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId } = req.params;
    const { status, productIds } = req.body;

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let orderStatus = status;
    for (const item of order.orderItems) {
      if (productIds.includes(item._id.toString()) && !['cancelled', 'returned'].includes(item.status)) {
        if (status === 'cancelled') {
          const product = await Product.findById(item.product).session(session);
          if (product) {
            product.quantity += item.quantity;
            await product.save({ session });
          }
        }
        item.status = status;
      }
    }

    const allItemsSameStatus = order.orderItems.every(item => item.status === status || ['cancelled', 'returned'].includes(item.status));
    if (allItemsSameStatus) {
      order.status = status;
    } else if (order.orderItems.some(item => item.status === 'cancelled')) {
      order.status = 'cancelled';
    } else if (order.orderItems.some(item => item.status === 'returned')) {
      order.status = 'returned';
    }

    if (!order.history) order.history = [];
    order.history.push({
      status,
      timestamp: new Date(),
      notes: `Updated ${productIds.length} items to ${status}`,
      updatedBy: req.session.admin ? req.session.admin.username : 'Admin',
    });

    if (!order.timeline) order.timeline = [];
    order.timeline.push({
      label: status,
      completed: true,
      date: new Date(),
    });

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, message: `Updated ${productIds.length} items to ${status}`, orderStatus });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error updating items status:', error.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.acceptReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { orderId, productId } = req.body;
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.orderItems.find(item => item._id.toString() === productId);
    if (!item || item.status !== 'Return Requested') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid item or status' });
    }

    item.status = 'returned';
    const product = await Product.findById(item.product).session(session);
    if (product) {
      product.quantity += item.quantity;
      await product.save({ session });
    }

    const allItemsReturnedOrCancelled = order.orderItems.every(item => ['returned', 'cancelled'].includes(item.status));
    order.status = allItemsReturnedOrCancelled ? 'returned' : order.status;

    if (!order.history) order.history = [];
    order.history.push({
      status: 'returned',
      timestamp: new Date(),
      notes: `Return accepted for product ${item.productName}`,
      updatedBy: req.session.admin ? req.session.admin.username : 'Admin',
    });

    if (!order.timeline) order.timeline = [];
    order.timeline.push({
      title: 'Returned',
      text: `Return accepted for ${item.productName}`,
      date: new Date(),
      completed: true,
    });

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, message: 'Return accepted successfully', orderStatus: order.status });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error accepting return:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.rejectReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId, productId } = req.body;
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.orderItems.find(item => item._id.toString() === productId);
    if (!item || item.status !== 'Return Requested') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid item or status' });
    }

    item.status = 'delivered';

    if (!order.history) order.history = [];
    order.history.push({
      status: 'delivered',
      timestamp: new Date(),
      notes: `Return rejected for product ${item.productName}`,
      updatedBy: req.session.admin ? req.session.admin.username : 'Admin',
    });

    if (!order.timeline) order.timeline = [];
    order.timeline.push({
      title: 'Delivered',
      text: `Return rejected for ${item.productName}`,
      date: new Date(),
      completed: true,
    });

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, message: 'Return rejected successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error rejecting return:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};