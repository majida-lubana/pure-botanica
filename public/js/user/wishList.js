

/* global Swal */


  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  function updateWishlistUI() {
    const items = $$('.wishlist-item');
    const count = items.length;
    $('#wishlist-count').textContent = count;
    $('#action-buttons').style.display = count ? 'flex' : 'none';
    $('#empty-wishlist').style.display = count ? 'none' : 'block';
    $('#wishlist-container').style.display = count ? 'flex' : 'none';
  }

  function toast(message, type = 'success') {
    const bg = type === 'success' ? '#2ecc71' : '#e74c3c';
    const div = Object.assign(document.createElement('div'), {
      innerHTML: `<span>${message}</span>`,
      style: `
        position: fixed; bottom: 20px; right: 20px; 
        background: ${bg}; color: white; padding: 12px 20px; 
        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000; font-weight: 600; animation: fadeIn 0.3s;
      `
    });
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }

  // ADD TO CART → REMOVE FROM WISHLIST
  function attachAddToCart(button) {
    button.addEventListener('click', async () => {
      const productId = button.dataset.productId;
      const row = button.closest('.wishlist-item');

      try {
        const res = await fetch('/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, quantity: 1 })
        });
        const data = await res.json();

        if (data.success) {
          // Remove from UI
          row.classList.add('removing');
          setTimeout(() => {
            row.remove();
            updateWishlistUI();
          }, 300);

          // Remove from backend
          await fetch('/wishlist/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId })
          });

          // Update cart count
          const cartCountEl = $('#cart-count');
          if (cartCountEl && data.cartCount !== undefined) {
            cartCountEl.textContent = data.cartCount;
          }

          toast('Added to cart & removed from wishlist!', 'success');
        } else {
          if (data.redirectUrl) {
            Swal.fire({
              icon: 'warning',
              title: 'Login Required',
              text: data.message || 'Please login to continue',
              confirmButtonText: 'Login'
            }).then(r => r.isConfirmed && (location.href = data.redirectUrl));
          } else {
            toast(data.message || 'Failed to add', 'error');
          }
        }
      } catch  {
        toast('Network error', 'error');
      }
    });
  }

  // REMOVE FROM WISHLIST
  function attachRemoveButton(button) {
    button.addEventListener('click', async () => {
      const productId = button.dataset.productId;
      const row = button.closest('.wishlist-item');

      const { isConfirmed } = await Swal.fire({
        title: 'Remove from Wishlist?',
        text: 'This item will be removed from your wishlist.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: 'Yes, Remove'
      });

      if (!isConfirmed) return;

      try {
        const res = await fetch('/wishlist/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId })
        });
        const data = await res.json();

        if (data.success) {
          row.classList.add('removing');
          setTimeout(() => {
            row.remove();
            updateWishlistUI();
            toast('Removed from wishlist', 'success');
          }, 300);
        } else {
          toast(data.message || 'Failed to remove', 'error');
        }
      } catch {
        toast('Network error', 'error');
      }
    });
  }

  // ADD ALL TO CART
  $('#add-all-to-cart')?.addEventListener('click', async () => {
    const buttons = $$('.add-to-cart-btn:not([disabled])');
    for (const btn of buttons) {
      btn.click();
      await new Promise(r => setTimeout(r, 300));
    }
  });

  // CLEAR WISHLIST
  $('#clear-wishlist')?.addEventListener('click', async () => {
    const { isConfirmed } = await Swal.fire({
      title: 'Clear Wishlist?',
      text: 'All items will be removed permanently.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      confirmButtonText: 'Yes, Clear All'
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch('/wishlist/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (data.success) {
        $$('.wishlist-item').forEach(el => el.classList.add('removing'));
        setTimeout(() => {
          $$('.wishlist-item').forEach(el => el.remove());
          updateWishlistUI();
          toast('Wishlist cleared', 'success');
        }, 400);
      } else {
        toast(data.message || 'Failed to clear', 'error');
      }
    } catch  {
      toast('Network error', 'error');
    }
  });

  // INIT
  document.addEventListener('DOMContentLoaded', () => {
    updateWishlistUI();
    $$('.add-to-cart-btn').forEach(attachAddToCart);
    $$('.remove-wishlist-btn').forEach(attachRemoveButton);
  });
