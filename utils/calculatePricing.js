// utils/calculatePricing.js
const calculatePricing = (product) => {
  const regular = Number(product.regularPrice) || 0;
  const sale    = Number(product.salePrice)    || regular;

  // Product offer
  const productOffer = Number(product.productOffer) || 0;

  // Category offer (only if populated)
  let categoryOffer = 0;
  if (product.category && typeof product.category === 'object') {
    categoryOffer = Number(product.category.categoryOffer) || 0;
  }

  // Use highest discount
  const discountPercent = Math.max(productOffer, categoryOffer);

  const afterDiscount = regular * (1 - discountPercent / 100);
  const display = Math.min(regular, sale, afterDiscount);
  const savings = regular - display;

  return {
    originalPrice: regular,
    displayPrice: Number(display.toFixed(2)),
    savings: Number(savings.toFixed(2)),
    discountPercentage: discountPercent,
    isOnOffer: discountPercent > 0,
    offerSource: productOffer > categoryOffer ? 'product' : 
                 categoryOffer > 0 ? 'category' : null
  };
};

module.exports = { calculatePricing };