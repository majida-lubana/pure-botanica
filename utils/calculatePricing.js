

export const calculatePricing = (product) => {
  if (!product) {
    return {
      originalPrice: 0,
      displayPrice: 0,
      savings: 0,
      discountPercentage: 0,
      isOnOffer: false,
      offerSource: null
    };
  }

  const regular = Number(product.regularPrice) || 0;
  const sale = Number(product.salePrice) || regular;

  const productOffer = Number(product.productOffer) || 0;

  let categoryOffer = 0;
  if (
    product.category &&
    product.category.offerActive === true &&
    new Date() >= new Date(product.category.offerStart) &&
    new Date() <= new Date(product.category.offerEnd)
  ) {
    categoryOffer = Number(product.category.categoryOffer) || 0;
  }

  const discountPercent = Math.max(productOffer, categoryOffer);

  let displayPrice = regular;
  let savings = 0;

  if (discountPercent > 0) {
    displayPrice = regular * (1 - discountPercent / 100);
    savings = regular - displayPrice;
  } else if (sale < regular) {
    displayPrice = sale;
    savings = regular - sale;
  }


  displayPrice = Number(displayPrice.toFixed(2));
  savings = Number(savings.toFixed(2));

  return {
    originalPrice: regular,
    displayPrice,
    savings,
    discountPercentage: discountPercent,
    isOnOffer: discountPercent > 0,
    offerSource:
      productOffer > categoryOffer
        ? 'product'
        : categoryOffer > 0
        ? 'category'
        : null
  };
};

export default calculatePricing;