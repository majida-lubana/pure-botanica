/* global Swal */

let isEditMode = false;
let editCouponId = null;

// Set minimum date for start date (today)
document.getElementById('startDate').min = new Date().toISOString().split('T')[0];

function openAddModal() {
    isEditMode = false;
    editCouponId = null;

    document.getElementById('modalTitle').textContent = 'Add New Coupon';
    document.getElementById('submitBtn').textContent = 'Create Coupon';
    document.getElementById('couponForm').reset();
    document.getElementById('couponModal').classList.remove('hidden');

    // 🔑 IMPORTANT: bind after modal is visible
    const discountTypeSelect = document.getElementById('discountType');
if (discountTypeSelect) {
    discountTypeSelect.removeEventListener('change', toggleMaxDiscountField);
    discountTypeSelect.addEventListener('change', toggleMaxDiscountField);
}

    toggleMaxDiscountField();
}


async function editCoupon(id) {
    try {
        const response = await fetch(`/admin/coupon/${id}`);
        const data = await response.json();
        
        if (data.success) {
            isEditMode = true;
            editCouponId = id;

            document.getElementById('modalTitle').textContent = 'Edit Coupon';
            document.getElementById('submitBtn').textContent = 'Update Coupon';

            const coupon = data.coupon;

            document.getElementById('name').value = coupon.name;
            document.getElementById('couponCode').value = coupon.couponCode;
            document.getElementById('discountType').value = coupon.discountType;
            document.getElementById('offerPrice').value = coupon.offerPrice;
            document.getElementById('minimumPrice').value = coupon.minimumPrice;
            document.getElementById('usageLimit').value = coupon.usageLimit;
            document.getElementById('startDate').value = coupon.startDate.split('T')[0];
            document.getElementById('expireOn').value = coupon.expireOn.split('T')[0];
            document.getElementById('description').value = coupon.description || '';

            // Max Discount value
            document.getElementById('maxDiscount').value = coupon.maxDiscount || '';

            // 🔑 OPEN MODAL FIRST
            document.getElementById('couponModal').classList.remove('hidden');

            // 🔑 BIND CHANGE EVENT AFTER MODAL IS OPEN
            const discountTypeSelect = document.getElementById('discountType');
            if (discountTypeSelect) {
                discountTypeSelect.removeEventListener('change', toggleMaxDiscountField);
                discountTypeSelect.addEventListener('change', toggleMaxDiscountField);
            }

            // 🔑 UPDATE VISIBILITY BASED ON VALUE
            toggleMaxDiscountField();

        } else {
            Swal.fire('Error', data.message || 'Failed to load coupon', 'error');
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Failed to load coupon details', 'error');
    }
}


function closeModal() {
    document.getElementById('couponModal').classList.add('hidden');
    document.getElementById('couponForm').reset();
    isEditMode = false;
    editCouponId = null;
}

// MAIN FORM SUBMISSION WITH CLIENT-SIDE VALIDATION
document.getElementById('couponForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errors = [];

    // Grab and trim values
    const name = document.getElementById('name').value.trim();
    const couponCode = document.getElementById('couponCode').value.trim();
    const discountType = document.getElementById('discountType').value;
    const offerPriceInput = document.getElementById('offerPrice').value;
    const minimumPriceInput = document.getElementById('minimumPrice').value;
    const usageLimitInput = document.getElementById('usageLimit').value;
    const startDate = document.getElementById('startDate').value;
    const expireOn = document.getElementById('expireOn').value;

    const offerPrice = parseFloat(offerPriceInput);
    const minimumPrice = parseFloat(minimumPriceInput);
    const usageLimit = parseInt(usageLimitInput, 10);

    // Validation rules
    if (name.length < 3) errors.push('Coupon name must be at least 3 characters');
    if (couponCode.length < 4) errors.push('Coupon code must be at least 4 characters');
    if (!discountType) errors.push('Please select a discount type');
    if (isNaN(offerPrice) || offerPrice <= 0) errors.push('Discount value must be greater than 0');
    if (isNaN(minimumPrice) || minimumPrice < 0) errors.push('Minimum order value must be 0 or greater');
    if (isNaN(usageLimit) || usageLimit <= 0) errors.push('Usage limit must be at least 1');

    // Max discount validation (added)
    const maxDiscountInput = document.getElementById('maxDiscount').value.trim();
    let maxDiscount = null;
    if (maxDiscountInput !== '') {
        maxDiscount = parseFloat(maxDiscountInput);
        if (isNaN(maxDiscount) || maxDiscount < 0) {
            errors.push('Max discount must be 0 or greater');
        }
        if (discountType === 'percentage' && maxDiscount !== null && maxDiscount > 0 && maxDiscount < offerPrice) {
            errors.push('Max discount is lower than the discount value itself — this will cap every usage');
        }
    }

    // Percentage-specific rules
    if (discountType === 'percentage') {
        if (offerPrice < 1 || offerPrice > 90) {
            errors.push('Percentage discount must be between 1% and 90%');
        }
    }

    // Fixed amount rule
    if (discountType === 'fixed' && offerPrice > minimumPrice) {
        errors.push('Fixed discount cannot exceed the minimum order amount');
    }

    // Date validation
    if (startDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDateObj = new Date(startDate);

        if (startDateObj < today) {
            errors.push('Start date cannot be in the past');
        }

        if (expireOn) {
            const expireDateObj = new Date(expireOn);
            if (expireDateObj <= startDateObj) {
                errors.push('Expire date must be after the start date');
            }
        }
    }

    // If any errors, show them and stop submission
    if (errors.length > 0) {
        Swal.fire({
            icon: 'error',
            title: 'Please fix the following:',
            html: errors.map(err => `<strong>•</strong> ${err}`).join('<br><br>'),
            confirmButtonColor: '#667eea'
        });
        return;
    }

    // Prepare data for submission
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.couponCode = data.couponCode.toUpperCase().trim();

    const url = isEditMode ? `/admin/coupon/${editCouponId}` : '/admin/coupon/add';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: result.message,
                confirmButtonColor: '#10b981'
            }).then(() => {
                location.reload();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: result.message || 'Something went wrong',
                confirmButtonColor: '#ef4444'
            });
        }
    } catch (error) {
        console.error('Submission error:', error);
        Swal.fire('Error', 'Failed to connect to server. Please try again.', 'error');
    }
});

// Toggle coupon status (Active/Inactive)
async function toggleStatus(id) {
    try {
        const response = await fetch(`/admin/coupon/toggle/${id}`, { method: 'PUT' });
        const data = await response.json();
        
        if (data.success) {
            Swal.fire('Success', data.message, 'success').then(() => location.reload());
        } else {
            Swal.fire('Error', data.message, 'error');
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Failed to update status', 'error');
    }
}

// Delete coupon
async function deleteCoupon(id) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: "This coupon will be permanently deleted!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/coupon/${id}`, { method: 'DELETE' });
            const data = await response.json();
            
            if (data.success) {
                Swal.fire('Deleted!', data.message, 'success').then(() => location.reload());
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Failed to delete coupon', 'error');
        }
    }
}

// Search functionality
function searchCoupons() {
    const search = document.getElementById('searchInput').value.trim();
    window.location.href = `/admin/coupons?search=${encodeURIComponent(search)}`;
}

function clearSearch() {
    window.location.href = '/admin/coupons';
}

document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchCoupons();
    }
});

// ───────────────────────────────────────────────
// Max Discount field visibility logic
// ───────────────────────────────────────────────


function toggleMaxDiscountField() {
    const discountTypeSelect = document.getElementById('discountType');
    const maxDiscountGroup = document.getElementById('maxDiscountGroup');
    const maxDiscountInput = document.getElementById('maxDiscount');

    if (!discountTypeSelect || !maxDiscountGroup) return;

    if (discountTypeSelect.value === 'percentage') {
        maxDiscountGroup.classList.remove('hidden');
    } else {
        maxDiscountGroup.classList.add('hidden');
        if (maxDiscountInput) maxDiscountInput.value = '';
    }
}


discountTypeSelect.addEventListener('change', toggleMaxDiscountField);

document.addEventListener('DOMContentLoaded', toggleMaxDiscountField);

// Make functions available globally (already in your code)
window.openAddModal = openAddModal;
window.editCoupon = editCoupon;
window.closeModal = closeModal;
window.toggleStatus = toggleStatus;
window.deleteCoupon = deleteCoupon;
window.clearSearch = clearSearch;