/* global Razorpay */

const originalTotal = window.checkoutConfig.total;
const originalSubtotal = window.checkoutConfig.subtotal;
let appliedCouponData = null;

  document.addEventListener("DOMContentLoaded", function () {
    const addAddressBtn = document.getElementById("add-address-btn");
    const addressModal = document.getElementById("address-modal");
    const cancelAddressBtn = document.getElementById("cancel-address");
    const closeModalBtn = document.getElementById("close-modal");
    const newAddressForm = document.getElementById("new-address-form");
    const saveAddressBtn = document.getElementById("save-address-btn");
    const checkoutForm = document.getElementById("checkout-form");
    const placeOrderBtn = document.getElementById("place-order-btn");
    const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
    const paymentOptions = document.querySelectorAll(".payment-option");
    let isEditMode = false;
    let currentAddressId = null;

    const Swal = window.Swal || window.SweetAlert2;

    // Open add address modal if no addresses
    if (document.querySelectorAll(".address-card").length === 0) {
      addAddressBtn?.click();
    }

    // ==================== MODAL CONTROLS ====================
    addAddressBtn?.addEventListener("click", () => {
      isEditMode = false;
      currentAddressId = null;
      document.querySelector("#address-modal h3").textContent = "Add New Address";
      newAddressForm.reset();
      clearErrors();
      addressModal.classList.remove("hidden");
    });

    function closeModal() {
      addressModal.classList.add("hidden");
      newAddressForm.reset();
      clearErrors();
      isEditMode = false;
      currentAddressId = null;
      document.querySelector("#address-modal h3").textContent = "Add New Address";
    }

    cancelAddressBtn?.addEventListener("click", closeModal);
    closeModalBtn?.addEventListener("click", closeModal);
    addressModal?.addEventListener("click", (e) => {
      if (e.target === addressModal) closeModal();
    });

    // ==================== ADDRESS SELECTION ====================
    function attachCardSelection(card) {
      card.addEventListener("click", (e) => {
        if (e.target.tagName !== "A" && !e.target.closest("a")) {
          document.querySelectorAll(".address-card").forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
          card.querySelector('input[type="radio"]').checked = true;
          document.getElementById("address-error")?.classList.add("hidden");
          placeOrderBtn.disabled = false;
        }
      });
    }

    document.querySelectorAll(".address-card").forEach(attachCardSelection);

    // ==================== PAYMENT SELECTION ====================
    paymentRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        paymentOptions.forEach((opt) => {
          opt.classList.toggle("selected", opt.querySelector('input[type="radio"]') === radio);
        });
        document.getElementById("payment-error")?.classList.add("hidden");
      });
    });

    paymentOptions.forEach((opt) => {
      opt.addEventListener("click", () => {
        const radio = opt.querySelector('input[type="radio"]');
        if (radio && !radio.disabled) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change"));
        }
      });
    });

    // ==================== EDIT ADDRESS ====================
    async function editAddress(e) {
  e.preventDefault();
  e.stopPropagation();

  const btn = e.currentTarget;
  const id = btn.dataset.addressId || btn.dataset.id;

  if (!id) {
    Swal.fire("Error", "Invalid address selected", "error");
    return;
  }

  try {
    const res = await fetch(`/address/${id}`);
    const data = await res.json();

    if (!data.success) {
      return Swal.fire("Error", data.message || "Failed to load address", "error");
    }

    const a = data.address;

    document.querySelector('[name="fullName"]').value = a.fullName;
    document.querySelector('[name="phone"]').value = a.phone;
    document.querySelector('[name="address"]').value = a.address;
    document.querySelector('[name="city"]').value = a.city;
    document.querySelector('[name="state"]').value = a.state;
    document.querySelector('[name="country"]').value = a.country;
    document.querySelector('[name="pincode"]').value = a.pincode;
    document.querySelector('[name="addressType"]').value = a.addressType;
    document.querySelector('[name="isDefault"]').checked = !!a.isDefault;

    isEditMode = true;
    currentAddressId = id;
    document.querySelector("#address-modal h3").textContent = "Edit Address";
    clearErrors();
    addressModal.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Could not load address", "error");
  }
}


    // ==================== REMOVE ADDRESS ====================
    async function removeAddress(e) {
      e.preventDefault();
      e.stopPropagation();
      const btn = e.currentTarget;
      const id = btn.dataset.addressId;

      Swal.fire({
        title: "Remove address?",
        text: "This cannot be undone.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        confirmButtonText: "Yes, remove"
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            const res = await fetch(`/address/${id}`, { method: "DELETE" });

            const data = await res.json();
            if (data.success) {
              Swal.fire("Removed!", "Address deleted.", "success");
              const card = btn.closest(".address-card");
              card.remove();

              const remaining = document.querySelectorAll(".address-card");
              placeOrderBtn.disabled = remaining.length === 0;
              if (remaining.length === 0) {
                document.getElementById("no-address-message")?.classList.remove("hidden");
                addAddressBtn?.click();
              }
            } else {
              Swal.fire("Error", data.message || "Failed to remove", "error");
            }
          } catch (err) {
            console.error(err);
            Swal.fire("Error", "Network error", "error");
          }
        }
      });
    }

    // Attach initial edit/remove
    document.querySelectorAll(".edit-address").forEach((btn) => btn.addEventListener("click", editAddress));
    document.querySelectorAll(".remove-address").forEach((btn) => btn.addEventListener("click", removeAddress));

    // ==================== SAVE ADDRESS (ADD/EDIT) ====================
    newAddressForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      saveAddressBtn.disabled = true;
      saveAddressBtn.textContent = "Saving...";

      const formData = new FormData(newAddressForm);
      const data = Object.fromEntries(formData);
      data.isDefault = formData.has("isDefault");

      if (!validateForm(data)) {
        Swal.fire("Validation Error", "Please fix the errors in the form", "error");
        saveAddressBtn.disabled = false;
        saveAddressBtn.textContent = "Save Address";
        return;
      }

      const url = isEditMode
  ? `/address/edit/${currentAddressId}`
  : `/address/add`;

      const method = isEditMode ? "PUT" : "POST";

      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok && result.success) {
          Swal.fire("Success", isEditMode ? "Address updated" : "Address added", "success");

          const addressList = document.getElementById("address-list");
          const noMsg = document.getElementById("no-address-message");
          const addr = result.address;

          if (isEditMode) {
            const card = document.querySelector(`.address-card[data-address-id="${currentAddressId}"]`);
            if (card) {
              card.querySelector("label").textContent = addr.fullName || addr.name;
              card.querySelector("p").innerHTML = `${addr.address}<br>${addr.city}, ${addr.state}<br>${addr.country} - ${addr.pincode || addr.pinCode}<br>Phone: ${addr.phone}`;
              card.querySelector(".bg-gray-200").textContent = addr.addressType;
              if (addr.isDefault) {
                document.querySelectorAll(".address-card").forEach((c) => c.classList.remove("selected"));
                card.classList.add("selected");
                card.querySelector('input[type="radio"]').checked = true;
              }
            }
          } else {
            // Add new card
            const card = document.createElement("div");
            card.className = `address-card bg-gray-50 border rounded-lg p-4 ${addr.isDefault ? "selected" : ""}`;
            card.dataset.addressId = addr._id;
            card.innerHTML = `
              <div class="flex items-start mb-3">
                <input type="radio" name="selectedAddress" id="address-${addr._id}" value="${addr._id}" ${addr.isDefault ? "checked" : ""} class="mt-1 mr-2">
                <div class="flex-1">
                  <label for="address-${addr._id}" class="font-medium text-gray-800 block mb-1 cursor-pointer">
                    ${addr.fullName || addr.name}
                  </label>
                  <div class="flex flex-wrap gap-1 mb-2">
                    <span class="inline-block bg-gray-200 text-gray-700 px-2 py-1 text-xs rounded">${addr.addressType}</span>
                    ${addr.isDefault ? '<span class="inline-block bg-black text-white px-2 py-1 text-xs rounded">Default</span>' : ""}
                  </div>
                  <p class="text-gray-600 text-sm leading-relaxed">
                    ${addr.address}<br>${addr.city}, ${addr.state}<br>${addr.country} - ${addr.pincode || addr.pinCode}<br>Phone: ${addr.phone}
                  </p>
                </div>
              </div>
              <div class="flex justify-end space-x-2 mt-3 pt-3 border-t border-gray-200 text-sm">
                <a href="#" class="text-black hover:text-gray-600 edit-address" data-address-id="${addr._id}"><i class="fas fa-edit mr-1"></i>Edit</a>
                <span class="text-gray-300">|</span>
                <a href="#" class="text-gray-600 hover:text-red-600 remove-address" data-address-id="${addr._id}"><i class="fas fa-trash mr-1"></i>Remove</a>
              </div>
            `;
            addressList.appendChild(card);
            if (noMsg) noMsg.classList.add("hidden");
            placeOrderBtn.disabled = false;

            // Re-attach events to new card
            attachCardSelection(card);
            card.querySelector(".edit-address").addEventListener("click", editAddress);
            card.querySelector(".remove-address").addEventListener("click", removeAddress);

            if (addr.isDefault) {
              card.querySelector('input[type="radio"]').checked = true;
              card.classList.add("selected");
            }
          }
          closeModal();
        } else {
          Swal.fire("Error", result.message || "Failed to save address", "error");
        }
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "Network error", "error");
      } finally {
        saveAddressBtn.disabled = false;
        saveAddressBtn.textContent = "Save Address";
      }
    });

    // ==================== FORM VALIDATION ====================
    function validateForm(data) {
      let valid = true;
      clearErrors();
      const phonePattern = /^\d{10}$/;
      const pinPattern = /^\d{6}$/;

      if (!data.fullName?.trim()) { showError("fullName", "Full name required"); valid = false; }
      if (!data.phone || !phonePattern.test(data.phone)) { showError("phone", "Valid 10-digit phone"); valid = false; }
      if (!data.address?.trim()) { showError("address", "Address required"); valid = false; }
      if (!data.city?.trim()) { showError("city", "City required"); valid = false; }
      if (!data.state?.trim()) { showError("state", "State required"); valid = false; }
      if (!data.country?.trim()) { showError("country", "Country required"); valid = false; }
      if (!data.pincode || !pinPattern.test(data.pincode)) { showError("pincode", "Valid 6-digit pin"); valid = false; }
      if (!data.addressType?.trim()) { showError("addressType", "Address type required"); valid = false; }

      return valid;
    }

    function showError(field, msg) {
      const el = document.querySelector(`[name="${field}"]`);
      const err = document.getElementById(`error-${field}`);
      if (el) el.classList.add("error");
      if (err) {
        err.textContent = msg;
        err.classList.add("show");
      }
    }

    function clearErrors() {
      newAddressForm.querySelectorAll(".input-field").forEach((i) => i.classList.remove("error"));
      newAddressForm.querySelectorAll(".error-message").forEach((d) => {
        d.textContent = "";
        d.classList.remove("show");
      });
    }

    // ==================== COUPON FUNCTIONS ====================
    async function applyCoupon() {
      const couponCode = document.getElementById('couponCode')?.value.trim();
      const warningDiv = document.getElementById('coupon-warning');

      if (!couponCode) {
        showCouponWarning('Please enter a coupon code', 'error');
        return;
      }

      try {
        const response = await fetch('/apply-coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ couponCode, cartTotal: originalSubtotal })
        });

        const data = await response.json();

        if (data.success) {
          appliedCouponData = data.coupon;
          showAppliedCoupon(data.coupon);
          updatePriceSummary(data.coupon.discountAmount);
          showCouponWarning(`Coupon "${data.coupon.code}" applied successfully!`, 'success');
          document.getElementById('coupon-input-section').style.display = 'none';
        } else {
          showCouponWarning(data.message || 'Invalid coupon', 'error');
          appliedCouponData = null;
        }
      } catch (error) {
        console.error(error);
        showCouponWarning('Failed to apply coupon. Try again.', 'error');
      }
    }

    function removeCoupon() {
      appliedCouponData = null;
      document.getElementById('applied-coupon').style.display = 'none';
      document.getElementById('coupon-input-section').style.display = 'block';
      document.getElementById('couponCode').value = '';
      updatePriceSummary(0);
      document.getElementById('coupon-warning').style.display = 'none';
    }

    function showAppliedCoupon(coupon) {
      document.getElementById('applied-coupon-name').textContent = coupon.name;
      document.getElementById('applied-coupon-amount').textContent = coupon.discountAmount.toFixed(2);
      document.getElementById('applied-coupon').style.display = 'flex';
    }

    function updatePriceSummary(discountAmount) {
      const couponDiscountRow = document.getElementById('coupon-discount-row');
      const couponDiscountDisplay = document.getElementById('coupon-discount-display');
      const finalTotalElement = document.getElementById('final-total');

      if (discountAmount > 0) {
        couponDiscountRow.style.display = 'flex';
        couponDiscountDisplay.textContent = `-₹${discountAmount.toFixed(2)}`;
        finalTotalElement.textContent = `₹${(originalTotal - discountAmount).toFixed(2)}`;
      } else {
        couponDiscountRow.style.display = 'none';
        finalTotalElement.textContent = `₹${originalTotal.toFixed(2)}`;
      }
    }

    function showCouponWarning(message, type) {
      const warningDiv = document.getElementById('coupon-warning');
      warningDiv.textContent = message;
      warningDiv.className = `coupon-warning show ${type}`;
      warningDiv.style.display = 'block';

      if (type === 'success') {
        setTimeout(() => { warningDiv.style.display = 'none'; }, 5000);
      }
    }

    // Attach coupon buttons
    document.getElementById('apply-coupon-btn')?.addEventListener('click', applyCoupon);
    document.getElementById('remove-coupon-btn')?.addEventListener('click', removeCoupon);

    // ==================== AVAILABLE COUPONS MODAL ====================
    async function showAvailableCoupons() {
      const modal = document.getElementById('coupons-modal');
      const loadingDiv = document.getElementById('coupons-loading');
      const couponsList = document.getElementById('coupons-list');

      modal.classList.remove('hidden');
      loadingDiv.style.display = 'block';
      couponsList.innerHTML = '';

      try {
        const response = await fetch(`/available-coupons?cartTotal=${originalSubtotal}`);
        const data = await response.json();

        loadingDiv.style.display = 'none';

        if (data.success && data.coupons.length > 0) {
          data.coupons.forEach((coupon, index) => {
            const card = createCouponCard(coupon, index);
            couponsList.appendChild(card);
          });
        } else {
          couponsList.innerHTML = `<div class="text-center py-8 text-gray-500">No coupons available</div>`;
        }
      } catch (error) {
        console.error(error);
        loadingDiv.style.display = 'none';
        couponsList.innerHTML = `<div class="text-center py-8 text-red-500">Failed to load coupons</div>`;
      }
    }

    function createCouponCard(coupon, index) {
      const card = document.createElement('div');
      const gradients = ['from-purple-500 to-pink-500', 'from-blue-500 to-cyan-500', 'from-green-500 to-teal-500', 'from-orange-500 to-red-500', 'from-indigo-500 to-purple-500'];
      const gradient = gradients[index % gradients.length];

      card.className = `p-4 rounded-lg bg-gradient-to-r ${gradient} text-white relative overflow-hidden ${!coupon.isUsable ? 'opacity-60' : ''}`;

      card.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h4 class="text-lg font-bold mb-1">${coupon.name}</h4>
            <p class="text-2xl font-bold mb-2">
              ${coupon.discountType === 'percentage' ? coupon.offerPrice + '% OFF' : '₹' + coupon.offerPrice + ' OFF'}
            </p>
            <div class="text-sm opacity-90 space-y-1">
              <p><i class="fas fa-shopping-cart mr-1"></i> Min order: ₹${coupon.minimumPrice}</p>
              <p><i class="fas fa-calendar-alt mr-1"></i> Valid till: ${new Date(coupon.expireOn).toLocaleDateString()}</p>
              ${coupon.discountAmount > 0 ? `<p class="text-yellow-200"><i class="fas fa-tag mr-1"></i> You save: ₹${coupon.discountAmount}</p>` : ''}
            </div>
          </div>
          <div class="text-center">
            <div class="bg-white bg-opacity-20 p-2 rounded mb-2">
              <p class="text-xs opacity-75">CODE</p>
              <p class="font-mono font-bold">${coupon.couponCode}</p>
            </div>
            ${coupon.isUsable
              ? `<button class="use-coupon-btn bg-white text-gray-800 px-3 py-1 rounded text-sm font-semibold hover:bg-opacity-90" data-code="${coupon.couponCode}">Use Code</button>`
              : `<div class="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">${coupon.reason || 'Not applicable'}</div>`
            }
          </div>
        </div>
      `;
      return card;
    }

    // Attach "Use Code" buttons dynamically
    document.getElementById('coupons-modal').addEventListener('click', (e) => {
      if (e.target.classList.contains('use-coupon-btn')) {
        const code = e.target.dataset.code;
        document.getElementById('couponCode').value = code;
        document.getElementById('coupons-modal').classList.add('hidden');
        applyCoupon();
      }
    });

    document.getElementById('view-coupons-btn')?.addEventListener('click', showAvailableCoupons);
    document.querySelector('#coupons-modal .close-modal')?.addEventListener('click', () => {
      document.getElementById('coupons-modal').classList.add('hidden');
    });

    // ==================== ORDER SUBMISSION (COD/WALLET) ====================
    async function submitOrder() {
      const btn = placeOrderBtn;
      btn.disabled = true;
      btn.textContent = "Processing...";

      try {
        const formData = new FormData(checkoutForm);
        const data = Object.fromEntries(formData);
        if (appliedCouponData) data.couponCode = appliedCouponData.code;

        const res = await fetch(checkoutForm.action, {
          method: checkoutForm.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success && result.orderId) {
          Swal.fire({ icon: "success", title: "Order Placed!", text: "Redirecting..." });
          setTimeout(() => location.href = `/order-success?orderId=${result.orderId}&finalAmount=${result.finalAmount}&paymentMethod=${result.paymentMethod}`, 1200);
        } else {
          throw new Error(result.message || "Order failed");
        }
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      } finally {
        btn.disabled = false;
        btn.textContent = "Place Order";
      }
    }

    // ==================== MAIN CHECKOUT SUBMIT ====================
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
      const selectedAddress = document.querySelector('input[name="selectedAddress"]:checked')?.value;

      if (!selectedAddress) return Swal.fire("Error", "Please select a shipping address", "error");
      if (!paymentMethod) return Swal.fire("Error", "Please select a payment method", "error");

      // Block Razorpay if disabled
if (paymentMethod === "razorpay" && !window.razorpayEnabled) {
  return Swal.fire(
    "Payment unavailable",
    "Online payment is currently disabled. Please choose COD or Wallet.",
    "warning"
  );
}

// Non-Razorpay flow
if (paymentMethod !== "razorpay") {
  return submitOrder();
}


      // Razorpay flow...
      const btn = placeOrderBtn;
      btn.disabled = true;
      btn.textContent = "Creating Order...";

      try {
        const formData = new FormData(checkoutForm);
        const data = Object.fromEntries(formData);
        if (appliedCouponData) data.couponCode = appliedCouponData.code;

        const res = await fetch("/checkout/place-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const result = await res.json();

        if (!result.success || !result.razorpay) {
          throw new Error(result.message || "Failed to create order");
        }

        const options = {
          key: result.key_id,
          amount: result.amount,
          currency: "INR",
          name: "Beauty Cart",
          description: "Order Payment",
          order_id: result.razorpayOrderId,
          retry: false,
          handler: async function (response) {
            const verifyRes = await fetch("/checkout/verify-razorpay", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId: result.orderId
              })
            });
            const vData = await verifyRes.json();

            if (vData.success) {
              Swal.fire("Success!", "Payment successful!", "success");
              setTimeout(() => location.href = `/order-success?orderId=${vData.orderId}&finalAmount=${vData.finalAmount}&paymentMethod=${vData.paymentMethod}`, 1500);
            } else {
              Swal.fire("Failed", vData.message || "Payment verification failed", "error");
            }
          },
          prefill: {},
          theme: { color: "#000000" },
          modal: {
            ondismiss: () => {
              window.location.href = `/order-error?message=Payment%20Cancelled&details=You%20cancelled%20the%20payment.&orderId=${result.orderId}&finalAmount=${result.finalAmount}`;
            }
          }
        };

        const rzp = new Razorpay(options);
        rzp.on("payment.failed", async (resp) => {
          await fetch('/checkout/handle-payment-failure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: result.orderId, error: resp.error })
          });
          window.location.href = `/order-error?message=Payment%20Failed&details=${encodeURIComponent(resp.error?.description || 'Unknown error')}&orderId=${result.orderId}&finalAmount=${result.finalAmount}`;
        });

        rzp.open();
        btn.disabled = false;
        btn.textContent = "Place Order";
      } catch (err) {
        Swal.fire("Error", err.message || "Something went wrong", "error");
        btn.disabled = false;
        btn.textContent = "Place Order";
      }
    });
  });
