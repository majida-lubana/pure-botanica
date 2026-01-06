
/* global Swal */
/* global Razorpay, bootstrap */

        async function retryPayment(orderId) {
            const button = event.target;
            const originalText = button.innerHTML;
            
            // Show loading state
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            try {
                const response = await fetch(`/checkout/retry-payment/${orderId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.message || 'Failed to create payment order');
                }

                // Show payment initialization message
                await Swal.fire({
                    icon: 'info',
                    title: 'Payment Initialized',
                    text: 'Opening payment gateway...',
                    timer: 1500,
                    showConfirmButton: false
                });

                const options = {
                    key: data.key_id,
                    amount: data.amount,
                    currency: "INR",
                    name: "Beauty Cart",
                    description: "Complete Order Payment",
                    order_id: data.razorpayOrderId,
                    retry: false,
                    handler: async function (response) {
                        try {
                            // Show verification loading
                            Swal.fire({
                                icon: 'info',
                                title: 'Verifying Payment...',
                                text: 'Please wait while we confirm your payment',
                                allowOutsideClick: false,
                                didOpen: () => {
                                    Swal.showLoading();
                                }
                            });

                            const verifyRes = await fetch("/checkout/verify-razorpay", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    razorpay_order_id: response.razorpay_order_id,
                                    razorpay_payment_id: response.razorpay_payment_id,
                                    razorpay_signature: response.razorpay_signature,
                                    orderId: orderId
                                })
                            });
                            const vData = await verifyRes.json();

                            if (vData.success) {
                                await Swal.fire({
                                    icon: "success", 
                                    title: "Payment Successful!", 
                                    text: "Your order has been confirmed. Redirecting...",
                                    timer: 2000,
                                    showConfirmButton: false
                                });
                                // Refresh page to update order status
                                setTimeout(() => location.reload(), 2000);
                            } else {
                                throw new Error(vData.message || "Payment verification failed");
                            }
                        } catch (error) {
                            console.error('Payment verification error:', error);
                            await Swal.fire({
                                icon: "error", 
                                title: "Payment Verification Failed", 
                                text: error.message || "Please contact support if amount was debited.",
                                confirmButtonText: "OK"
                            });
                            // Reset button state
                            button.disabled = false;
                            button.innerHTML = originalText;
                        }
                    },
                    prefill: {},
                    theme: { color: "#000000" },
                    modal: {
                        ondismiss: () => {
                            // Reset button state
                            button.disabled = false;
                            button.innerHTML = originalText;
                            
                            Swal.fire({
                                icon: 'info',
                                title: 'Payment Cancelled',
                                text: 'You can retry payment anytime from this page.',
                                confirmButtonText: 'OK'
                            });
                        }
                    }
                };

                const rzp = new Razorpay(options);
                rzp.on('payment.failed', async (resp) => {
                    console.error('Payment failed:', resp.error);
                    
                    // Record payment failure
                    try {
                        await fetch('/checkout/handle-payment-failure', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                orderId: orderId,
                                error: resp.error
                            })
                        });
                    } catch (e) {
                        console.error('Failed to record payment failure:', e);
                    }

                    // Reset button state
                    button.disabled = false;
                    button.innerHTML = originalText;

                    await Swal.fire({ 
                        icon: 'error', 
                        title: 'Payment Failed', 
                        text: resp.error?.description || 'Payment failed. Please try again.',
                        confirmButtonText: 'Retry Later'
                    });
                });
                
                // Open Razorpay checkout
                rzp.open();

            } catch (error) {
                console.error('Error retrying payment:', error);
                
                // Reset button state
                button.disabled = false;
                button.innerHTML = originalText;
                
                await Swal.fire({
                    icon: 'error',
                    title: 'Unable to Process Payment',
                    text: error.message || 'Failed to initialize payment. Please try again.',
                    confirmButtonText: 'OK'
                });
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            const searchInput = document.getElementById('orderSearch');
            const searchBtn = document.getElementById('searchBtn');
            const clearSearchBtn = document.getElementById('clearSearchBtn');
            const orderGrid = document.getElementById('orderGrid');
          

            // ── FETCH ORDERS FROM SERVER ──
            async function fetchOrders(page = 1, search = '') {
                const url = new URL('/orders', window.location.origin);
                url.searchParams.set('page', page);
                if (search) url.searchParams.set('search', search);

                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Network error');
                    const html = await response.text();

                    // Parse HTML and extract only the order grid + pagination
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const newGrid = doc.querySelector('#orderGrid');
                    const newPagination = doc.querySelector('.pagination-container');

                    if (newGrid) orderGrid.innerHTML = newGrid.innerHTML;
                    if (newPagination) {
                        document.querySelector('.pagination-container').outerHTML = newPagination.outerHTML;
                    }

                    // Re-attach event listeners
                    attachPaginationListeners();
                    applyLiveSearch(); // Re-apply live search on new cards
                } catch (err) {
                    console.error('Fetch error:', err);
                    Swal.fire('Error', 'Failed to load orders', 'error');
                }
            }

            // ── LIVE SEARCH (Client-side) ──
            function applyLiveSearch() {
                const query = searchInput.value.toLowerCase().trim();
                const cards = document.querySelectorAll('.order-card');

                cards.forEach(card => {
                    const product = (card.dataset.product || '').toLowerCase();
                    const status = (card.dataset.status || '').toLowerCase();
                    const matches = !query || product.includes(query) || status.includes(query);
                    card.style.display = matches ? 'block' : 'none';
                });
            }

            // ── RE-ATTACH PAGINATION LISTENERS AFTER FETCH ──
            function attachPaginationListeners() {
                const newPrev = document.getElementById('prevPage');
                const newNext = document.getElementById('nextPage');
                const newPageBtns = document.querySelectorAll('.pagination-btn[data-page]');

                if (newPrev) newPrev.onclick = () => {
                    const page = parseInt(newPrev.dataset.page || '<%= currentPage %>') - 1;
                    if (page >= 1) fetchOrders(page, searchInput.value.trim());
                };
                if (newNext) newNext.onclick = () => {
                    const page = parseInt(newNext.dataset.page || '<%= currentPage %>') + 1;
                    fetchOrders(page, searchInput.value.trim());
                };
                newPageBtns.forEach(btn => {
                    btn.onclick = () => fetchOrders(btn.dataset.page, searchInput.value.trim());
                });
            }

            // ── EVENT LISTENERS ──
            if (searchBtn) {
                searchBtn.addEventListener('click', () => {
                    fetchOrders(1, searchInput.value.trim());
                });
            }

            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    fetchOrders(1, '');
                });
            }

            searchInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    fetchOrders(1, searchInput.value.trim());
                }
            });

            // Live search while typing
            searchInput.addEventListener('input', applyLiveSearch);

            // Initial pagination
            attachPaginationListeners();

            // Apply live search on load
            applyLiveSearch();

            // ────── CANCEL / RETURN (Keep existing fetch) ──────
            const confirmCancelBtn = document.getElementById('confirmCancelBtn');
            if (confirmCancelBtn) {
                confirmCancelBtn.addEventListener('click', async () => {
                    const cancelForm = document.getElementById('cancelForm');
                    const orderId = document.getElementById('orderId').value;
                    const productId = document.getElementById('productId').value;
                    const actionType = document.getElementById('actionType').value;
                    const reason = document.getElementById('cancelReason').value === 'Other'
                        ? document.getElementById('otherReason').value
                        : document.getElementById('cancelReason').value;

                    if (!cancelForm.checkValidity()) return cancelForm.reportValidity();

                    const endpoint = actionType === 'cancel'
                        ? `/orders/${orderId}/cancel-item`
                        : `/orders/${orderId}/return`;

                    try {
                        const res = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderId, productId, reason })
                        });
                        const result = await res.json();

                        const modal = document.getElementById('cancelModal');
                        bootstrap.Modal.getInstance(modal).hide();

                        if (result.success) {
                            Swal.fire('Success', result.message, 'success').then(() => {
                                // Update badge
                                const card = document.querySelector(`[data-order-id="${orderId}"]`);
                                if (card && result.orderStatus) {
                                    const badge = card.querySelector('.status-badge');
                                    const status = result.orderStatus.toLowerCase();
                                    const displayText = 
                                        status === 'partially_returned' ? 'Partially Returned' :
                                        status === 'partially_cancelled' ? 'Partially Cancelled' :
                                        status === 'return_requested' ? 'Return Requested' :
                                        status.charAt(0).toUpperCase() + status.slice(1);

                                    badge.textContent = displayText;
                                    badge.className = 'status-badge ' + 
                                        (status === 'delivered' || status === 'completed' ? 'status-completed' :
                                         ['returned', 'partially_returned'].includes(status) ? 'status-returned' :
                                         ['cancelled', 'partially_cancelled'].includes(status) ? 'status-cancelled' :
                                         status === 'return_requested' ? 'status-return-requested' :
                                         status === 'shipped' ? 'status-shipped' : 'status-processing');
                                    card.dataset.status = status;
                                    applyLiveSearch();
                                }
                            });
                        } else {
                            Swal.fire('Error', result.message || 'Failed', 'error');
                        }
                    } catch (err) {
                        console.error(err);
                        Swal.fire('Error', 'Network error', 'error');
                    }
                });
            }
        });

        window.retryPayment = retryPayment;

