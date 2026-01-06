function validatePassword() {
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorMessage = document.getElementById('errorMessage');
  const passwordPattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  errorMessage.classList.add('hidden');

  if (password !== confirmPassword) {
    errorMessage.textContent = 'Passwords do not match.';
    errorMessage.classList.remove('hidden');
    return false;
  }

  if (password.length < 8) {
    errorMessage.textContent = 'Password must be at least 8 characters long.';
    errorMessage.classList.remove('hidden');
    return false;
  }

  if (!passwordPattern.test(password)) {
    errorMessage.textContent =
      'Password must include uppercase, lowercase, number, and special character.';
    errorMessage.classList.remove('hidden');
    return false;
  }

  return true;
}

function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

// attach validation
document
  .getElementById('resetPasswordForm')
  ?.addEventListener('submit', (e) => {
    if (!validatePassword()) e.preventDefault();
  });

// expose for inline HTML onclick
window.togglePassword = togglePassword;
