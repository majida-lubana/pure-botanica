/* global Swal */
  document.addEventListener('DOMContentLoaded', () => {


    const showNotification = (msg, success = true) => {
      const div = document.createElement('div');
      div.className = `fixed top-20 right-4 px-4 py-2 rounded text-white shadow-lg z-50 ${success ? 'bg-green-500' : 'bg-red-500'}`;
      div.textContent = msg;
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 3000);
    };

    // Client-side totals (matches server)
    // const calcClientSummary = () => {
    //   let subtotal = 0;
    //   let savings = 0;

    //   document.querySelectorAll('.cart-item').forEach(item => {
    //     const qty = parseInt(item.querySelector('.quantity-input').value) || 0;
    //     const displayPrice = parseFloat(item.querySelector('.total-price').dataset.salePrice) || 0;
    //     const originalPrice = parseFloat(item.querySelector('.total-price').dataset.originalPrice) || 0;

    //     subtotal += displayPrice * qty;
    //     savings += (originalPrice - displayPrice) * qty;
    //   });

    //   const shippingCost = subtotal > 1000 ? 0 : 50;
    //   const tax = subtotal * 0.1;
    //   const total = subtotal + shippingCost + tax;

    //   return {
    //     subtotal: Number(subtotal.toFixed(2)),
    //     discount: Number(savings.toFixed(2)),
    //     shippingCost,
    //     tax: Number(tax.toFixed(2)),
    //     total: Number(total.toFixed(2))
    //   };
    // };

    // Robust summary update
    const updateSummary = (data) => {
      document.getElementById('subtotal').textContent = `₹${data.subtotal.toFixed(2)}`;

      const discountRow = document.querySelector('#discount')?.parentElement;
      const discountSpan = document.getElementById('discount');

      if (data.discount > 0) {
        if (discountSpan) {
          discountSpan.textContent = `-₹${data.discount.toFixed(2)}`;
        } else {
          const row = document.createElement('div');
          row.className = 'flex justify-between text-sm text-green-600';
          row.innerHTML = `<span>Discount</span><span id="discount">-₹${data.discount.toFixed(2)}</span>`;
          document.getElementById('shipping').parentElement.insertAdjacentElement('beforebegin', row);
        }
      } else if (discountRow) {
        discountRow.remove();
      }

      document.getElementById('shipping').textContent = `₹${data.shippingCost.toFixed(2)}`;
      document.getElementById('tax').textContent = `₹${data.tax.toFixed(2)}`;
      document.getElementById('total').textContent = `₹${data.total.toFixed(2)}`;
    };

    // Update cart badge
    const updateCartBadge = (count) => {
      const badge = document.getElementById('cart-count-badge');
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    };

    // Quantity buttons
    document.querySelectorAll('.update-quantity-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const productId = btn.dataset.productId;
        const action = btn.dataset.action;
        const input = btn.parentElement.querySelector('.quantity-input');
        const current = parseInt(input.value);
        const max = parseInt(input.max);
        const newQty = action === 'increase' ? current + 1 : current - 1;

        if (newQty < 1 || newQty > max || newQty > 5) {
          showNotification(newQty < 1 ? 'Minimum 1' : newQty > max ? 'Out of stock' : 'Max 5 per product', false);
          return;
        }

        const res = await fetch('/cart/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, action })
        });
        const data = await res.json();

        if (data.success) {
          input.value = newQty;
          const totalEl = btn.closest('.cart-item').querySelector('.total-price');
          const dp = parseFloat(totalEl.dataset.salePrice);
          totalEl.textContent = `₹${(dp * newQty).toFixed(2)}`;

          updateSummary(data);  // Use server data
          updateCartBadge(data.cartCount);
          showNotification(`Quantity ${action === 'increase' ? 'increased' : 'decreased'}`);
        } else {
          showNotification(data.message || 'Update failed', false);
        }
      });
    });

    // Remove item
    document.querySelectorAll('.remove-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productId = form.querySelector('input').value;
        const swalRes = await Swal.fire({
          title: 'Remove?', text: 'Remove this item?', icon: 'warning',
          showCancelButton: true, confirmButtonColor: '#d33'
        });
        if (!swalRes.isConfirmed) return;

        const res = await fetch('/cart/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId })
        });
        const data = await res.json();

        if (data.success) {
          document.querySelector(`[data-product-id="${productId}"]`).remove();
          updateSummary(data);
          updateCartBadge(data.cartCount);
          Swal.fire('Removed!', '', 'success');
          if (!document.querySelector('.cart-item')) location.reload();
        }
      });
    });

    
  });
