const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

exports.loadShopPage = async (req, res) => {
  try {
    let { search = '', sort = 'default', category, skinType, skinConcern, minPrice = 0, maxPrice = 10000, page = 1, limit = 12 } = req.query;

    search = typeof search === 'string' ? search.trim() : '';

    let categoriesQuery = Array.isArray(category) ? category : (category ? [category] : []);
    let skinTypes = Array.isArray(skinType) ? skinType : (skinType ? [skinType] : []);
    let skinConcerns = Array.isArray(skinConcern) ? skinConcern : (skinConcern ? [skinConcern] : []);

    const query = {
      status: 'Available',
      isActive: true,
      isBlocked: false
    };
    console.log('query',query)

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    if (categoriesQuery.length > 0 && !categoriesQuery.includes('all')) {
      const categoryDocs = await Category.find({
        categoryName: { $in: categoriesQuery.map(c => c.toLowerCase()) },
        isListed: true
      });
      console.log('Categories found:', categoryDocs);
      if (categoryDocs.length > 0) {
        query.category = { $in: categoryDocs.map(doc => doc._id) };
      }
    }

    if (skinTypes.length > 0 && !skinTypes.includes('all')) {
      query.skinType = { $in: skinTypes };
    }

    if (skinConcerns.length > 0 && !skinConcerns.includes('all')) {
      query.skinConcern = { $in: skinConcerns };
    }

    query.salePrice = { $gte: parseFloat(minPrice) || 0, $lte: parseFloat(maxPrice) || 10000 };

    let sortOption = {};
    switch (sort) {
      case 'price-asc':
        sortOption = { salePrice: 1 };
        break;
      case 'price-desc':
        sortOption = { salePrice: -1 };
        break;
      case 'name-asc':
        sortOption = { productName: 1 };
        break;
      case 'name-desc':
        sortOption = { productName: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    console.log('Query:', query);
    console.log('Sort:', sortOption);

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(query)
      .populate('category')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean();

    console.log('Products found:', products.length);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limitNum) || 1;
    const currentPage = Math.min(pageNum, totalPages);

    const categories = await Category.find({ isListed: true }).lean();
    console.log('Categories for sidebar:', categories);

    const skinTypeOptions = ['Oily', 'Dry', 'Combination', 'Sensitive', 'Normal', 'All Skin Types'];
    const skinConcernOptions = ['Acne', 'Dryness', 'Oiliness', 'Aging', 'Pigmentation', 'Sensitivity'];

    res.render('user/shop', {
      user: req.user || null,
      products,
      categories,
      skinTypeOptions,
      skinConcernOptions,
      currentPage,
      totalPages,
      totalProducts,
      selectedCategories: categoriesQuery,
      selectedSkinTypes: skinTypes,
      selectedSkinConcerns: skinConcerns,
      minPrice,
      maxPrice,
      search,
      sort
    });
  } catch (error) {
    console.error('Error in loadShopPage:', error.stack);
    res.status(500).render('pageNotFound', {
      pageTitle: 'Page Not Found',
      message: 'An error occurred while loading the shop page.'
    });
  }
};

exports.getProductsApi = async (req, res) => {
  try {
    let { search = '', sort = 'default', category, skinType, skinConcern, minPrice = 0, maxPrice = 10000, page = 1, limit = 12 } = req.query;

    search = typeof search === 'string' ? search.trim() : '';

    let categoriesQuery = Array.isArray(category) ? category : (category ? [category] : []);
    let skinTypes = Array.isArray(skinType) ? skinType : (skinType ? [skinType] : []);
    let skinConcerns = Array.isArray(skinConcern) ? skinConcern : (skinConcern ? [skinConcern] : []);

    const query = {
      status: 'Available',
      isActive: true,
      isBlocked: false
    };

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    if (categoriesQuery.length > 0 && !categoriesQuery.includes('all')) {
      const categoryDocs = await Category.find({
        categoryName: { $in: categoriesQuery.map(c => c.toLowerCase()) },
        isListed: true
      });
      console.log('Categories found:', categoryDocs);
      if (categoryDocs.length > 0) {
        query.category = { $in: categoryDocs.map(doc => doc._id) };
      }
    }

    if (skinTypes.length > 0 && !skinTypes.includes('all')) {
      query.skinType = { $in: skinTypes };
    }

    if (skinConcerns.length > 0 && !skinConcerns.includes('all')) {
      query.skinConcern = { $in: skinConcerns };
    }

    query.salePrice = { $gte: parseFloat(minPrice) || 0, $lte: parseFloat(maxPrice) || 10000 };

    let sortOption = {};
    switch (sort) {
      case 'price-asc':
        sortOption = { salePrice: 1 };
        break;
      case 'price-desc':
        sortOption = { salePrice: -1 };
        break;
      case 'name-asc':
        sortOption = { productName: 1 };
        break;
      case 'name-desc':
        sortOption = { productName: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    console.log('Query:', query);
    console.log('Sort:', sortOption);

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(query)
      .populate('category')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean();

    console.log('Products found:', products.length);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limitNum) || 1;

    res.json({
      products,
      currentPage: pageNum,
      totalPages,
      totalProducts
    });
  } catch (error) {
    console.error('Error in getProductsApi:', error.stack);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching products',
      error: error.message
    });
  }
};

exports.checkProductAvailability = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findOne({
      _id: productId,
      status: 'Available',
      isActive: true,
      isBlocked: false
    }).select('quantity');

    if (!product) {
      return res.json({ available: false, quantity: 0 });
    }

    res.json({ available: product.quantity > 0, quantity: product.quantity });
  } catch (error) {
    console.error('Error in checkProductAvailability:', error.stack);
    res.json({ available: false, quantity: 0 });
  }
};

exports.loadProductPage = async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('Loading product page for ID:', productId);
    const product = await Product.findOne({
      _id: productId,
      status: 'Available',
      isActive: true,
      isBlocked: false
    }).populate('category').lean();

    if (!product) {
      console.log('Product not found or unavailable:', productId);
      return res.status(404).render('pageNotFound', {
        pageTitle: 'Product Not Found',
        message: 'The product you are looking for is not available.'
      });
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      status: 'Available',
      isActive: true,
      isBlocked: false
    }).limit(4).lean();

    const discountsApplied = '';
    const user = req.user;

    res.render('user/product-details', {
      product,
      relatedProducts,
      discountsApplied,
      user
    });
  } catch (error) {
    console.error('Error loading product page:', error.stack);
    res.status(500).render('pageNotFound', {
      pageTitle: 'Error',
      message: 'An error occurred while loading the product page.'
    });
  }
};