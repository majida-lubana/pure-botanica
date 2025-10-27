const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');

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
        if (!item.product) console.warn(`Order ${order.orderId} has an item with no valid product reference. Product ID: ${item.product}`);
        item.displayName = item.productName || (item.product?.productName || 'Unknown Product');
        item.displayImage = item.productImage || (item.product?.productImages?.[0] ? `/uploads/product-images/${item.product.productImages[0]}` : '/default-image.jpg');
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

exports.updateOrderStatus = async (req, res) => {
  console.log('updateOrderStatus hit', req.params, req.body);
  try {
    const { itemId, status } = req.body;
    const { orderId } = req.params;

    const validStatuses = ['ordered', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const item = order.orderItems.find(item => item.ord_id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }

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
    } else if (action === 'rejected') {
      item.status = 'return rejected';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }


    await updateOrderStatus(order);
    console.log("Order saved");

    return res.status(200).json({
      success: true,
      message: `Return request ${action}ed successfully`,
      orderStatus: order.status   // ← For live update
    });
  } catch (error) {
    console.error('Error verifying return:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
};