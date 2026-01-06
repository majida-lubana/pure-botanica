/* global $, Cropper, Swal */


$(document).ready(function () {
  // Get existing images from the page data attribute
  const existingImages = JSON.parse($('#productData').attr('data-images') || '[]');
  // --------------------------------------------------------------
  // 1. Cropper Initialization
  // --------------------------------------------------------------
  const croppers = {};

  function initializeCropper(
    inputId, previewId, cropperContainerClass,
    saveBtnId, cancelBtnId, croppedImgId,
    existingImage = null
  ) {
    const $input = $(`#${inputId}`);
    const $preview = $(`#${previewId}`);
    const $cropper = $(`.${cropperContainerClass}`);
    const $save = $(`#${saveBtnId}`);
    const $cancel = $(`#${cancelBtnId}`);
    const $cropped = $(`#${croppedImgId}`);

    // Show existing image if available
    if (existingImage) {
      $cropped.attr('src', existingImage).show();
    }

    // Handle file input change
    $input.on('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (ev) {
        $cropped.hide();
        $preview.attr('src', ev.target.result).show();
        $cropper.show();

        // Destroy existing cropper instance
        if (croppers[inputId]) {
          croppers[inputId].destroy();
        }

        // Initialize new cropper
        croppers[inputId] = new Cropper($preview[0], {
          aspectRatio: 1,
          viewMode: 1,
          autoCropArea: 0.8,
          responsive: true
        });
      };
      reader.readAsDataURL(file);
    });

    // Save cropped image
    $save.on('click', function () {
      const cropper = croppers[inputId];
      if (!cropper) return;

      const canvas = cropper.getCroppedCanvas({
        width: 600,
        height: 600,
        imageSmoothingQuality: 'high'
      });

      const dataUrl = canvas.toDataURL('image/jpeg');
      $preview.hide();
      $cropped.attr('src', dataUrl).show();
      $cropper.hide();
      cropper.destroy();
      delete croppers[inputId];

      // Store base64 in hidden field
      const imageNumber = inputId.slice(-1);
      let $hidden = $(`input[name="croppedImage${imageNumber}"]`);
      if ($hidden.length === 0) {
        $hidden = $('<input>', {
          type: 'hidden',
          name: `croppedImage${imageNumber}`
        }).appendTo($input.closest('form'));
      }
      $hidden.val(dataUrl);
    });

    // Cancel cropping
    $cancel.on('click', function () {
      if (croppers[inputId]) {
        croppers[inputId].destroy();
        delete croppers[inputId];
      }
      $preview.attr('src', '').hide();
      $cropper.hide();
      $input.val('');
      $cropped.attr('src', existingImage || '').toggle(!!existingImage);
    });
  }

  // Initialize croppers for all 4 image slots
  ['1', '2', '3', '4'].forEach(n => {
    const idx = parseInt(n) - 1;
    const existingImg = existingImages[idx] || null;

    
    initializeCropper(
      `input${n}`,
      `imgView${n}`,
      `image-cropper-container-${n}`,
      `saveButton${n}`,
      `cancelButton${n}`,
      `croppedImg${n}`,
      existingImg
    );
  });

  // --------------------------------------------------------------
  // 2. Helper Functions
  // --------------------------------------------------------------
  function hasImage(idx) {
    const cropped = $(`#croppedImg${idx + 1}`).attr('src');
    return (cropped && cropped.startsWith('data:')) || !!existingImages[idx];
  }

  function clearFieldError($field) {
    $field.next('.field-error').text('');
  }

  function showFieldError($field, message) {
    $field.next('.field-error').text(message);
  }

  // --------------------------------------------------------------
  // 3. Setup Inline Error Containers
  // --------------------------------------------------------------
  $('input[required], textarea[required], select[required]').each(function () {
    if (!$(this).next('.field-error').length) {
      $('<div class="field-error text-red-600 text-xs mt-1"></div>').insertAfter(this);
    }
  });

  if (!$('#images-error').length) {
    $('<div id="images-error" class="error-message text-red-600 text-sm mt-2"></div>')
      .insertBefore('.image-section .grid');
  }

  // --------------------------------------------------------------
  // 4. Form Validation and Submit
  // --------------------------------------------------------------
  $('form').on('submit', function (e) {
    e.preventDefault();

    const $form = $(this);
    let valid = true;
    const $errorDiv = $('#images-error');
    $errorDiv.text('');

    // Clear all previous errors
    $('.field-error').text('');

    // Validate required text fields
    $form.find('input[required], textarea[required], select[required]').each(function () {
      const $el = $(this);
      const val = $el.val().trim();

      if (!val) {
        showFieldError($el, 'This field is required.');
        valid = false;
        return;
      }

      // Validate number fields
      if ($el.attr('type') === 'number') {
        const num = Number(val);
        if (isNaN(num) || num < 0) {
          showFieldError($el, 'Please enter a valid number (0 or greater).');
          valid = false;
        }
      }
    });

    if (!valid) return;

    // Validate stock field specifically
    const stock = Number($('#stock').val());
    if (isNaN(stock) || stock < 0) {
      showFieldError($('#stock'), 'Stock must be 0 or higher.');
      return;
    }

    // Validate images (first 3 are required)
    const requiredImgCount = 3;
    for (let i = 0; i < requiredImgCount; i++) {
      if (!hasImage(i)) {
        $errorDiv.text('Please provide the first three product images.');
        valid = false;
        break;
      }
    }
    
    if (!valid) return;

    // Build FormData
    const fd = new FormData();
    const productId = $('#productData').attr('data-product-id');

    // Add regular form fields
    $form.serializeArray().forEach(item => {
      fd.append(item.name, item.value);
    });

    // Add images
    for (let i = 0; i < 4; i++) {
      const $hidden = $(`input[name="croppedImage${i + 1}"]`);
      
      if ($hidden.length && $hidden.val().startsWith('data:')) {
        // Convert base64 to Blob
        const base64Data = $hidden.val();
        const byteString = atob(base64Data.split(',')[1]);
        const mimeType = base64Data.split(',')[0].match(/:(.*?);/)[1];
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let j = 0; j < byteString.length; j++) {
          uint8Array[j] = byteString.charCodeAt(j);
        }
        
        const blob = new Blob([arrayBuffer], { type: mimeType });
        fd.append('images', blob, `product_image_${i + 1}.jpg`);
      } else if (existingImages[i]) {
        // Keep existing image
        fd.append('existingImages', existingImages[i]);
      }
    }

    // Submit form via AJAX
    $.ajax({
      url: `/admin/update-product/${productId}`,
      method: 'POST',
      data: fd,
      processData: false,
      contentType: false,
      success: function (res) {
        if (res.success) {
          Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: 'Product updated successfully.',
            timer: 1500,
            showConfirmButton: false
          }).then(() => {
            window.location.href = '/admin/product-list';
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: res.message || 'Failed to update product.',
            confirmButtonColor: '#14b8a6'
          });
        }
      },
      error: function (xhr) {
        const message = xhr.responseJSON?.message || 'Server error occurred.';
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: message,
          confirmButtonColor: '#14b8a6'
        });
      }
    });
  });
});

window.clearFieldError = clearFieldError;
