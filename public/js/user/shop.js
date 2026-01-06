/* global Swal */

let currentParams = {
  search: '',
  sort: 'default',
  category: [],
  skinType: [],
  skinConcern: [],
  minPrice: 0,
  maxPrice: 10000,
  page: 1,
  limit: 12
};

// Initialize params from server-rendered data
function initializeParams(serverParams) {
  currentParams = {
    search: serverParams.search || '',
    sort: serverParams.sort || 'default',
    category: serverParams.category || [],
    skinType: serverParams.skinType || [],
    skinConcern: serverParams.skinConcern || [],
    minPrice: serverParams.minPrice || 0,
    maxPrice: serverParams.maxPrice || 10000,
    page: serverParams.page || 1,
    limit: 12
  };
}

// ============================================
// TOAST NOTIFICATION
// ============================================
function showToast(message, type = 'info') {
  const icons = { 
    success: 'success', 
    danger: 'error', 
    info: 'info', 
    warning: 'warning' 
  };
  
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: icons[type] || 'info',
    title: message,
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });
}

// ============================================
// WISHLIST FUNCTIONS
// ============================================
async function toggleWishlist(productId, button) {
  const icon = button.querySelector('i');
  
  try {
    const res = await fetch('/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    });
    const data = await res.json();

    if (data.success) {
      if (data.added) {
        icon.classList.remove('far');
        icon.classList.add('fas', 'text-red-500');
        showToast('Added to wishlist!', 'success');
      } else {
        icon.classList.remove('fas', 'text-red-500');
        icon.classList.add('far');
        showToast('Removed from wishlist', 'info');
      }
      updateWishlistCount();
    } else {
      handleAuthRedirect(data);
    }
  } catch (e) {
    console.error('Wishlist error:', e);
    showToast('Network error', 'danger');
  }
}

function attachWishlistListeners() {
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleWishlist(this.dataset.productId, this);
    };
  });
}

async function updateWishlistCount() {
  try {
    const res = await fetch('/wishlist/count');
    const data = await res.json();
    const el = document.getElementById('wishlist-count');
    if (el) {
      el.textContent = data.count > 0 ? `${data.count} items` : 'Empty';
    }
  } catch (err) {
    console.error('Failed to update wishlist count:', err);
  }
}

// ============================================
// CART FUNCTIONS
// ============================================
async function addToCart(productId) {
  try {
    const cartRes = await fetch('/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity: 1 })
    });

    const cartData = await cartRes.json();

    if (cartData.success) {
      Swal.fire({
        icon: 'success',
        title: 'Added to Cart!',
        text: cartData.message || 'Product added successfully',
        timer: 1500,
        showConfirmButton: false
      });

      // Update cart count in header
      const cartCountEl = document.getElementById('cart-count');
      if (cartCountEl && cartData.cartCount !== undefined) {
        cartCountEl.textContent = cartData.cartCount;
      }

      // Update all relevant "Add to Cart" buttons
      if (cartData.cartProductIds && Array.isArray(cartData.cartProductIds)) {
        cartData.cartProductIds.forEach(pid => {
          const btn = document.querySelector(`.add-to-cart-btn[data-product-id="${pid}"]`);
          if (btn) {
            btn.textContent = 'GO TO CART';
            btn.onclick = () => { window.location.href = '/cart'; };
          }
        });
      }
    } else {
      handleAuthRedirect(cartData);
    }
  } catch (e) {
    console.error('Add to cart error:', e);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to add to cart. Please try again.',
      timer: 2000,
      showConfirmButton: false
    });
  }
}

function attachAddToCartListeners() {
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.onclick = null; // Clear previous listeners
    const pid = btn.dataset.productId;
    const btnText = btn.textContent.trim();

    if (btnText === 'GO TO CART') {
      btn.onclick = () => { window.location.href = '/cart'; };
    } else if (btnText !== 'OUT OF STOCK') {
      btn.onclick = () => addToCart(pid);
    }
    // If OUT OF STOCK, leave disabled (no onclick needed)
  });
}

// ============================================
// AUTH REDIRECT HANDLER
// ============================================
function handleAuthRedirect(data) {
  if (data.redirectUrl) {
    Swal.fire({
      icon: 'warning',
      title: 'Login Required',
      text: data.message || 'Please login to continue.',
      confirmButtonText: 'Login'
    }).then(result => {
      if (result.isConfirmed) {
        window.location.href = data.redirectUrl;
      }
    });
  } else {
    showToast(data.message || 'Error', 'danger');
  }
}

// ============================================
// PRODUCT UPDATE (AJAX)
// ============================================
async function updateProducts() {
  const qs = new URLSearchParams();
  
  if (currentParams.search) qs.append('search', currentParams.search);
  if (currentParams.sort !== 'default') qs.append('sort', currentParams.sort);
  currentParams.category.forEach(c => qs.append('category', c));
  currentParams.skinType.forEach(st => qs.append('skinType', st));
  currentParams.skinConcern.forEach(sc => qs.append('skinConcern', sc));
  if (currentParams.minPrice !== 0) qs.append('minPrice', currentParams.minPrice);
  if (currentParams.maxPrice !== 10000) qs.append('maxPrice', currentParams.maxPrice);
  qs.append('page', currentParams.page);
  qs.append('limit', currentParams.limit);

  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="col-span-full text-center py-12">Loading...</div>';

  try {
    const res = await fetch(`/api/products?${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.products && data.products.length > 0) {
      const container = document.createElement('div');
      container.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6';

      data.products.forEach(p => {
        const pricing = p.pricing || {};
        const card = `
          <div class="product-card bg-white rounded-lg shadow-md border border-gray-200 relative">
            <button class="absolute top-2 right-2 z-10 p-1.5 rounded-full hover:bg-gray-100 wishlist-btn"
                    data-product-id="${p._id}" title="Wishlist">
              <i class="fa${p.isInWishlist ? 's text-red-500' : 'r'} fa-heart text-lg"></i>
            </button>

            <div class="product-content">
              <a href="/product/${p._id}">
                <img alt="${p.productName}" class="mb-4 product-image w-48 h-48 mx-auto object-contain"
                     src="${p.productImages?.[0] 
  ? p.productImages[0] 
  : 'https://via.placeholder.com/300x300?text=No+Image'}"

                     loading="lazy"/>
              </a>
              <div class="font-bold text-lg mb-2 text-gray-800 text-center">${p.productName.toUpperCase()}</div>

              <div class="mb-3 text-center">
                <div class="flex items-center justify-center gap-2 flex-wrap">
                  <span class="text-2xl font-bold text-green-600">₹${(pricing.displayPrice || 0).toFixed(2)}</span>
                  ${pricing.savings > 0 ? `
                    <span class="text-sm line-through text-gray-500">₹${(pricing.originalPrice || 0).toFixed(2)}</span>
                    <span class="offer-badge bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">${Math.round(pricing.discountPercentage)}% OFF</span>
                  ` : ''}
                </div>
                ${pricing.savings > 0 ? `<p class="text-xs text-gray-600 mt-1">Save ₹${pricing.savings.toFixed(2)}</p>` : ''}
                ${p.quantity === 0 ? '<span class="text-red-600 text-sm block mt-2">(Out of Stock)</span>' : ''}
              </div>
            </div>

            <button class="bg-[#0a2a2d] text-white text-sm font-semibold px-4 py-2 rounded hover:bg-[#0f3a3f] w-full add-to-cart-btn transition"
                    data-product-id="${p._id}" ${p.quantity === 0 ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
              ${p.isInCart ? 'GO TO CART' : (p.quantity === 0 ? 'OUT OF STOCK' : 'ADD TO CART')}
            </button>
          </div>`;
        container.innerHTML += card;
      });

      grid.innerHTML = '';
      grid.appendChild(container);

      // Re-attach event listeners after DOM update
      attachAddToCartListeners();
      attachWishlistListeners();
    } else {
      grid.innerHTML = '<div class="col-span-full text-center text-gray-600 py-12 text-xl">No products found.</div>';
    }
  } catch (err) {
    console.error('updateProducts error:', err);
    grid.innerHTML = '<div class="col-span-full text-center text-red-600 py-12">Error loading products. Please try again.</div>';
  }
}

// ============================================
// FILTER & SEARCH EVENT LISTENERS
// ============================================
function initializeFilterListeners() {
  // Category, Skin Type, and Skin Concern checkboxes
  document.querySelectorAll('input[type="checkbox"][name^="category"], input[type="checkbox"][name^="skinType"], input[type="checkbox"][name^="skinConcern"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const name = cb.name.replace('[]', '');
      currentParams[name] = Array.from(document.querySelectorAll(`input[name="${cb.name}"]:checked`)).map(c => c.value);
      currentParams.page = 1;
      updateProducts();
    });
  });

  // "All Categories" checkbox logic
  const allCat = document.getElementById('cat-all');
  if (allCat) {
    allCat.addEventListener('change', () => {
      document.querySelectorAll('input[name="category[]"]').forEach(c => c.checked = false);
      currentParams.category = [];
      currentParams.page = 1;
      updateProducts();
    });
  }

  document.querySelectorAll('input[name="category[]"]').forEach(c => {
    c.addEventListener('change', () => {
      if (c.checked && allCat) allCat.checked = false;
    });
  });

  // Price range inputs
  ['minPrice', 'maxPrice'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    ['blur', 'keyup'].forEach(ev => {
      el.addEventListener(ev, e => {
        if (ev === 'keyup' && e.key !== 'Enter') return;
        let value = parseFloat(el.value);
        if (isNaN(value)) value = id === 'minPrice' ? 0 : 10000;
        currentParams[id] = value;
        currentParams.page = 1;
        updateProducts();
      });
    });
  });

  // Search functionality
  const searchBtn = document.getElementById('searchBtn');
  const searchInp = document.getElementById('searchInput');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      currentParams.search = searchInp.value.trim();
      currentParams.page = 1;
      updateProducts();
    });
  }
  
  if (searchInp) {
    searchInp.addEventListener('keyup', e => {
      if (e.key === 'Enter') {
        currentParams.search = e.target.value.trim();
        currentParams.page = 1;
        updateProducts();
      }
    });
  }

  // Sort dropdown
  const sortSel = document.getElementById('sortSelect');
  if (sortSel) {
    sortSel.addEventListener('change', e => {
      currentParams.sort = e.target.value;
      currentParams.page = 1;
      updateProducts();
    });
  }
}

// ============================================
// INITIALIZATION
// ============================================
function initializeShop(serverParams) {
  // Initialize params from server
  initializeParams(serverParams);
  
  // Attach all event listeners
  attachAddToCartListeners();
  attachWishlistListeners();
  initializeFilterListeners();
  
  // Update wishlist count
  updateWishlistCount();
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // This will be called from shop.ejs with server data
  if (window.shopPageParams) {
    initializeShop(window.shopPageParams);
  }
});