const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const { calculatePricing } = require('../../utils/calculatePricing');
const STATUS = require('../../constants/statusCode');
const MESSAGES = require('../../constants/messages'); // Centralized messages

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

  const discount = originalSubtotal - subtotal;
  const shippingCost = subtotal > 1000 ? 0 : 50;
  const tax = subtotal * 0.1;
  const total = subtotal + shippingCost + tax;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    originalSubtotal: Number(originalSubtotal.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    shippingCost,
    tax: Number(tax.toFixed(2)),
    total: Number(total.toFixed(2))
  };
};

exports.getCartPage = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).render('user/login', {
        message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login to view your cart.',
        pageTitle: 'Login Page',
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    let cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' },
    });

    let subtotal = 0;
    let originalSubtotal = 0;
    let shippingCost = 0;
    let discount = 0;
    let tax = 0;
    let total = 0;
    let totalItems = 0;
    let paginatedItems = [];
    let cartCount = 0;

    if (cart && cart.items && cart.items.length > 0) {
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

      totalItems = cart.items.length;
      cart.items = cart.items.reverse();
      paginatedItems = cart.items.slice(skip, skip + limit);

      cart.items.forEach(item => {
        if (item.productId) {
          item.productId.pricing = calculatePricing(item.productId);
        }
      });

      if (cartUpdated) {
        await cart.save();
      }

      const totals = calculateTotals(cart.items);
      subtotal = totals.subtotal;
      originalSubtotal = totals.originalSubtotal;
      discount = totals.discount;
      shippingCost = totals.shippingCost;
      tax = totals.tax;
      total = totals.total;

      cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    } else {
      cart = { items: [], userId };
      cartCount = 0;
    }

    const excludedIds = cart.items
      .map((item) => item.productId?._id)
      .filter(Boolean);

    const relatedProducts =
      cart && cart.items.length > 0
        ? await Product.find({
            category: cart.items[0]?.productId?.category?._id,
            _id: { $nin: excludedIds },
          }).limit(4)
        : await Product.find().limit(4);

    const totalPages = Math.ceil(totalItems / limit);
    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      totalItems: totalItems,
    };

    res.render('user/cart', {
      cart: { ...cart, items: paginatedItems },
      user: req.user,
      subtotal,
      originalSubtotal,
      shippingCost,
      tax,
      total,
      discount,
      relatedProducts,
      pagination,
      pageTitle: 'Your Shopping Cart',
      cartCount
    });
  } catch (error) {
    console.error('Error loading cart page:', error.stack);
    res.status(STATUS.INTERNAL_ERROR).render('user/page-404', {
      message: MESSAGES.CART.LOAD_FAILED || 'An error occurred while loading the cart page.',
      pageTitle: 'Error',
    });
  }
};

const MAX_PER_PRODUCT = 5;

exports.getCountInCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const cart = await Cart.findOne({ userId: req.user._id });
    const item = cart?.items?.find(i => i.productId.toString() === productId);
    res.json({ count: item ? item.quantity : 0 });
  } catch (e) {
    res.status(STATUS.INTERNAL_ERROR).json({ count: 0 });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login to add products to your cart.',
        redirectUrl: '/login',
      });
    }

    const qty = parseInt(quantity, 10);
    if (!productId || qty < 1) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.CART.INVALID_REQUEST || 'Invalid request'
      });
    }

    const product = await Product.findOne({
      _id: productId,
      status: 'Available',
      isActive: true,
      isBlocked: false,
    }).populate('category').lean();

    if (!product) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.PRODUCT.NOT_AVAILABLE || 'Product unavailable'
      });
    }

    if (product.quantity < qty) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.CART.INSUFFICIENT_STOCK || `Only ${product.quantity} unit(s) left in stock`
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existingIdx = cart.items.findIndex(i => i.productId.toString() === productId);
    const currentQty = existingIdx > -1 ? cart.items[existingIdx].quantity : 0;
    const newQty = currentQty + qty;

    if (newQty > MAX_PER_PRODUCT) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.CART.MAX_PER_PRODUCT || `You can only purchase up to ${MAX_PER_PRODUCT} units of this product`
      });
    }

    const pricing = calculatePricing(product);
    const itemPrice = pricing.displayPrice;

    if (existingIdx > -1) {
      cart.items[existingIdx].quantity = newQty;
      cart.items[existingIdx].totalPrice = newQty * itemPrice;
    } else {
      cart.items.push({
        productId,
        quantity: newQty,
        price: itemPrice,
        totalPrice: newQty * itemPrice,
        status: 'Placed',
      });
    }

    await cart.save();
    await User.findByIdAndUpdate(userId, { $addToSet: { cart: cart._id } });

    const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);

    return res.json({
      success: true,
      message: MESSAGES.CART.ADDED_SUCCESS || 'Product added to cart!',
      cartCount,
    });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    return res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
    });
  }
};

exports.updateCartQuantity = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Login required'
      });
    }

    const { productId, action } = req.body;
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' },
    });

    if (!cart) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.CART.NOT_FOUND || 'Cart not found'
      });
    }

    const cartItem = cart.items.find(i => i.productId._id.toString() === productId);
    if (!cartItem) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.CART.ITEM_NOT_FOUND || 'Item not in cart'
      });
    }

    const product = cartItem.productId;
    const stock = product.quantity;
    const currentQty = cartItem.quantity;

    let newQty = currentQty;
    if (action === 'increase') newQty++;
    else if (action === 'decrease') newQty--;

    if (newQty < 1) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.CART.MIN_QUANTITY || 'Quantity cannot be less than 1'
      });
    }

    if (newQty > stock) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.CART.INSUFFICIENT_STOCK || `Only ${stock} unit(s) available`
      });
    }

    if (newQty > MAX_PER_PRODUCT) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.CART.MAX_PER_PRODUCT || `Maximum ${MAX_PER_PRODUCT} units allowed per product`
      });
    }

    cartItem.quantity = newQty;
    await cart.save();

    cart.items.forEach(item => {
      if (item.productId) {
        item.productId.pricing = calculatePricing(item.productId);
      }
    });

    const totals = calculateTotals(cart.items);

    res.json({
      success: true,
      ...totals,
      cartCount: cart.items.reduce((s, i) => s + i.quantity, 0),
    });
  } catch (error) {
    console.error('updateCartQuantity error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
    });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login'
      });
    }

    const { productId } = req.body;
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' },
    });

    if (!cart) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.CART.NOT_FOUND || 'Cart not found'
      });
    }

    cart.items = cart.items.filter(item => item.productId._id.toString() !== productId);
    await cart.save();

    cart.items.forEach(item => {
      if (item.productId) {
        item.productId.pricing = calculatePricing(item.productId);
      }
    });

    const totals = calculateTotals(cart.items);

    res.json({
      success: true,
      ...totals,
      cartCount: cart.items.reduce((s, i) => s + i.quantity, 0),
    });
  } catch (error) {
    console.error('Error removing from cart:', error.stack);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Internal Server Error'
    });
  }
};

exports.getCartContents = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(STATUS.UNAUTHORIZED).send('');
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' },
    });

    if (!cart || !cart.items.length) {
      return res.send('<p class="text-gray-500">Your cart is empty</p>');
    }

    cart.items.forEach(item => {
      if (item.productId) {
        item.productId.pricing = calculatePricing(item.productId);
      }
    });

    let html = '';
    cart.items.forEach(item => {
      const displayPrice = item.productId?.pricing?.displayPrice || 0;
      html += `
        <div class="flex items-center justify-between py-2">
          <div class="flex items-center">
            <img src="/Uploads/product-images/${item.productId?.productImages?.[0] || ''}" 
                 alt="${item.productId?.productName || 'Product'}" 
                 class="w-12 h-12 object-cover rounded mr-2" 
                 onerror="this.src='/images/placeholder.jpg'">
            <span>${item.productId?.productName || 'Unnamed Product'}</span>
          </div>
          <span>₹${(displayPrice * item.quantity).toFixed(2)} (x${item.quantity})</span>
        </div>
      `;
    });
    res.send(html);
  } catch (error) {
    console.error('Error fetching cart contents:', error.stack);
    res.status(STATUS.INTERNAL_ERROR).send('<p class="text-red-500">Error loading cart</p>');
  }
};

exports.getCartQuantity = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId } = req.body;
    const cart = await Cart.findOne({ userId });
    const cartItem = cart?.items.find(item => item.productId.toString() === productId);
    res.json({ quantity: cartItem ? cartItem.quantity : 0 });
  } catch (error) {
    console.error('Error fetching cart quantity:', error.stack);
    res.status(STATUS.INTERNAL_ERROR).json({
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
    });
  }
};

exports.getCartSummary = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login'
      });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' },
    }) || { items: [] };

    cart.items = cart.items.filter(item => item.productId);

    cart.items.forEach(item => {
      if (item.productId) {
        item.productId.pricing = calculatePricing(item.productId);
      }
    });

    const totals = calculateTotals(cart.items);
    totals.cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);

    res.json({
      success: true,
      ...totals,
    });
  } catch (error) {
    console.error('Error fetching cart summary:', error.stack);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
    });
  }
};