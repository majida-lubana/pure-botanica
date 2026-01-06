
   /* global Swal */
      function showToast(message, type = 'info') {
        const icons = { success: 'success', danger: 'error', info: 'info', warning: 'warning' };
        Swal.fire({
          toast: true, position: 'top-end', icon: icons[type] || 'info', title: message,
          showConfirmButton: false, timer: 2000, timerProgressBar: true,
          didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
          }
        });
      }

      // ---------- WISHLIST (exact copy from shop) ----------
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
        } catch {
          showToast('Network error', 'danger');
        }
      }

      function attachWishlistListeners() {
        document.querySelectorAll('.wishlist-btn').forEach(btn => {
          btn.onclick = function (e) {
            e.preventDefault(); e.stopPropagation();
            toggleWishlist(this.dataset.productId, this);
          };
        });
      }

      async function updateWishlistCount() {
        try {
          const res = await fetch('/wishlist/count');
          const data = await res.json();
          const el = document.getElementById('wishlist-count');
          if (el) el.textContent = data.count > 0 ? `${data.count} items` : 'Empty';
        } catch (err) {
  console.error('Failed to update wishlist count', err);
}

      }

      function handleAuthRedirect(data) {
        if (data.redirectUrl) {
          Swal.fire({
            icon: 'warning',
            title: 'Login Required',
            text: data.message || 'Please login to continue.',
            confirmButtonText: 'Login'
          }).then(r => { if (r.isConfirmed) window.location.href = data.redirectUrl; });
        } else {
          showToast(data.message || 'Error', 'danger');
        }
      }

      // ---------- CART ----------
      async function addToCart(productId, quantity) {
        try {
          const res = await fetch('/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity })
          });
          const data = await res.json();

          if (data.success) {
            // Update cart count
            const el = document.getElementById('cart-count');
            if (el) el.textContent = data.cartCount;

            // Update ALL buttons for this product
            document.querySelectorAll(`[data-product-id="${productId}"]`).forEach(btn => {
              btn.textContent = 'GO TO CART';
              btn.classList.remove('bg-black', 'hover:bg-gray-800');
              btn.classList.add('bg-green-600', 'hover:bg-green-700');
              btn.dataset.mode = 'goto-cart';
            });

            // Disable quantity controls for main button
            if (document.getElementById('addToCartBtn')?.dataset.productId === productId) {
              quantityInput.disabled = true;
              decreaseQty.disabled = true;
              increaseQty.disabled = true;
            }

            showToast('Added to cart!', 'success');
          } else {
            handleAuthRedirect(data);
          }
        } catch {
          showToast('Network error', 'danger');
        }
      }

      document.addEventListener('click', async e => {
        const btn = e.target.closest('#addToCartBtn, .add-to-cart-btn');
        if (!btn || btn.disabled) return;

        if (btn.dataset.mode === 'goto-cart') {
          window.location.href = '/cart';
          return;
        }

        const productId = btn.dataset.productId;
        const qty = btn.id === 'addToCartBtn' ? parseInt(quantityInput.value) : 1;
        await addToCart(productId, qty);
      });

      // ---------- Quantity Controls ----------
      const maxLimit = 5;
      const quantityInput = document.getElementById('quantity');
      const decreaseQty = document.getElementById('decreaseQty');
      const increaseQty = document.getElementById('increaseQty');

      if (quantityInput && decreaseQty && increaseQty) {
        const effectiveMax = Math.min(parseInt(quantityInput.max), maxLimit);
        let notificationActive = false;

        const showLimitAlert = () => {
          if (notificationActive) return;
          notificationActive = true;
          Swal.fire({
            icon: 'warning',
            title: 'Limit reached',
            text: `You can only buy up to ${maxLimit} units of this product.`,
            confirmButtonColor: '#108a7e'
          }).then(() => { notificationActive = false; });
        };

        decreaseQty.addEventListener('click', () => {
          let v = parseInt(quantityInput.value) || 1;
          if (v > 1) quantityInput.value = v - 1;
          decreaseQty.disabled = v <= 2;
          increaseQty.disabled = v >= effectiveMax;
        });

        increaseQty.addEventListener('click', () => {
          let v = parseInt(quantityInput.value) || 1;
          if (v < effectiveMax) {
            quantityInput.value = v + 1;
          } else {
            setTimeout(showLimitAlert, 50);
          }
          decreaseQty.disabled = v <= 0;
          increaseQty.disabled = v >= effectiveMax;
        });

        quantityInput.addEventListener('input', () => {
          let v = parseInt(quantityInput.value) || 1;
          if (v < 1) v = 1;
          if (v > effectiveMax) {
            quantityInput.value = effectiveMax;
            setTimeout(showLimitAlert, 50);
          } else {
            quantityInput.value = v;
          }
          decreaseQty.disabled = v <= 1;
          increaseQty.disabled = v >= effectiveMax;
        });
      }

      // ---------- Image Zoom & Thumbnails ----------
      const thumbnails = document.querySelectorAll('.thumbnail');
      const mainImage = document.getElementById('mainImage');
      const zoomLens = document.getElementById('zoomLens');
      const zoomResult = document.getElementById('zoomResult');

      thumbnails.forEach(thumb => {
        thumb.addEventListener('click', () => {
          thumbnails.forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          mainImage.src = thumb.src;
          zoomResult.style.backgroundImage = `url(${thumb.src})`;
        });
      });

      if (mainImage && zoomLens && zoomResult) {
        zoomResult.style.backgroundImage = `url(${mainImage.src})`;
        zoomResult.style.backgroundSize = `${mainImage.width * 2}px ${mainImage.height * 2}px`;

        mainImage.parentElement.addEventListener('mousemove', e => {
          const rect = mainImage.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          zoomLens.style.display = 'block';
          zoomResult.style.display = 'block';

          let lensX = x - 50;
          let lensY = y - 50;
          lensX = Math.max(0, Math.min(lensX, mainImage.width - 100));
          lensY = Math.max(0, Math.min(lensY, mainImage.height - 100));

          zoomLens.style.left = `${lensX}px`;
          zoomLens.style.top = `${lensY}px`;

          const rx = (lensX / mainImage.width) * (mainImage.width * 2);
          const ry = (lensY / mainImage.height) * (mainImage.height * 2);
          zoomResult.style.backgroundPosition = `-${rx}px -${ry}px`;
        });

        mainImage.parentElement.addEventListener('mouseleave', () => {
          zoomLens.style.display = 'none';
          zoomResult.style.display = 'none';
        });
      }

      // ---------- Init ----------
      document.addEventListener('DOMContentLoaded', () => {
        const mainBtn = document.getElementById('addToCartBtn');
        if (mainBtn?.dataset.mode === 'goto-cart') {
          quantityInput.disabled = true;
          decreaseQty.disabled = true;
          increaseQty.disabled = true;
        }
        attachWishlistListeners();
        updateWishlistCount();
      });
