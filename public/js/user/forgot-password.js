
      function validateLoginForm() {
        const emailInput = document.getElementById('email');
        const emailError = document.getElementById('email-error');
        const emailValue = emailInput.value.trim();
        const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        emailInput.classList.remove('border-red-500');
        emailError.textContent = '';

        if (emailValue === '') {
          emailError.textContent = 'Please enter your email.';
          emailInput.classList.add('border-red-500');
          emailInput.setAttribute('aria-invalid', 'true');
          return false;
        } else if (!emailPattern.test(emailValue)) {
          emailError.textContent = 'Please enter a valid email address.';
          emailInput.classList.add('border-red-500');
          emailInput.setAttribute('aria-invalid', 'true');
          return false;
        }
        return true;
      }
window.validateLoginForm = validateLoginForm;
