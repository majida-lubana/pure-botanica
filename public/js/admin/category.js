/* global Swal */

      class ModalManager {
        constructor() {
          this.modal = document.getElementById("categoryModal");
          this.openModalBtn = document.getElementById("openModalBtn");
          this.closeModalBtn = document.getElementById("closeModalBtn");
          this.clearSearchBtn = document.getElementById("clearSearchBtn");
          this.searchInput = document.getElementById("searchInput");

          this.categoryForm = document.getElementById("categoryForm");
          this.offerForm = document.getElementById("offerForm");
          this.tabCategory = document.getElementById("tabCategory");
          this.tabOffer = document.getElementById("tabOffer");

          this.submitBtnCategory = this.categoryForm.querySelector(".submit-btn");
          this.btnTextCategory = this.submitBtnCategory.querySelector(".btn-text");
          this.btnLoaderCategory = this.submitBtnCategory.querySelector(".btn-loader");

          this.submitBtnOffer = this.offerForm.querySelector(".submit-btn");
          this.btnTextOffer = this.submitBtnOffer.querySelector(".btn-text");
          this.btnLoaderOffer = this.submitBtnOffer.querySelector(".btn-loader");

          this.init();
        }
  
        init() {
          this.openModalBtn.addEventListener("click", this.openModal.bind(this));
          this.closeModalBtn.addEventListener("click", this.closeModal.bind(this));
          this.modal.addEventListener("click", this.handleModalClick.bind(this));
          if (this.clearSearchBtn) {
            this.clearSearchBtn.addEventListener("click", this.clearSearch.bind(this));
          }

          this.tabCategory.addEventListener("click", () => this.switchTab('category'));
          this.tabOffer.addEventListener("click", () => this.switchTab('offer'));

          this.categoryForm.addEventListener("submit", this.handleCategorySubmit.bind(this));
          this.offerForm.addEventListener("submit", this.handleOfferSubmit.bind(this));
          
          // Close modal on Escape key
          document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.modal.classList.contains("show")) {
              this.closeModal();
            }
          });
        }
  
        openModal() {
          this.modal.classList.add("show");
          document.body.style.overflow = "hidden";
          this.switchTab('category'); // default
          setTimeout(() => {
            document.getElementById("categoryName").focus();
          }, 100);
        }
  
        closeModal() {
          this.modal.classList.remove("show");
          document.body.style.overflow = "";
          this.categoryForm.reset();
          this.offerForm.reset();
          this.clearErrors();
        }
  
        handleModalClick(event) {
          if (event.target === this.modal) {
            this.closeModal();
          }
        }
  
        clearSearch() {
          if (this.searchInput) {
            this.searchInput.value = "";
            window.location.href = "/admin/category";
          }
        }

        switchTab(mode) {
          if (mode === 'category') {
            this.tabCategory.classList.add("active");
            this.tabOffer.classList.remove("active");
            this.categoryForm.classList.remove("hidden");
            this.offerForm.classList.add("hidden");
          } else {
            this.tabOffer.classList.add("active");
            this.tabCategory.classList.remove("active");
            this.offerForm.classList.remove("hidden");
            this.categoryForm.classList.add("hidden");
          }
        }
  
        async handleCategorySubmit(event) {
          event.preventDefault();
  
          if (!this.validateCategory()) {
            return;
          }
  
          const formData = new FormData(this.categoryForm);
          const data = {
            categoryName: formData.get("categoryName").trim(),
            description: formData.get("description").trim(),
            _csrf: formData.get("_csrf")
          };
  
          this.setLoading(true, 'category');
  
          try {
            const response = await fetch("/admin/addCategory", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(data),
            });
  
            const result = await response.json();
  
            if (!response.ok) {
              throw new Error(result.error || "Failed to add category");
            }
  
            await Swal.fire({
              icon: "success",
              title: "Success!",
              text: result.message || "Category added successfully",
              timer: 1500,
              showConfirmButton: false,
            });
  
            this.closeModal();
            window.location.reload();
  
          } catch (error) {
            console.error("Error adding category:", error);
            Swal.fire({
              icon: "error",
              title: "Error",
              text: error.message || "An error occurred while adding the category",
            });
          } finally {
            this.setLoading(false, 'category');
          }
        }

        async handleOfferSubmit(event) {
          event.preventDefault();

          const data = {
            categoryId: document.getElementById("offerCategory").value,
            offerPercent: document.getElementById("offerPercent").value,
            startDate: document.getElementById("offerStart").value,
            endDate: document.getElementById("offerEnd").value,
          };

          this.setLoading(true, 'offer');

          try {
            const res = await fetch("/admin/addCategoryOffer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data)
            });

            const json = await res.json();

            if (!res.ok) throw new Error(json.message || "Failed");

            Swal.fire("Success", json.message, "success");
            this.closeModal();
            location.reload();
          } catch (err) {
            Swal.fire("Error", err.message, "error");
          } finally {
            this.setLoading(false, 'offer');
          }
        }
  
        validateCategory() {
          this.clearErrors();
  
          const categoryName = this.categoryForm.categoryName.value.trim();
          const description = this.categoryForm.description.value.trim();
          let isValid = true;
  
          if (!categoryName) {
            this.showError("categoryName-error", "Please enter a category name");
            isValid = false;
          } else if (!/^[a-zA-Z\s]+$/.test(categoryName)) {
            this.showError("categoryName-error", "Category name should contain only alphabetic characters");
            isValid = false;
          } else if (categoryName.length < 2) {
            this.showError("categoryName-error", "Category name must be at least 2 characters long");
            isValid = false;
          }
  
          if (description && description.length < 10) {
            this.showError("description-error", "Description must be at least 10 characters long if provided");
            isValid = false;
          }
  
          return isValid;
        }
  
        showError(elementId, message) {
          const errorElement = document.getElementById(elementId);
          if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add("show");
          }
        }
  
        clearErrors() {
          const errorElements = document.querySelectorAll(".error-message");
          errorElements.forEach((element) => {
            element.textContent = "";
            element.classList.remove("show");
          });
        }
  
        setLoading(loading, type) {
          if (type === 'category') {
            this.submitBtnCategory.disabled = loading;
            if (loading) {
              this.btnTextCategory.classList.add("hidden");
              this.btnLoaderCategory.classList.remove("hidden");
            } else {
              this.btnTextCategory.classList.remove("hidden");
              this.btnLoaderCategory.classList.add("hidden");
            }
          } else {
            this.submitBtnOffer.disabled = loading;
            if (loading) {
              this.btnTextOffer.classList.add("hidden");
              this.btnLoaderOffer.classList.remove("hidden");
            } else {
              this.btnTextOffer.classList.remove("hidden");
              this.btnLoaderOffer.classList.add("hidden");
            }
          }
        }
      }
  
      // Remove Offer Function (fixed: consistent response handling + UI update)
      async function removeOffer(categoryId) {
        const result = await Swal.fire({
          title: "Remove Offer",
          text: "Are you sure you want to remove this offer?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#ef4444",
          cancelButtonColor: "#6b7280",
          confirmButtonText: "Yes, remove it",
          cancelButtonText: "Cancel",
        });
  
        if (!result.isConfirmed) return;

        try {
          const response = await fetch("/admin/removeCategoryOffer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ categoryId }),
          });
  
          const data = await response.json();
  
          if (!response.ok) {
            throw new Error(data.message || "Failed to remove offer");
          }
  
          if (!data.success) {
            throw new Error(data.message || "Offer removal failed");
          }
  
          await Swal.fire({
            icon: "success",
            title: "Offer Removed",
            text: data.message || "The offer has been removed successfully",
            timer: 1500,
            showConfirmButton: false,
          });

          // Update UI without full reload
          const row = document.querySelector(`tr[data-category-id="${categoryId}"]`);
          if (row) {
            const offerCell = row.querySelector('td:nth-child(4)'); // Offer column
            offerCell.innerHTML = '<span class="no-offer">No offer</span>';

            const actionsCell = row.querySelector('.action-buttons');
            const removeBtn = actionsCell.querySelector('.btn-remove-offer');
            if (removeBtn) {
              removeBtn.remove();
            }
          }
  
        } catch (error) {
          console.error("Error removing offer:", error);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: error.message || "An error occurred while removing the offer",
          });
        }
      }
  
      // Toggle List/Unlist Function
      async function toggleList(categoryId, isListed) {
        console.log(`Toggling category ${categoryId}, isListed: ${isListed}`);
        const result = await Swal.fire({
          title: isListed ? "Unlist this category?" : "List this category?",
          text: "You can always change this later",
          icon: "question",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: isListed ? "Yes, Unlist it!" : "Yes, List it!"
        });
  
        if (result.isConfirmed) {
          try {
            const url = `/admin/${isListed ? 'unListCategory' : 'listCategory'}?id=${categoryId}`;
            console.log(`Fetching: ${url}`);
            const response = await fetch(url, {
              method: 'PUT',
              headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            console.log('Server response:', data);
  
            if (response.ok && data.success) {
              await Swal.fire({
                icon: "success",
                title: "Success",
                text: `Category ${data.isListed ? "listed" : "unlisted"} successfully.`,
                timer: 1500,
                showConfirmButton: false
              });
  
       
              const tableRow = document.querySelector(`tr[data-category-id="${categoryId}"]`);
              
              if (tableRow) {
       
                const statusCell = tableRow.querySelector('td:nth-child(5)'); // Status is in 5th column
                const statusBadge = statusCell.querySelector('.status-badge');
                
                if (statusBadge) {
      
                  statusBadge.classList.remove('status-active', 'status-inactive');
                  
    
                  if (data.isListed) {
                    statusBadge.classList.add('status-active');
                    statusBadge.textContent = 'Listed';
                  } else {
                    statusBadge.classList.add('status-inactive');
                    statusBadge.textContent = 'Unlisted';
                  }
                }
  
                const button = tableRow.querySelector(`button[data-category-id="${categoryId}"]`);
                if (button) {
                  console.log('Button found, updating:', button);
              
                  button.classList.remove(isListed ? 'btn-unlist' : 'btn-list');
                  button.classList.add(isListed ? 'btn-list' : 'btn-unlist');
            
                  button.textContent = isListed ? 'List' : 'Unlist';
               
                  button.title = isListed ? 'List Category' : 'Unlist Category';
                  
                  button.onclick = () => toggleList(categoryId, !isListed);
                } else {
                  console.warn(`Button with data-category-id="${categoryId}" not found`);
                }
              } else {
                console.warn(`Table row with data-category-id="${categoryId}" not found`);
              }
            } else {
              throw new Error(data.message || "Failed to update category");
            }
          } catch (error) {
            console.error("Error:", error);
            Swal.fire({
              icon: "error",
              title: "Error",
              text: error.message || "An error occurred while updating the category",
            });
          }
        }
      }
  

      async function editCategory(categoryId) {
        window.location.href = `/admin/edit-category/${categoryId}`;
      }
  

      document.addEventListener("DOMContentLoaded", () => {
        new ModalManager();
      });
window.removeOffer = removeOffer;
window.toggleList = toggleList;
window.editCategory = editCategory;
 