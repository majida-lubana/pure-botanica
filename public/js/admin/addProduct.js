/* global Cropper */

    let cropperInstances = {};
    let croppedImageBlobs = {};

    function displayErrorMessage(elementId, message) {
      const errorElement = document.getElementById(elementId);
      if (errorElement) errorElement.textContent = message;
    }

    function clearErrorMessages() {
      const errorElements = document.getElementsByClassName('error-message');
      Array.from(errorElements).forEach(element => element.textContent = '');
    }

    function initImageHandler(imageNumber) {
      const fileInput = document.getElementById(`input${imageNumber}`);
      const imagePreview = document.getElementById(`imgView${imageNumber}`);
      const croppedImage = document.getElementById(`croppedImg${imageNumber}`);
      const cropperContainer = document.querySelector(`.image-cropper-container-${imageNumber}`);
      const saveButton = document.getElementById(`saveButton${imageNumber}`);
      const cancelButton = document.getElementById(`cancelButton${imageNumber}`);

      fileInput.addEventListener('change', function(event) {
        if (event.target.files && event.target.files[0]) {
          const file = event.target.files[0];
          const reader = new FileReader();
          
          reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            cropperContainer.style.display = 'block';

            if (cropperInstances[imageNumber]) {
              cropperInstances[imageNumber].destroy();
            }

            cropperInstances[imageNumber] = new Cropper(imagePreview, {
              aspectRatio: 1,
              viewMode: 1,
              autoCropArea: 1,
              responsive: true,
              restore: false,
              guides: true,
              center: true,
              highlight: false,
              cropBoxMovable: true,
              cropBoxResizable: true,
              toggleDragModeOnDblclick: false
            });
          };
          reader.readAsDataURL(file);
        }
      });

      if (saveButton) {
        saveButton.addEventListener('click', function() {
          if (cropperInstances[imageNumber]) {
            const canvas = cropperInstances[imageNumber].getCroppedCanvas({
              width: 440,
              height: 440,
              fillColor: '#fff',
              imageSmoothingEnabled: true,
              imageSmoothingQuality: 'high'
            });
            
            if (canvas) {
              croppedImage.src = canvas.toDataURL('image/jpeg', 0.9);
              croppedImage.style.display = 'block';
              imagePreview.style.display = 'none';
              
              canvas.toBlob(function(blob) {
                const croppedFile = new File([blob], `cropped-image-${imageNumber}.jpg`, {
                  type: 'image/jpeg',
                  lastModified: new Date().getTime()
                });
                
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(croppedFile);
                fileInput.files = dataTransfer.files;
                
                croppedImageBlobs[imageNumber] = blob;
                
                cropperInstances[imageNumber].destroy();
                cropperInstances[imageNumber] = null;
                cropperContainer.style.display = 'none';
              }, 'image/jpeg', 0.9);
            }
          }
        });
      }

      if (cancelButton) {
        cancelButton.addEventListener('click', function() {
          if (cropperInstances[imageNumber]) {
            cropperInstances[imageNumber].destroy();
            cropperInstances[imageNumber] = null;
          }
          cropperContainer.style.display = 'none';
          fileInput.value = '';
        });
      }
    }

    function initAllImageHandlers() {
      for (let i = 1; i <= 4; i++) {
        initImageHandler(i);
      }
    }

    function validateForm() {
      clearErrorMessages();
      let isValid = true;

      const productName = document.querySelector('[name="productName"]').value.trim();
      if (!productName) {
        displayErrorMessage('productName-error', 'Please enter a product name');
        isValid = false;
      }

      const description = document.querySelector('[name="description"]').value.trim();
      if (!description) {
        displayErrorMessage('description-error', 'Please enter a product description');
        isValid = false;
      }

      const howToUse = document.querySelector('[name="howToUse"]').value.trim();
      if (!howToUse) {
        displayErrorMessage('howToUse-error', 'Please enter how to use instructions');
        isValid = false;
      }

      const regularPrice = document.querySelector('[name="regularPrice"]').value.trim();
      if (!regularPrice || !/^\d+(\.\d{1,2})?$/.test(regularPrice) || parseFloat(regularPrice) <= 0) {
        displayErrorMessage('regularPrice-error', 'Please enter a valid positive price (e.g., 10 or 10.99)');
        isValid = false;
      }

      const salePrice = document.querySelector('[name="salePrice"]').value.trim();
      if (salePrice) {
        if (!/^\d+(\.\d{1,2})?$/.test(salePrice) || parseFloat(salePrice) < 0) {
          displayErrorMessage('salePrice-error', 'Please enter a valid non-negative sale price (e.g., 8 or 8.99)');
          isValid = false;
        } else if (parseFloat(regularPrice) <= parseFloat(salePrice)) {
          displayErrorMessage('salePrice-error', 'Sale price must be less than regular price');
          isValid = false;
        }
      }

      const quantity = document.querySelector('[name="quantity"]').value.trim();
      if (!quantity || !/^\d+$/.test(quantity) || parseInt(quantity) < 0) {
        displayErrorMessage('quantity-error', 'Please enter a valid non-negative integer for quantity');
        isValid = false;
      }

      const skinType = document.querySelector('[name="skinType"]').value.trim();
      if (!skinType) {
        displayErrorMessage('skinType-error', 'Please select a skin type');
        isValid = false;
      }

      const skinConcern = document.querySelector('[name="skinConcern"]').value.trim();
      if (!skinConcern) {
        displayErrorMessage('skinConcern-error', 'Please select a skin concern');
        isValid = false;
      }

      let imageCount = 0;
      for (let i = 1; i <= 4; i++) {
        const input = document.getElementById(`input${i}`);
        if (input && input.files.length > 0) imageCount++;
      }
      if (imageCount < 3) {
        displayErrorMessage('images-error', 'Please upload at least 3 images');
        isValid = false;
      }

      return isValid;
    }

    function submitProductForm() {
      if (!validateForm()) {
        return;
      }

      const form = document.getElementById('productForm');
      const formData = new FormData(form);
      
      fetch('/admin/add-product', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          window.location.href = data.redirectUrl || '/admin/products';
        } else {
          displayErrorMessage('productName-error', data.error || 'Failed to add product');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        displayErrorMessage('productName-error', 'An error occurred while adding the product');
      });
    }

    document.addEventListener('DOMContentLoaded', function() {
      initAllImageHandlers();

      const submitButton = document.getElementById('submitButton');
      if (submitButton) {
        submitButton.addEventListener('click', function(e) {
          e.preventDefault();
          submitProductForm();
        });
      }
    });
 