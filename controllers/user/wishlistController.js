const mongoose = require('mongoose')
const WishList = require('../../models/wishlistSchema')
const Product = require('../../models/productSchema')
const User = require('../../models/userSchema');



exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user?._id;

    const wishlistDoc = await WishList.findOne({ user: userId })
      .populate({
        path: 'products.productId',
        select: 'productName productImages regularPrice salePrice quantity status',
      });

    const items = wishlistDoc
      ? wishlistDoc.products
          .filter(p => p.productId && p.productId.status !== 'Deleted') // Filter out deleted
          .map(p => {
            const prod = p.productId;

            const images = Array.isArray(prod.productImages)
              ? prod.productImages
              : [];

            return {
              product: {
                _id: prod._id,
                name: prod.productName || 'Unknown Product',     // Correct
                images,                                           // Correct
                price: prod.regularPrice || 0,                    // Correct
                salePrice: prod.salePrice ?? prod.regularPrice ?? 0, // Correct
                stock: prod.quantity ?? 0,                        // Correct
              },
              addedOn: p.addedOn,
            };
          })
      : [];

    // Auto-remove deleted products from wishlist
    if (wishlistDoc && items.length !== wishlistDoc.products.length) {
      const validIds = items.map(i => i.product._id);
      await WishList.updateOne(
        { user: userId },
        { $pull: { products: { productId: { $nin: validIds } } } }
      );
    }

    res.render('user/wishlist', {
      wishlist: items,
      user: req.user,
    });
  } catch (err) {
    console.error('getWishlist error:', err);
    res.status(500).send('Server Error');
  }
};


// ---------------------------------------------------------------------
// 2. POST /wishlist/toggle   →  add or remove
// ---------------------------------------------------------------------
exports.toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let wishlist = await WishList.findOne({ user: userId });
    if (!wishlist) {
      wishlist = await WishList.create({ user: userId, products: [] });
    }

    const idx = wishlist.products.findIndex(
      p => p.productId.toString() === productId
    );

    let added = false;
    if (idx === -1) {
      wishlist.products.push({ productId });
      added = true;
    } else {
      wishlist.products.splice(idx, 1);
    }

    await wishlist.save();

    res.json({ success: true, added });
  } catch (error) {
    console.error('toggleWishlist error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// ---------------------------------------------------------------------
// 3. POST /wishlist/remove   →  remove single item
// ---------------------------------------------------------------------
exports.removeFromWishList = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const wishlist = await WishList.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    const idx = wishlist.products.findIndex(
      p => p.productId.toString() === productId
    );

    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Product not in wishlist' });
    }

    wishlist.products.splice(idx, 1);
    await wishlist.save();

    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    console.error('removeFromWishList error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// ---------------------------------------------------------------------
// 4. GET /wishlist/count   →  JSON count (for header badge)
// ---------------------------------------------------------------------
exports.getWishListCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlist = await WishList.findOne({ user: userId });
    const count = wishlist ? wishlist.products.length : 0;

    res.json({ success: true, count });
  } catch (error) {
    console.error('getWishListCount error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// ---------------------------------------------------------------------
// 5. POST /wishlist/clear   →  empty the whole list
// ---------------------------------------------------------------------
exports.clearWishList = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await WishList.deleteOne({ user: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    res.json({ success: true, message: 'Wishlist cleared' });
  } catch (error) {
    console.error('clearWishList error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};