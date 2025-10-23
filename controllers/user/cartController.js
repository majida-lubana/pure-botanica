const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Category = require('../../models/categorySchema');
const Address = require('../../models/addressSchema');

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
      cart.items = cart.items.filter(item=>item.productId)
      totalItems = cart.items.length;
      cart.items = cart.items.reverse();
      paginatedItems = cart.items.slice(skip, skip + limit);

      let cartUpdated  = false
      for(item of cart.items){
        if(item.productId.quantity<item.quantity){
          item.quantity = Math.max(item.productId.quantity,0)
          cartUpdated = true
        }

      }

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


exports.checkCartQuantity = async(req,res)=>{
  try{

  }catch(err){

  }
}

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user?._id; 

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login to add products to your cart.',
        redirectUrl: '/login',
      });
    }
  
    const qty = parseInt(quantity) || 1;
    if (!productId || qty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID or quantity.',
      });
    }

    
    const product = await Product.findOne({
      _id: productId,
      status: 'Available',
      isActive: true,
      isBlocked: false,
    }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unavailable.',
      });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock.',
      });
    }


    const totalPrice = product.salePrice * qty;

  
    let cart = await Cart.findOne({ userId });

    if (cart) {
     
      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (itemIndex > -1) {
 
        cart.items[itemIndex].quantity += quantity;
        cart.items[itemIndex].totalPrice =
        cart.items[itemIndex].quantity * product.salePrice;
        cart.items[itemIndex].updatedAt = new Date();
      } else {

        cart.items.push({
          productId,
          quantity,
          price: product.salePrice,
          totalPrice,
          status: 'Placed',
        });
      }
    } else {

      cart = new Cart({
        userId,
        items: [
          {
            productId,
            quantity,
            price: product.salePrice,
            totalPrice,
            status: 'Placed',
          },
        ],
      });
    }


    await cart.save();


    await User.findByIdAndUpdate(userId, {
      $addToSet: { cart: cart._id },
    });


    const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    return res.json({
      success: true,
      message: 'Product added to cart!',
      cartCount,
    });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while adding the product to the cart.',
    });
  }
};


exports.updateCartQuantity = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

    const { productId, action } = req.body;
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' },
    });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const cartItem = cart.items.find(item => item.productId._id.toString() === productId); 
    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    const product = await Product.findById(productId);
    const availableStock = product.quantity;
    const maxAllowed = Math.min(availableStock);

    if (action === 'increase') {
      if (cartItem.quantity < maxAllowed) {
        cartItem.quantity += 1;
      } else {
        return res.status(400).json({
          success: false,
          message: availableStock <= product.stock ? `Only ${availableStock} available` : 'Maximum limit reached',
        });
      }
    } else if (action === 'decrease' && cartItem.quantity > 1) {
      cartItem.quantity -= 1;
    } else if (action === 'decrease' && cartItem.quantity === 1) {
      return res.status(400).json({ success: false, message: 'Minimum quantity is 1. Use remove to delete.' });
    }

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
    console.error('Error updating cart:', error.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
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
    const cartItem = cart?.items.find(item => item.productId.toString() === productId); // Changed from item.product
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
