const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const WishList = require("../../models/wishlistSchema");
const { calculatePricing } = require('../../utils/calculatePricing')

exports.loadShopPage = async (req, res) => {
  try {
    let {
      search = "",
      sort = "default",
      category,
      skinType,
      skinConcern,
      minPrice = 0,
      maxPrice = 10000,
      page = 1,
      limit = 12,
    } = req.query;

    search = typeof search === "string" ? search.trim() : "";

    const categoriesQuery = Array.isArray(category) ? category : category ? [category] : [];
    const skinTypes = Array.isArray(skinType) ? skinType : skinType ? [skinType] : [];
    const skinConcerns = Array.isArray(skinConcern) ? skinConcern : skinConcern ? [skinConcern] : [];

    const query = {
      status: "Available",
      isActive: true,
      isBlocked: false,
    };

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    if (categoriesQuery.length && !categoriesQuery.includes("all")) {
      const catDocs = await Category.find({
        categoryName: { $in: categoriesQuery.map(c => c.toLowerCase()) },
        isListed: true,
      });
      if (catDocs.length) query.category = { $in: catDocs.map(c => c._id) };
    }

    if (skinTypes.length && !skinTypes.includes("all")) query.skinType = { $in: skinTypes };
    if (skinConcerns.length && !skinConcerns.includes("all")) query.skinConcern = { $in: skinConcerns };

    query.salePrice = { $gte: +minPrice || 0, $lte: +maxPrice || 10000 };

    let sortOption = {};
    switch (sort) {
      case "price-asc": sortOption = { salePrice: 1 }; break;
      case "price-desc": sortOption = { salePrice: -1 }; break;
      case "name-asc": sortOption = { productName: 1 }; break;
      case "name-desc": sortOption = { productName: -1 }; break;
      default: sortOption = { createdAt: -1 };
    }

    const pageNum = +page || 1;
    const limitNum = +limit || 12;
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(query)
      .populate("category")
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const productsWithPricing = products.map(p => ({
      ...p,
      pricing: calculatePricing(p)
    }));

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limitNum) || 1;

    const categories = await Category.find({ isListed: true }).lean();

    const skinTypeOptions = ["Oily","Dry","Combination","Sensitive","Normal","All Skin Types"];
    const skinConcernOptions = ["Acne","Dryness","Oiliness","Aging","Pigmentation","Sensitivity"];

    // ----- Wishlist -----
    let wishlistProductIds = [];
    if (req.user?._id) {
      const wl = await WishList.findOne({ user: req.user._id }).lean();
      if (wl?.products?.length) wishlistProductIds = wl.products.map(i => i.productId.toString());
    }

    res.render("user/shop", {
      user: req.user || null,
      products: productsWithPricing,
      categories,
      skinTypeOptions,
      skinConcernOptions,
      currentPage: pageNum,
      totalPages,
      totalProducts,
      selectedCategories: categoriesQuery,
      selectedSkinTypes: skinTypes,
      selectedSkinConcerns: skinConcerns,
      minPrice,
      maxPrice,
      search,
      sort,
      wishlistProductIds,
    });
  } catch (error) {
    console.error("loadShopPage error:", error);
    res.status(500).render("pageNotFound", { message: "Shop page error" });
  }
};

/* ------------------------------------------------------------------ */
/* -------------------------- AJAX API ------------------------------- */
/* ------------------------------------------------------------------ */
exports.getProductsApi = async (req, res) => {
  try {
    let {
      search = "",
      sort = "default",
      category,
      skinType,
      skinConcern,
      minPrice = 0,
      maxPrice = 10000,
      page = 1,
      limit = 12,
    } = req.query;

    search = typeof search === "string" ? search.trim() : "";

    const categoriesQuery = Array.isArray(category) ? category : category ? [category] : [];
    const skinTypes = Array.isArray(skinType) ? skinType : skinType ? [skinType] : [];
    const skinConcerns = Array.isArray(skinConcern) ? skinConcern : skinConcern ? [skinConcern] : [];

    const query = {
      status: "Available",
      isActive: true,
      isBlocked: false,
    };

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    if (categoriesQuery.length && !categoriesQuery.includes("all")) {
      const catDocs = await Category.find({
        categoryName: { $in: categoriesQuery.map(c => c.toLowerCase()) },
        isListed: true,
      });
      if (catDocs.length) query.category = { $in: catDocs.map(c => c._id) };
    }

    if (skinTypes.length && !skinTypes.includes("all")) query.skinType = { $in: skinTypes };
    if (skinConcerns.length && !skinConcerns.includes("all")) query.skinConcern = { $in: skinConcerns };

    query.salePrice = { $gte: +minPrice || 0, $lte: +maxPrice || 10000 };

    let sortOption = {};
    switch (sort) {
      case "price-asc": sortOption = { salePrice: 1 }; break;
      case "price-desc": sortOption = { salePrice: -1 }; break;
      case "name-asc": sortOption = { productName: 1 }; break;
      case "name-desc": sortOption = { productName: -1 }; break;
      default: sortOption = { createdAt: -1 };
    }

    const pageNum = +page || 1;
    const limitNum = +limit || 12;
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(query)
      .populate("category")
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // ---- Add pricing & wishlist flag ----
    let wishlistIds = [];
    if (req.user?._id) {
      const wl = await WishList.findOne({ user: req.user._id }).lean();
      if (wl?.products?.length) wishlistIds = wl.products.map(i => i.productId.toString());
    }

    const productsWithPricing = products.map(p => ({
      ...p,
      pricing: calculatePricing(p),
      isInWishlist: wishlistIds.includes(p._id.toString())
    }));

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limitNum) || 1;

    res.json({
      products: productsWithPricing,
      totalProducts,
      totalPages,
      currentPage: pageNum,
    });
  } catch (error) {
    console.error("getProductsApi error:", error);
    res.status(500).json({ error: "Failed to load products" });
  }
};

/* ------------------------------------------------------------------ */
exports.checkProductAvailability = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      status: "Available",
      isActive: true,
      isBlocked: false,
    }).select("quantity");
    res.json({ available: !!product && product.quantity > 0, quantity: product?.quantity || 0 });
  } catch (error) {
    console.error(error);
    res.json({ available: false, quantity: 0 });
  }
};

exports.loadProductPage = async (req, res) => {
  try {
    const productId = req.params.id;
    console.log("Loading product page for ID:", productId);
    const product = await Product.findOne({
      _id: productId,
      status: "Available",
      isActive: true,
      isBlocked: false,
    })
      .populate("category")
      .lean();

    if (!product) {
      console.log("Product not found or unavailable:", productId);
      return res.status(404).render("pageNotFound", {
        pageTitle: "Product Not Found",
        message: "The product you are looking for is not available.",
      });
    }

    // ===== OFFER CALCULATION =====
    let offerPercent = 0;
    let appliedOfferName = null;

    // Check product-level offer (assuming field: productOffer as %)
    if (product.productOffer && product.productOffer > 0) {
      offerPercent = product.productOffer;
      appliedOfferName = "Product Offer";
    }

    // Optional: Add category offer later
    // if (!offerPercent && product.category?.categoryOffer > 0) {
    //   offerPercent = product.category.categoryOffer;
    //   appliedOfferName = "Category Offer";
    // }

    // Base price (use salePrice if set, else regularPrice)
    const basePrice = product.salePrice && product.salePrice < product.regularPrice
      ? product.salePrice
      : product.regularPrice;

    // Final calculations
    const discountAmount = (basePrice * offerPercent) / 100;
    const finalPrice = basePrice - discountAmount;

    // Attach pricing object for EJS
    product.pricing = calculatePricing(product);

   const discountsApplied = product.pricing.isOnOffer
  ? `${product.pricing.discountPercentage}% ${product.pricing.offerSource === 'category' ? 'Category' : 'Product'} Offer`
  : "";

    // ===== RELATED PRODUCTS (with same offer logic) =====
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      status: "Available",
      isActive: true,
      isBlocked: false,
    })
      .populate('category')
      .limit(4)
      .lean();

    // Apply same pricing logic to each related product
relatedProducts.forEach(rel => {
  rel.pricing = calculatePricing(rel);
});

    const wishlistProductIds = req.user?.wishlist
      ? req.user.wishlist.map((w) => w.product.toString())
      : [];

    res.render("user/product-details", {
      product,
      relatedProducts,
      wishlistProductIds,
      discountsApplied,
      user: req.user,
    });
  } catch (error) {
    console.error("Error loading product page:", error.stack);
    res.status(500).render("pageNotFound", {
      pageTitle: "Error",
      message: "An error occurred while loading the product page.",
    });
  }
};

