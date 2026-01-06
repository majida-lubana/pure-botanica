import mongoose from 'mongoose';
import Product from '../../models/productSchema.js';
import User from '../../models/userSchema.js';
import Order from '../../models/orderSchema.js';
import Transaction from '../../models/transactionSchema.js';
import { creditWallet } from '../../utils/walletUtils.js';
import calculatePricing from '../../utils/calculatePricing.js';
import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js'; 

const computeOrderStatus = (orderItems) => {
  const statuses = orderItems.map((i) => i.status);

  const allDelivered = statuses.every((s) => s === "delivered");
  const allCancelled = statuses.every((s) => s === "cancelled");
  const allReturned = statuses.every((s) => s === "returned");

  const hasDelivered = statuses.includes("delivered");
  const hasCancelled = statuses.includes("cancelled");
  const hasReturned = statuses.includes("returned");
  const hasReturnRequested = statuses.includes("return requested");
  const hasReturnRejected = statuses.includes("return rejected");
  const hasShipped = statuses.includes("shipped");

  if (allDelivered) return "delivered";
  if (allCancelled) return "cancelled";
  if (allReturned) return "returned";
  if (hasReturned && !allReturned) return "partially_returned";
  if (hasCancelled && !allCancelled) return "partially_cancelled";
  if (hasReturnRequested) return "return_requested";
  if (hasReturnRejected) return "return_rejected";
  if (hasShipped) return "shipped";
  if (hasDelivered && !allDelivered) return "processing";

  return "pending";
};

const updateOrderStatus = async (order, session = null) => {
  const newStatus = computeOrderStatus(order.orderItems);

  if (order.status !== newStatus) {
    order.status = newStatus;

    const labelExists = order.timeline.some((t) =>
      t.label.toLowerCase().includes(newStatus.toLowerCase())
    );

    if (!labelExists) {
      order.timeline.push({
        label: `Order ${
          newStatus.charAt(0).toUpperCase() + newStatus.slice(1)
        }`,
        completed: ["delivered", "cancelled", "returned"].includes(newStatus),
        current: true,
        date: new Date(),
      });
    }

    order.timeline.forEach((step, idx, arr) => {
      step.current = idx === arr.length - 1;
    });
  }

  await order.save({ session });

  if (newStatus === 'delivered' && order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
    await order.save({ session });
  }
};

const getDisplayPaymentStatus = (order) => {
  if (order.paymentStatus === 'paid') return 'Paid';
  if (order.paymentStatus === 'failed') return 'Failed';
  if (order.paymentStatus === 'pending' && ['payment_pending', 'payment_failed'].includes(order.status)) {
    return order.status === 'payment_failed' ? 'Failed' : 'Pending';
  }
  
  if (order.paymentMethod === 'wallet' && order.paidViaWallet) return 'Paid';
  if (order.paymentMethod === 'cod') {
    return order.status === 'delivered' ? 'Paid' : 'Pending';
  }
  
  if (['razorpay', 'online'].includes(order.paymentMethod)) {
    return order.paymentStatus === 'paid' ? 'Paid' : 
           order.paymentStatus === 'failed' ? 'Failed' : 'Pending';
  }
  
  return 'Pending';
};

const canRetryPayment = (order) => {
  const isPaymentPendingOrFailed = ['payment_pending', 'payment_failed'].includes(order.status);
  const isOnlinePayment = ['razorpay', 'online'].includes(order.paymentMethod);
  const hasNotExpired = !order.paymentRetryExpiry || new Date() < new Date(order.paymentRetryExpiry);
  
  return isPaymentPendingOrFailed && isOnlinePayment && hasNotExpired;
};

/* -------------------------------------------------------------------------- */
/*                              ORDERS LIST PAGE                              */
/* -------------------------------------------------------------------------- */
export const loadOrderPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId).select("avatar name email phone");
    if (!user) return res.status(STATUS.NOT_FOUND).send(MESSAGES.AUTH.USER_NOT_FOUND || "User not found");

    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const filter = { user: userId };

    if (req.query.search && req.query.search.trim() !== "") {
      const searchTerm = req.query.search.trim();
      const searchRegex = { $regex: searchTerm, $options: "i" };

      const productSearch = { "orderItems.productName": searchRegex };
      const statusSearch = { status: searchRegex };

      filter.$or = [productSearch, statusSearch];
    }

    const validStatuses = ["processing", "completed"];
    if (
      req.query.status &&
      req.query.status !== "" &&
      validStatuses.includes(req.query.status)
    ) {
      filter.status = req.query.status;
    }

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(filter)
      .select(
        "orderId createdOn status finalAmount paymentMethod paymentId paymentStatus paymentRetryExpiry orderItems paidViaWallet"
      )
      .populate({
        path: "orderItems.product",
        select: "productName productImages",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    
    if (orders.length === 0 && page > 1) {
      return res.redirect(`/orders?page=${page - 1}&search=${req.query.search || ''}&status=${req.query.status || ''}`);
    }

    for (const order of orders) {
      const newStatus = computeOrderStatus(order.orderItems);
      if (order.status !== newStatus && !['payment_pending', 'payment_failed'].includes(order.status)) {
        order.status = newStatus;
        await Order.updateOne({ _id: order._id }, { status: newStatus });
      }
    }

    const message =
      orders.length === 0 ? MESSAGES.ORDER.NO_ORDERS_FOUND || "No orders found for selected filter" : null;

    res.render("user/orders", {
      user: {
        avatar: user.avatar || "/default-avatar.jpg",
        name: user.name || "User Name",
        email: user.email || "user@example.com",
        phone: user.phone || "+1234567890",
      },
      orders: orders.map((order) => ({
        _id: order._id,
        orderID: order.orderId,
        createdAt: order.createdOn,
        paymentStatus: getDisplayPaymentStatus(order),
        canRetryPayment: canRetryPayment(order),
        status: order.status || "processing",
        finalAmount: order.finalAmount || 0,
        orderItems: order.orderItems.map((item) => ({
  productId: item.product?._id,
  productName: item.productName || item.product?.productName || "Unknown Product",
  productImages: item.product?.productImages || [],
})),
      })),
      message,
      filters: req.query,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (err) {
    console.error("Error loading orders page:", err);
    res.status(STATUS.INTERNAL_ERROR).render('user/page-404', {
      message: MESSAGES.ORDER.LOAD_FAILED || "Internal Server Error",
      pageTitle: 'Error'
    });
  }
};

export const getOrderDetailsPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/user/login");
    }

    const orderId = req.params.orderId;
    const query = mongoose.Types.ObjectId.isValid(orderId)
      ? { _id: orderId, user: userId }
      : { orderId: orderId, user: userId };

    const order = await Order.findOne(query)
      .populate("user", "name email")
      .populate({
        path: "orderItems.product",
        select:
          "productName productImages regularPrice salePrice productOffer category",
        populate: { path: "category", select: "categoryOffer" },
      });

    if (!order) {
      return res.status(STATUS.NOT_FOUND).render('user/page-404', {
        message: MESSAGES.ORDER.NOT_FOUND || "Order not found",
        pageTitle: 'Error'
      });
    }

    const computedStatus = computeOrderStatus(order.orderItems);
    if (order.status !== computedStatus && !['payment_pending', 'payment_failed'].includes(order.status)) {
      order.status = computedStatus;
      await order.save();
    }

    let recalculatedSubtotal = 0;
    let originalSubtotal = 0;

    const items = order.orderItems.map((item) => {
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

      let imagePath = "/images/placeholder.jpg";

if (item.productImage) {
  imagePath = item.productImage.startsWith("http")
    ? item.productImage
    : `/uploads/product-images/${item.productImage}`;
} else if (product?.productImages?.[0]) {
  imagePath = product.productImages[0].startsWith("http")
    ? product.productImages[0]
    : `/uploads/product-images/${product.productImages[0]}`;
}


      return {
        productId: product?._id || item.product,
        productName:
          item.productName || product?.productName || "Unknown Product",
        purchasePrice: displayPrice,
        originalPrice,
        quantity: item.quantity,
        productImage: imagePath,
        productStatus: item.status || "Unknown",
      };
    });

    const offerDiscount = Number(
      (originalSubtotal - recalculatedSubtotal).toFixed(2)
    );
    const couponDiscount = order.couponDiscount || 0;
    const totalDiscount = Number((offerDiscount + couponDiscount).toFixed(2));

    const shipping = order.shipping || 0;
    const tax = order.tax || 0;
    const finalAmount = Number(
      (recalculatedSubtotal - couponDiscount + shipping + tax).toFixed(2)
    );

    const timelineSteps = (order.timeline || []).map((step) => ({
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
      paymentMethod: order.paymentMethod || "N/A",
      paymentStatus: getDisplayPaymentStatus(order),
      canRetryPayment: canRetryPayment(order),
      paymentRetryExpiry: order.paymentRetryExpiry,
      transactionId: order.paymentId || "N/A",
      shippingAddress: {
        name: order.address.fullName,
        address: order.address.address,
        city: order.address.city,
        state: order.address.state,
        country: order.address.country || "India",
        pinCode: order.address.pincode || order.address.pinCode,
        phone: order.address.phone,
        addressType: order.address.addressType,
      },
      user: order.user || { name: "N/A", email: "N/A" },
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

      message: order.message || "",
    };

    res.render("user/order-details", {
      order: orderData,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(STATUS.INTERNAL_ERROR).render('user/page-404', {
      message: MESSAGES.ORDER.LOAD_FAILED || "Internal Server Error",
      pageTitle: 'Error'
    });
  }
};

export const cancelItem = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.UNAUTHORIZED || "Unauthorized"
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ORDER.INVALID_ID || "Invalid order or product ID"
      });
    }

    const order = await Order.findById(orderId);
    if (!order || order.user.toString() !== userId) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ORDER.NOT_FOUND || "Order not found or unauthorized"
      });
    }

    const item = order.orderItems.find(
      (i) => i.product.toString() === productId
    );
    if (!item) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ORDER.ITEM_NOT_FOUND || "Item not found in order"
      });
    }

    if (!["pending", "ordered"].includes(item.status)) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ORDER.CANNOT_CANCEL || `Item cannot be cancelled (current status: ${item.status})`
      });
    }

    item.status = "cancelled";

    await Product.findByIdAndUpdate(item.product, {
      $inc: { quantity: item.quantity },
    });

    if (order.paymentStatus === 'paid' || order.paidViaWallet) {
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
      notes: `Reason: ${reason || "No reason provided"}`,
    });

    await updateOrderStatus(order);
    await order.save();

    res.json({
      success: true,
      message: MESSAGES.ORDER.ITEM_CANCELLED || "Item cancelled successfully",
      orderStatus: order.status,
    });
  } catch (error) {
    console.error("Error cancelling item:", error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || "Failed to cancel item"
    });
  }
};

export const returnItem = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.UNAUTHORIZED || "Unauthorized"
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ORDER.NOT_FOUND || "Order not found"
      });
    }

    const item = order.orderItems.find(
      (item) => item.product.toString() === productId
    );
    if (!item || item.status !== "delivered") {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ORDER.CANNOT_RETURN || "Item cannot be returned"
      });
    }

    const RETURN_EXPIRY_DAYS = 7;
    const deliveryDate = item.deliveryDate
      ? new Date(item.deliveryDate)
      : new Date(order.createdOn);
    const expiryDate = new Date(deliveryDate);
    expiryDate.setDate(deliveryDate.getDate() + RETURN_EXPIRY_DAYS);

    if (new Date() > expiryDate) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ORDER.RETURN_EXPIRED || "Return period has expired"
      });
    }

    item.status = "return requested";

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
      type: "refund",
      status: "pending",
      description: `Return Request - ${item.productName} (Order #${order.orderId})`,
      itemId: item._id,
    });

    await updateOrderStatus(order);
    await order.save();

    res.json({
      success: true,
      message: MESSAGES.ORDER.RETURN_REQUESTED || "Return request submitted. Refund pending admin approval.",
      orderStatus: order.status,
    });
  } catch (error) {
    console.error("Error requesting return:", error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || "Internal Server Error"
    });
  }
};


export default {
  loadOrderPage,
  getOrderDetailsPage,
  cancelItem,
  returnItem
};