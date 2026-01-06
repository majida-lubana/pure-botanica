/* global Swal */
/* global bootstrap */

        let deleteContext = null;

        function showLoading(button, text = 'Loading...') {
            if (button) {
                button.disabled = true;
                button.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${text}`;
            }
        }

        function hideLoading(button, text = 'Save') {
            if (button) {
                button.disabled = false;
                button.innerHTML = text;
            }
        }

        function cleanupModalBackdrop() {
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());
            document.body.classList.remove('modal-open');
            document.body.style = '';
        }

        function displayFieldErrors(errors, formPrefix = '') {
            console.log('Displaying errors:', errors, 'with prefix:', formPrefix);
            
            // Clear previous errors
            const fields = ['name', 'phone', 'address', 'city', 'state', 'country', 'pincode', 'addressType'];
            fields.forEach(field => {
                const errorElement = document.getElementById(`${formPrefix}${field}Error`);
                const inputElement = document.getElementById(`${formPrefix}${field}`) || 
                                     document.querySelector(`input[name="${field}"]:checked`) || 
                                     document.querySelector(`select[name="${field}"]`);
                if (errorElement) errorElement.textContent = '';
                if (inputElement) inputElement.classList.remove('is-invalid');
            });

            // Clear fullName error for edit form
            if (formPrefix === 'edit') {
                const fullNameErrorElement = document.getElementById('editFullNameError');
                const fullNameInputElement = document.getElementById('editFullName');
                if (fullNameErrorElement) fullNameErrorElement.textContent = '';
                if (fullNameInputElement) fullNameInputElement.classList.remove('is-invalid');
            }

            if (!errors || typeof errors !== 'object') return;

            // Display new errors
            Object.keys(errors).forEach(field => {
                const errorMessages = errors[field];
                if (Array.isArray(errorMessages) && errorMessages.length > 0) {
                    let actualField = field;
                    
                    // Handle field name mapping for edit form
                    if (formPrefix === 'edit' && field === 'name') {
                        actualField = 'fullName';
                    }
                    
                    const errorElement = document.getElementById(`${formPrefix}${actualField}Error`);
                    const inputElement = document.getElementById(`${formPrefix}${actualField}`) || 
                                         document.querySelector(`input[name="${field}"]:checked`) || 
                                         document.querySelector(`select[name="${field}"]`);
                    
                    if (errorElement) {
                        errorElement.textContent = errorMessages[0]; // Show first error message
                    }
                    if (inputElement) {
                        inputElement.classList.add('is-invalid');
                    }
                    
                    console.log(`Set error for field ${actualField}: ${errorMessages[0]}`);
                }
            });
        }

        function createAddressHTML(address) {
            return `
                <div class="col-lg-6 col-md-12 mb-0" data-address-id="${address._id}">
                    <div class="address-card">
                        <div class="address-type ${address.addressType === 'Home' ? 'address-type-home' : 'address-type-work'}">
                            ${address.addressType}
                        </div>
                        <div class="address-name">
                            ${address.fullName}
                            ${address.isDefault ? '<span class="default-badge">Default</span>' : ''}
                        </div>
                        <div class="address-details">${address.address}</div>
                        <div class="address-details">
                            ${address.city}, ${address.state} ${address.pincode}
                        </div>
                        <div class="address-details">${address.country}</div>
                        <div class="address-details">Phone: ${address.phone}</div>
                        <div class="address-actions">
                            <button class="btn btn-sm btn-outline-secondary edit-address" data-id="${address._id}" data-bs-toggle="modal" data-bs-target="#editAddressModal">
                                <i class="fas fa-edit me-1"></i>Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-address" data-id="${address._id}">
                                <i class="fas fa-trash me-1"></i>Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        function saveNewAddress() {
            console.log('Saving new address...');
            const form = document.getElementById('addAddressForm');
            const saveBtn = document.getElementById('saveAddressBtn');

            showLoading(saveBtn, 'Saving...');

            const formData = {
                name: document.getElementById('name').value,
                phone: document.getElementById('phone').value,
                address: document.getElementById('address').value,
                city: document.getElementById('city').value,
                state: document.getElementById('state').value,
                country: document.getElementById('country').value,
                pincode: document.getElementById('pincode').value,
                addressType: document.querySelector('input[name="addressType"]:checked').value,
                isDefault: document.getElementById('addIsDefault').checked
            };

            console.log('Form data:', formData);

            fetch('/address/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })
            .then(response => response.json())
            .then(data => {
                console.log('Server response:', data);
                hideLoading(saveBtn, 'Save Address');

                if (data.success) {
                    const addressesContainer = document.getElementById('addressesContainer');
                    const addNewAddressCard = addressesContainer.querySelector('.add-address-card')?.closest('.col-lg-6');

                    if (addNewAddressCard) {
                        addNewAddressCard.insertAdjacentHTML('beforebegin', createAddressHTML(data.address));
                    } else {
                        addressesContainer.insertAdjacentHTML('beforeend', createAddressHTML(data.address));
                    }

                    if (data.address.isDefault) {
                        document.querySelectorAll('.address-card .default-badge').forEach(badge => {
                            const cardId = badge.closest('[data-address-id]')?.dataset.addressId;
                            if (cardId !== data.address._id) {
                                badge.remove();
                            }
                        });
                    }

                    const addAddressModal = bootstrap.Modal.getInstance(document.getElementById('addAddressModal'));
                    if (addAddressModal) {
                        addAddressModal.hide();
                    }

                    setTimeout(() => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Address Added!',
                            text: 'Your new address has been successfully added.',
                            showConfirmButton: false,
                            timer: 2000
                        });
                    }, 100);

                    form.reset();
                    document.getElementById('typeHome').checked = true;
                    document.getElementById('country').value = 'India';
                    displayFieldErrors({});
                } else {
                    console.log('Validation errors:', data.errors);
                    displayFieldErrors(data.errors);
                    
                    let errorMessage = 'Failed to add address';
                    if (data.errors && typeof data.errors === 'object') {
                        const errorMessages = Object.values(data.errors).flat();
                        if (errorMessages.length > 0) {
                            errorMessage = errorMessages.join('\n');
                        }
                    } else if (data.message) {
                        errorMessage = data.message;
                    }
                    
                    Swal.fire({
                        icon: 'error',
                        title: 'Validation Error',
                        text: errorMessage,
                        showConfirmButton: true
                    });
                }
            })
            .catch(error => {
                hideLoading(saveBtn, 'Save Address');
                console.error('Add address error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred while adding the address'
                });
            });
        }

        function updateAddress() {
            console.log('Updating address...');
            // const form = document.getElementById('editAddressForm');
            const updateBtn = document.getElementById('updateAddressBtn');
            const addressId = document.getElementById('editAddressId').value;

            showLoading(updateBtn, 'Updating...');

            const formData = {
                fullName: document.getElementById('editFullName').value,
                phone: document.getElementById('editPhone').value,
                address: document.getElementById('editAddress').value,
                city: document.getElementById('editCity').value,
                state: document.getElementById('editState').value,
                country: document.getElementById('editCountry').value,
                pincode: document.getElementById('editPincode').value,
                addressType: document.querySelector('input[name="addressType"]:checked').value,
                isDefault: document.getElementById('editIsDefault').checked
            };

            console.log('Update form data:', formData);

            fetch(`/address/edit/${addressId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })
            .then(response => response.json())
            .then(data => {
                console.log('Update response:', data);
                hideLoading(updateBtn, 'Save Changes');

                if (data.success) {
                    const addressCard = document.querySelector(`[data-address-id="${addressId}"]`);
                    if (addressCard) {
                        addressCard.outerHTML = createAddressHTML(data.address);

                        if (data.address.isDefault) {
                            document.querySelectorAll('.address-card .default-badge').forEach(badge => {
                                const cardId = badge.closest('[data-address-id]')?.dataset.addressId;
                                if (cardId !== data.address._id) {
                                    badge.remove();
                                }
                            });
                        }
                    }

                    const editAddressModal = bootstrap.Modal.getInstance(document.getElementById('editAddressModal'));
                    if (editAddressModal) {
                        editAddressModal.hide();
                    }

                    setTimeout(() => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Address Updated!',
                            text: 'Your address has been successfully updated.',
                            showConfirmButton: false,
                            timer: 2000
                        });
                    }, 100);

                    displayFieldErrors({}, 'edit');
                } else {
                    console.log('Update validation errors:', data.errors);
                    let errorMessage = data.message || 'Failed to update address';
                    
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: errorMessage,
                        showConfirmButton: true
                    });
                }
            })
            .catch(error => {
                hideLoading(updateBtn, 'Save Changes');
                console.error('Update address error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred while updating the address'
                });
            });
        }

        // Event listeners
        document.addEventListener('DOMContentLoaded', function () {
            console.log('DOM loaded, initializing event listeners...');
            const addressesContainer = document.getElementById('addressesContainer');

            // Edit Address
            addressesContainer.addEventListener('click', function (event) {
                const editBtn = event.target.closest('.edit-address');
                if (editBtn) {
                    console.log('Edit button clicked');
                    const addressId = editBtn.getAttribute('data-id');
                    console.log('Fetching address:', addressId);

                    fetch(`/address/${addressId}`)
                        .then(response => response.json())
                        .then(data => {
                            console.log('Fetched address data:', data);
                            if (data.success) {
                                const address = data.address;
                                document.getElementById('editAddressId').value = address._id;
                                document.getElementById('editFullName').value = address.fullName;
                                document.getElementById('editPhone').value = address.phone;
                                document.getElementById('editAddress').value = address.address;
                                document.getElementById('editCity').value = address.city;
                                document.getElementById('editState').value = address.state;
                                document.getElementById('editCountry').value = address.country;
                                document.getElementById('editPincode').value = address.pincode;
                                document.getElementById('editTypeHome').checked = address.addressType === 'Home';
                                document.getElementById('editTypeWork').checked = address.addressType === 'Work';
                                document.getElementById('editIsDefault').checked = address.isDefault;
                                displayFieldErrors({}, 'edit'); // Clear errors when opening modal
                            } else {
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Error',
                                    text: data.message || 'Failed to load address details'
                                });
                            }
                        })
                        .catch(error => {
                            console.error('Fetch address error:', error);
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Failed to load address details'
                            });
                        });
                }
            });

            // Delete Address - Show Modal
            addressesContainer.addEventListener('click', function (event) {
                const deleteBtn = event.target.closest('.delete-address');
                if (deleteBtn) {
                    console.log('Delete button clicked');
                    deleteContext = {
                        id: deleteBtn.getAttribute('data-id'),
                        card: deleteBtn.closest('[data-address-id]')
                    };

                    console.log('Delete context:', deleteContext);

                    if (!deleteContext.id || !deleteContext.card) {
                        console.error('Delete: Invalid context', deleteContext);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Invalid address selected.'
                        });
                        return;
                    }

                    const deleteModal = new bootstrap.Modal(document.getElementById('deleteAddressModal'));
                    deleteModal.show();
                }
            });

            // Confirm Delete
            document.getElementById('confirmDeleteAddress').addEventListener('click', function () {
                console.log('Confirm delete clicked, context:', deleteContext);
                
                if (!deleteContext || !deleteContext.id || !deleteContext.card) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No address selected for deletion.'
                    });
                    const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deleteAddressModal'));
                    if (deleteModal) {
                        deleteModal.hide();
                    }
                    deleteContext = null;
                    return;
                }

                const confirmBtn = document.getElementById('confirmDeleteAddress');
                showLoading(confirmBtn, 'Deleting...');

                fetch(`/address/${deleteContext.id}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Delete response:', data);
                    hideLoading(confirmBtn, 'Delete Address');

                    if (data.success) {
                        if (deleteContext.card && deleteContext.card.parentNode) {
                            deleteContext.card.remove();
                        }

                        const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deleteAddressModal'));
                        if (deleteModal) {
                            deleteModal.hide();
                        }

                        setTimeout(() => {
                            Swal.fire({
                                icon: 'success',
                                title: 'Deleted!',
                                text: 'The address has been successfully deleted.',
                                showConfirmButton: false,
                                timer: 1500
                            });
                        }, 100);
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: data.message || 'Failed to delete address'
                        });
                    }
                })
                .catch(error => {
                    hideLoading(confirmBtn, 'Delete Address');
                    console.error('Delete address error:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'An error occurred while deleting the address'
                    });
                })
                .finally(() => {
                    deleteContext = null;
                });
            });

            // Clean up modals
            ['addAddressModal', 'editAddressModal', 'deleteAddressModal'].forEach(modalId => {
                document.getElementById(modalId).addEventListener('hidden.bs.modal', () => {
                    cleanupModalBackdrop();
                    if (modalId === 'addAddressModal') {
                        displayFieldErrors({}); // Clear errors for addAddressModal
                    } else if (modalId === 'editAddressModal') {
                        displayFieldErrors({}, 'edit'); // Clear errors for editAddressModal
                    }
                });
            });

            // Reset forms when modals open
            document.getElementById('addAddressModal').addEventListener('show.bs.modal', () => {
                document.getElementById('addAddressForm').reset();
                document.getElementById('typeHome').checked = true;
                document.getElementById('country').value = 'India';
                displayFieldErrors({});
            });
        });
  window.saveNewAddress = saveNewAddress;
window.updateAddress = updateAddress;
