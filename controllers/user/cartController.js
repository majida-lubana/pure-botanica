const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');

exports.getCartPage = async (req, res) => {
  try {
    const userId = req.user?._id; 
    if (!userId) {
      return res.status(401).render('user/login', {
        message: 'Please login to view your cart.',
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
    let shippingCost = 0;
    let discount = 0;
    let totalItems = 0;
    let paginatedItems = [];

    if (cart && cart.items && cart.items.length > 0) {
     let cartUpdated = false

      cart.items = cart.items.filter(item=>{
        const p = item.productId;
        return(
          p&&
          p.isActive === true&&
          p.isBlocked === false&&
          p.status === 'Available',
          p.quantity > 0 
        )
      })

      cart.items = cart.items.map(item=>{
        const p = item.productId;
        if(!p) return item

        if(p.quantity===0){
          cartUpdated  = true
          return null;
        }

        if(item.quantity>p.quantity){
          item.quantity = p.quantity
          cartUpdated = true
        }
        return item
      }) .filter(item=>item!==null)
      totalItems = cart.items.length;
      cart.items = cart.items.reverse();
      paginatedItems = cart.items.slice(skip, skip + limit);

      

      
      if(cartUpdated){
        await cart.save()
      }

      
      subtotal = cart.items.reduce((sum, item) => {
        if (item.productId && item.productId.salePrice) {
          const salePrice = item.productId.salePrice||0
          const regularPrice = item.productId.regularPrice || salePrice;
          discount += (regularPrice - salePrice) * item.quantity;
          return sum + (salePrice * item.quantity);
        }
        return sum;
      }, 0);

      shippingCost = subtotal > 1000 ? 0 : 50;
    } else {
      cart = { items: [], userId }; 
    }

    const tax = subtotal * 0.1;
    const total = subtotal - discount + shippingCost + tax;

      const excludedIds = cart.items
      .map((item) => item.productId?._id)
      .filter(Boolean);
    const relatedProducts =
      cart && cart.items.length > 0
        ? await Product.find({
            category: cart.items[0]?.productId?.category?._id,
            _id: { $nin: cart.items.map((item) => item.productId?._id).filter(Boolean) },
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
      cart: cart || { items: [], userId }, 
      user: req.user,
      subtotal,
      shippingCost,
      tax,
      total,
      discount,
      relatedProducts,
      pagination,
      pageTitle: 'Your Shopping Cart', 
    });
  } catch (error) {
    console.error('Error loading cart page:', error.stack);
    res.status(500).render('user/page-404', {
      message: 'An error occurred while loading the cart page.',
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
    res.status(500).json({ count: 0 });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login to add products to your cart.',
        redirectUrl: '/login',
      });
    }

    const qty = parseInt(quantity, 10);
    if (!productId || qty < 1) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }


    const product = await Product.findOne({
      _id: productId,
      status: 'Available',
      isActive: true,
      isBlocked: false,
    }).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product unavailable' });
    }

    if (product.quantity < qty) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} unit(s) left in stock`,
      });
    }


    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });


    const existingIdx = cart.items.findIndex(i => i.productId.toString() === productId);
    const currentQty = existingIdx > -1 ? cart.items[existingIdx].quantity : 0;
    const newQty = currentQty + qty;

 
    if (newQty > MAX_PER_PRODUCT) {
      return res.status(400).json({
        success: false,
        message: `You can only purchase up to ${MAX_PER_PRODUCT} units of this product`,
      });
    }


    if (existingIdx > -1) {
      cart.items[existingIdx].quantity = newQty;
      cart.items[existingIdx].totalPrice = newQty * product.salePrice;
    } else {
      cart.items.push({
        productId,
        quantity: newQty,
        price: product.salePrice,
        totalPrice: newQty * product.salePrice,
        status: 'Placed',
      });
    }

    await cart.save();

    await User.findByIdAndUpdate(userId, { $addToSet: { cart: cart._id } });

    const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);

    return res.json({
      success: true,
      message: 'Product added to cart!',
      cartCount,
    });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.updateCartQuantity = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const { productId, action } = req.body;       
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' },
    });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const cartItem = cart.items.find(i => i.productId._id.toString() === productId);
    if (!cartItem) return res.status(404).json({ success: false, message: 'Item not in cart' });

    const product = cartItem.productId;
    const stock = product.quantity;
    const currentQty = cartItem.quantity;

    let newQty = currentQty;
    if (action === 'increase') newQty++;
    else if (action === 'decrease') newQty--;

 
    if (newQty < 1) {
      return res.status(400).json({ success: false, message: 'Quantity cannot be less than 1' });
    }


    if (newQty > stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock} unit(s) available`,
      });
    }


    if (newQty > MAX_PER_PRODUCT) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_PER_PRODUCT} units allowed per product`,
      });
    }

    cartItem.quantity = newQty;
    await cart.save();

 
    const subtotal = cart.items.reduce((s, i) => s + i.productId.salePrice * i.quantity, 0);
    const discount = cart.items.reduce((s, i) => {
      const reg = i.productId.regularPrice || i.productId.salePrice;
      return s + (reg - i.productId.salePrice) * i.quantity;
    }, 0);
    const shippingCost = subtotal > 1000 ? 0 : 50;
    const tax = subtotal * 0.1;
    const total = subtotal - discount + shippingCost + tax;

    res.json({
      success: true,
      subtotal,
      discount,
      shippingCost,
      tax,
      total,
      cartCount: cart.items.reduce((s, i) => s + i.quantity, 0),
    });
  } catch (error) {
    console.error('updateCartQuantity error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

    const { productId } = req.body;
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId', 
      populate: { path: 'category' },
    });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.productId._id.toString() !== productId);
    await cart.save();

    const subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.productId.salePrice * item.quantity);
    }, 0);
    const discount = cart.items.reduce((sum, item) => {
      const regularPrice = item.productId.regularPrice || item.productId.salePrice; 
      return sum + (regularPrice - item.productId.salePrice) * item.quantity; 
    }, 0);
    const shippingCost = subtotal > 1000 ? 0 : 50;
    const tax = subtotal * 0.1;
    const total = subtotal - discount + shippingCost + tax;

    res.json({
      success: true,
      subtotal,
      shippingCost,
      tax,
      total,
      discount,
      cartCount: cart.items.length,
    });
  } catch (error) {
    console.error('Error removing from cart:', error.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getCartContents = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send('');
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId', 
      populate: { path: 'category' },
    });

    if (!cart || !cart.items.length) {
      return res.send('<p class="text-gray-500">Your cart is empty</p>');
    }

    let html = '';
    cart.items.forEach(item => {
      const salePrice = item.productId?.salePrice || 0;
      html += `
        <div class="flex items-center justify-between py-2">
          <div class="flex items-center">
            <img src="/Uploads/product-images/${item.productId?.productImages?.[0] || ''}" 
                 alt="${item.productId?.productName || 'Product'}" 
                 class="w-12 h-12 object-cover rounded mr-2" 
                 onerror="this.src='/images/placeholder.jpg'">
            <span>${item.productId?.productName || 'Unnamed Product'}</span>
          </div>
          <span>₹${(salePrice * item.quantity).toFixed(2)} (x${item.quantity})</span>
        </div>
      `;
    });
    res.send(html);
  } catch (error) {
    console.error('Error fetching cart contents:', error.stack);
    res.status(500).send('<p class="text-red-500">Error loading cart</p>');
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
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCartSummary = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' },
    });

    let subtotal = 0;
    let shippingCost = 50;
    let discount = 0;

    if (cart && cart.items && cart.items.length > 0) {

      cart.items  = cart.items.filter(item=>item.productId)
      
      subtotal = cart.items.reduce((sum, item) => {
        if (item.productId && item.productId.salePrice) { 
          return sum + (item.productId.salePrice * item.quantity); 
        }
        return sum;
      }, 0);
      discount = cart.items.reduce((sum, item) => {
        const regularPrice = item.productId.regularPrice || item.productId.salePrice; 
        return sum + (regularPrice - item.productId.salePrice) * item.quantity; 
      }, 0);
      shippingCost = subtotal > 1000 ? 0 : 50;
    } else {
      shippingCost = 0;
    }

    const tax = subtotal * 0.1;
    const total = subtotal - discount + shippingCost + tax;

    res.json({
      success: true,
      subtotal,
      shippingCost,
      tax,
      total,
      discount,
      cartCount: cart?.items.length || 0,
    });
  } catch (error) {
    console.error('Error fetching cart summary:', error.stack);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
