
  /* global Swal, Razorpay */

    let currentOrderId = null;
    let currentProductId = null;

    // Show Cancel Item Modal
    function showCancelItemModal(orderId, productId) {
      currentOrderId = orderId;
      currentProductId = productId;
      const modal = document.getElementById('cancelItemModal');
      modal.classList.add('show');
      setTimeout(() => {
        document.getElementById('cancelItemReasonSelect').focus()
      }, 100);
    }

    // Hide Cancel Item Modal
    function hideCancelItemModal() {
      const modal = document.getElementById('cancelItemModal');
      modal.classList.remove('show');
      document.getElementById('cancelItemForm').reset();
    }

    // Close modal on outside click
    document.getElementById('cancelItemModal').addEventListener('click', function(e) {
      if (e.target === this) {
        hideCancelItemModal();
      }
    });

    document.getElementById('cancelItemForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const reasonSelect = document.getElementById('cancelItemReasonSelect');
      const reasonText = document.getElementById('cancelItemReasonText');
      let reason = '';

      // Determine which value to use
      if (reasonSelect.value === 'Other') {
        reason = reasonText.value.trim();
      } else {
        reason = reasonSelect.value.trim();
      }

      // Validation
      if (!reason) {
        Swal.fire({
          icon: 'warning',
          title: 'Missing Reason',
          text: 'Please provide a reason for cancellation.',
        });
        return;
      }

      try {
        const response = await fetch(`/orders/${currentOrderId}/cancel-item`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orderId: currentOrderId,
            productId: currentProductId,
            reason: reason
          })
        });

        const data = await response.json();

        await Swal.fire({
          icon: data.success ? 'success' : 'error',
          title: data.success ? 'Success' : 'Error',
          text: data.message || (data.success ? 'Item cancelled successfully' : 'Failed to cancel item')
        });

        if (data.success) {
          hideCancelItemModal();
          location.reload();
        }

      } catch (error) {
        console.error('Error cancelling item:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to cancel item. Please try again.'
        });
      }
    });

    function toggleOtherReasonField(type) {
      const select = document.getElementById(`${type}ReasonSelect`);
      const otherReasonDiv = document.getElementById(`${type}OtherReason`);
      
      if (select && otherReasonDiv) {
        if (select.value === "Other") {
          otherReasonDiv.style.display = "block";
        } else {
          otherReasonDiv.style.display = "none";
        }
      }
    }

    // Return Item
    async function returnItem(orderId, productId) {
      try {
        const { value: reason } = await Swal.fire({
          title: 'Request Return',
          input: 'textarea',
          inputLabel: 'Please provide a reason for return',
          inputPlaceholder: 'Enter your reason here...',
          showCancelButton: true,
          confirmButtonText: 'Submit Return Request',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#3b82f6',
          inputValidator: (value) => {
            if (!value || !value.trim()) {
              return 'You need to provide a reason!';
            }
          }
        });

        if (reason) {
          const response = await fetch(`/orders/${orderId}/return`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              orderId: orderId, 
              productId: productId, 
              reason: reason.trim() 
            })
          });

          const data = await response.json();
          
          await Swal.fire({
            icon: data.success ? 'success' : 'error',
            title: data.success ? 'Success' : 'Error',
            text: data.message || (data.success ? 'Return request submitted successfully' : 'Failed to request return')
          });

          if (data.success) {
            location.reload();
          }
        }
      } catch (error) {
        console.error('Error requesting return:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to request return. Please try again.'
        });
      }
    }

    // ENHANCED: Retry Payment Function
    async function retryPayment(orderId) {
      const button = event.target;
      const originalText = button.innerHTML;
      
      // Show loading state
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
      
      try {
        const response = await fetch(`/checkout/retry-payment/${orderId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || 'Failed to create payment order');
        }

        // Show payment initialization
        await Swal.fire({
          icon: 'info',
          title: 'Payment Gateway Loading',
          text: 'Please wait while we initialize the payment...',
          timer: 1500,
          showConfirmButton: false
        });

        const options = {
          key: data.key_id,
          amount: data.amount,
          currency: "INR",
          name: "Beauty Cart",
          description: "Order Payment Retry",
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
                  orderId: data.orderId
                })
              });
              const vData = await verifyRes.json();

              if (vData.success) {
                await Swal.fire({ 
                  icon: "success", 
                  title: "Payment Successful!", 
                  text: "Your order has been confirmed. Refreshing page...",
                  timer: 2000,
                  showConfirmButton: false
                });
                setTimeout(() => location.reload(), 2000);
              } else {
                throw new Error(vData.message || "Payment verification failed");
              }
            } catch (error) {
              console.error('Payment verification error:', error);
              await Swal.fire({ 
                icon: "error", 
                title: "Payment Verification Failed", 
                text: error.message || "Please contact support if amount was debited."
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
                text: 'You can retry anytime from this page.'
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
                orderId: data.orderId,
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
            text: resp.error?.description || 'Payment failed. You can try again from this page.'
          });
        });
        
        // Open Razorpay
        rzp.open();

      } catch (error) {
        console.error('Error retrying payment:', error);
        
        // Reset button state
        button.disabled = false;
        button.innerHTML = originalText;
        
        await Swal.fire({
          icon: 'error',
          title: 'Unable to Process Payment',
          text: error.message || 'Failed to initialize payment. Please try again.'
        });
      }
    }

    // Download Invoice
   function downloadInvoice() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('INVOICE', 105, 20, { align: 'center' });

    // Order Details
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Order ID: ${orderData.orderID}`, 20, 35);
    doc.text(`Order Date: ${orderData.orderDate}`, 20, 42);
    if (orderData.invoiceDate) {
      doc.text(`Invoice Date: ${orderData.invoiceDate}`, 20, 49);
    }

    // Shipping Address
    doc.setFont(undefined, 'bold');
    doc.text('Shipping Address:', 20, 60);
    doc.setFont(undefined, 'normal');
    doc.text(orderData.shippingAddress.name, 20, 67);
    doc.text(orderData.shippingAddress.address, 20, 74, { maxWidth: 170 });
    doc.text(`${orderData.shippingAddress.city}, ${orderData.shippingAddress.state}`, 20, 81);
    doc.text(`${orderData.shippingAddress.country} - ${orderData.shippingAddress.pinCode}`, 20, 88);
    doc.text(`Phone: ${orderData.shippingAddress.phone}`, 20, 95);

    // Order Items
    let yPos = 110;
    doc.setFont(undefined, 'bold');
    doc.text('Order Items:', 20, yPos);
    doc.setFont(undefined, 'normal');
    yPos += 7;

    orderData.items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.productName}`, 20, yPos);
      yPos += 7;
      doc.text(`Quantity: ${item.quantity} | Price: ₹${item.purchasePrice.toFixed(2)}`, 20, yPos);
      yPos += 10;
    });

    // Order Summary (similarly use orderData fields)
    // ... (adapt the rest similarly)

    // Final save
    doc.save(`Invoice_${orderData.orderID}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to generate invoice. Please try again.'
    });
  }
}

    // Prevent modal from opening on page load
    window.addEventListener('DOMContentLoaded', () => {
      console.log('Order details page loaded');
    });



const orderData = window.orderData;


window.showCancelItemModal = showCancelItemModal;
window.toggleOtherReasonField = toggleOtherReasonField;
window.returnItem = returnItem;
window.retryPayment = retryPayment;
window.downloadInvoice = downloadInvoice;
