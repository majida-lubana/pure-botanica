/* global Swal */
    async function addOffer(productId) {
      const { value: offerPercentage } = await Swal.fire({
        title: 'Add Offer',
        text: 'Enter offer percentage (0-99)',
        input: 'number',
        inputPlaceholder: 'Enter percentage (e.g., 10)',
        inputAttributes: {
          min: 0,
          max: 99,
          step: 1
        },
        showCancelButton: true,
        confirmButtonColor: '#14b8a6',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Add Offer',
        cancelButtonText: 'Cancel',
        inputValidator: (value) => {
          const num = parseInt(value, 10);
          if (!value) {
            return 'You need to enter a percentage!';
          }
          if (isNaN(num) || num < 0 || num > 99) {
            return 'Please enter a valid percentage between 0 and 99!';
          }
        }
      });

      if (offerPercentage !== undefined) {
        try {
          const response = await fetch(`/admin/add-product-offer/${productId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ offerPercentage: parseInt(offerPercentage, 10) }),
          });

          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }

          const data = await response.json();

          if (data.success) {
            await Swal.fire({
              icon: 'success',
              title: 'Success!',
              text: `Offer of ${data.offerPercentage}% added successfully! ${data.cartsUpdated > 0 ? data.cartsUpdated + ' cart(s) updated.' : ''}`,
              timer: 2000,
              showConfirmButton: false,
              confirmButtonColor: '#14b8a6',
            });

            // Update UI
            updateOfferUI(productId, data.offerPercentage);
          } else {
            throw new Error(data.message || 'Failed to add offer');
          }
        } catch (error) {
          console.error('Error:', error);
          await Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: error.message || 'An error occurred while adding the offer',
            confirmButtonColor: '#14b8a6',
          });
        }
      }
    }

    // Remove Offer Function
    async function removeOffer(productId) {
      const result = await Swal.fire({
        title: 'Remove offer?',
        text: 'This will set the offer to 0%',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#14b8a6',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Yes, remove it!',
        cancelButtonText: 'Cancel',
      });

      if (result.isConfirmed) {
        try {
          const response = await fetch(`/admin/remove-product-offer/${productId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }

          const data = await response.json();

          if (data.success) {
            await Swal.fire({
              icon: 'success',
              title: 'Success!',
              text: `Offer removed successfully! ${data.cartsUpdated > 0 ? data.cartsUpdated + ' cart(s) updated.' : ''}`,
              timer: 2000,
              showConfirmButton: false,
              confirmButtonColor: '#14b8a6',
            });

            // Update UI
            updateOfferUI(productId, 0);
          } else {
            throw new Error(data.message || 'Failed to remove offer');
          }
        } catch (error) {
          console.error('Error:', error);
          await Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: error.message || 'An error occurred while removing the offer',
            confirmButtonColor: '#14b8a6',
          });
        }
      }
    }

    // Update Offer UI
    function updateOfferUI(productId, offerPercentage) {
      const button = document.querySelector(`.action-buttons button[data-product-id="${productId}"]`);
      const offerBadge = document.querySelector(`.offer-badge[data-product-id="${productId}"]`);

      if (button && offerBadge) {
        // Update offer badge
        offerBadge.textContent = offerPercentage > 0 ? `${offerPercentage}%` : 'No Offer';

        // Update button
       
        if (offerPercentage > 0) {
          // Change to "Remove Offer" button
          button.className = 'btn-danger';
          button.innerHTML = '<i class="fas fa-times mr-1"></i>Remove Offer';
          button.title = 'Remove Offer';
          button.onclick = () => removeOffer(productId);
        } else {
          // Change to "Add Offer" button
          button.className = 'btn-warning';
          button.innerHTML = '<i class="fas fa-tag mr-1"></i>Add Offer';
          button.title = 'Add Offer';
          button.onclick = () => addOffer(productId);
        }
      }
    }

    // Toggle List/Unlist Product
    async function toggleListProduct(productId, isListed) {
      const result = await Swal.fire({
        title: isListed ? 'Unlist this product?' : 'List this product?',
        text: 'You can always change this later',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#14b8a6',
        cancelButtonColor: '#ef4444',
        confirmButtonText: isListed ? 'Yes, Unlist it!' : 'Yes, List it!',
        cancelButtonText: 'Cancel',
      });

      if (result.isConfirmed) {
        try {
          const url = `/admin/${isListed ? 'blockProduct' : 'unblockProduct'}/${productId}`;
          const response = await fetch(url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isListed: !isListed }),
          });

          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }

          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Server did not return JSON, status: ${response.status}`);
          }

          const data = await response.json();

          if (data.success) {
            await Swal.fire({
              icon: 'success',
              title: 'Success!',
              text: `Product ${data.isListed ? 'listed' : 'unlisted'} successfully.`,
              timer: 1500,
              showConfirmButton: false,
              confirmButtonColor: '#14b8a6',
            });

            // Update UI
            const buttons = document.querySelectorAll(`button[data-product-id="${productId}"]`);
            const listButton = Array.from(buttons).find(btn => 
              btn.textContent.includes('Unlist') || btn.textContent.includes('List')
            );
            const tableRow = listButton ? listButton.closest('tr') : null;

            if (tableRow && listButton) {
              // Update status badge
              const statusBadge = tableRow.querySelector('.status-badge');
              if (statusBadge) {
                statusBadge.classList.remove('status-listed', 'status-unlisted');
                statusBadge.classList.add(data.isListed ? 'status-listed' : 'status-unlisted');
                statusBadge.textContent = data.isListed ? 'Listed' : 'Unlisted';
              }

              // Update button
              listButton.classList.remove('btn-success', 'btn-danger');
              listButton.classList.add(data.isListed ? 'btn-danger' : 'btn-success');
              listButton.innerHTML = `<i class="fas fa-${data.isListed ? 'times' : 'check'} mr-1"></i>${data.isListed ? 'Unlist' : 'List'}`;
              listButton.title = data.isListed ? 'Unlist Product' : 'List Product';
              listButton.onclick = () => toggleListProduct(productId, data.isListed);
            } else {
              location.reload();
            }
          } else {
            throw new Error(data.message || 'Failed to update product');
          }
        } catch (error) {
          console.error('Error:', error);
          await Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: error.message || 'An error occurred while updating the product',
            confirmButtonColor: '#14b8a6',
          });
        }
      }
    }

    // Clear Search Function
    function clearSearch() {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.value = '';
        window.location.href = '/admin/product';
      }
    }

    // Initialize Clear Search Button
    document.addEventListener('DOMContentLoaded', () => {
      const clearSearchBtn = document.getElementById('clearSearchBtn');
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
      }
    });

    window.toggleListProduct = toggleListProduct;

 