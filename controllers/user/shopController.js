import Product from "../../models/productSchema.js";
import Category from "../../models/categorySchema.js";
import WishList from "../../models/wishlistSchema.js";
import Cart from "../../models/cartSchema.js";
import { calculatePricing } from '../../utils/calculatePricing.js';
import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js'; 

export const loadShopPage = async (req, res) => {
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
      case "price-asc":
        sortOption = { salePrice: 1 };
        break;
      case "price-desc":
        sortOption = { salePrice: -1 };
        break;
      case "name-asc":
        sortOption = { productName: 1 };
        break;
      case "name-desc":
        sortOption = { productName: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
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
    res.status(STATUS.INTERNAL_ERROR).render("user/page-404", {
      message: MESSAGES.SHOP.LOAD_FAILED || "An error occurred while loading the shop.",
      pageTitle: 'Error'
    });
  }
};

export const getProductsApi = async (req, res) => {
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

    let products = await Product.find(query)
      .populate("category",
        "categoryOffer offerStart offerEnd offerActive categoryName"
      )
      .lean();

    let wishlistIds = [];
    let cartProductIds = [];

    if (req.user?._id) {
      const wl = await WishList.findOne({ user: req.user._id }).lean();
      if (wl?.products?.length) wishlistIds = wl.products.map(i => i.productId.toString());

      const cart = await Cart.findOne({ user: req.user._id }).lean();
      if (cart?.items?.length) cartProductIds = cart.items.map(item => item.product.toString());
    }

    products = products.map(p => ({
      ...p,
      pricing: calculatePricing(p),
      isInWishlist: wishlistIds.includes(p._id.toString()),
      isInCart: cartProductIds.includes(p._id.toString())
    }));

    switch (sort) {
      case "price-asc":
        products.sort((a, b) => a.pricing.displayPrice - b.pricing.displayPrice);
        break;
      case "price-desc":
        products.sort((a, b) => b.pricing.displayPrice - a.pricing.displayPrice);
        break;
      case "name-asc":
        products.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case "name-desc":
        products.sort((a, b) => b.productName.localeCompare(a.productName));
        break;
      default:
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const pageNum = +page || 1;
    const limitNum = +limit || 12;
    const skip = (pageNum - 1) * limitNum;
    const paginatedProducts = products.slice(skip, skip + limitNum);

    const totalProducts = products.length;
    const totalPages = Math.ceil(totalProducts / limitNum) || 1;

    res.json({
      products: paginatedProducts,
      totalProducts,
      totalPages,
      currentPage: pageNum,
    });
  } catch (error) {
    console.error("getProductsApi error:", error);
    res.status(STATUS.INTERNAL_ERROR).json({
      error: MESSAGES.SHOP.API_LOAD_FAILED || "Failed to load products"
    });
  }
};

export const checkProductAvailability = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      status: "Available",
      isActive: true,
      isBlocked: false,
       quantity: { $gt: 0 },
    }).select("quantity");

    res.json({
      available: !!product && product.quantity > 0,
      quantity: product?.quantity || 0
    });
  } catch (error) {
    console.error("checkProductAvailability error:", error);
    res.json({ available: false, quantity: 0 });
  }
};

export const loadProductPage = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findOne({
      _id: productId,
      status: "Available",
      isActive: true,
      isBlocked: false,
    })
      .populate("category")
      .lean();

    if (!product) {
      return res.status(STATUS.NOT_FOUND).render("user/page-404", {
        pageTitle: "Product Not Found",
        message: MESSAGES.PRODUCT.NOT_FOUND || "The product you are looking for is not available."
      });
    }

    product.pricing = calculatePricing(product);

    const discountsApplied = product.pricing.isOnOffer
      ? `${product.pricing.discountPercentage}% ${product.pricing.offerSource === 'category' ? 'Category' : 'Product'} Offer`
      : "";

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

    relatedProducts.forEach(rel => {
      rel.pricing = calculatePricing(rel);
    });

    let wishlistProductIds = [];
    let inCart = false;

    if (req.user?._id) {
      const wl = await WishList.findOne({ user: req.user._id }).lean();
      if (wl?.products?.length) wishlistProductIds = wl.products.map(i => i.productId.toString());

      const cart = await Cart.findOne({ user: req.user._id }).lean();
      if (cart) {
        inCart = cart.items.some(item => item.productId.toString() === productId);
        relatedProducts.forEach(rel => {
          rel.inCart = cart.items.some(item => item.productId.toString() === rel._id.toString());
        });
      }
    }

    res.render("user/product-details", {
      product,
      relatedProducts,
      wishlistProductIds,
      discountsApplied,
      user: req.user,
      inCart,
    });

  } catch (error) {
    console.error("Error loading product page:", error.stack);
    res.status(STATUS.INTERNAL_ERROR).render("user/page-404", {
      pageTitle: "Error",
      message: MESSAGES.PRODUCT.LOAD_FAILED || "An error occurred while loading the product page."
    });
  }
};

export default {
  loadShopPage,
  getProductsApi,
  checkProductAvailability,
  loadProductPage
};