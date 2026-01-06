/* global Swal */
      function togglePassword() {
        const passwordInput = document.getElementById('password');
        const passwordIcon = document.getElementById('password-toggle-icon');
        if (passwordInput.type === 'password') {
          passwordInput.type = 'text';
          passwordIcon.classList.remove('fa-eye');
          passwordIcon.classList.add('fa-eye-slash');
        } else {
          passwordInput.type = 'password';
          passwordIcon.classList.remove('fa-eye-slash');
          passwordIcon.classList.add('fa-eye');
        }
      }

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('blocked') === 'true') {
        Swal.fire({
          icon: 'error',
          title: 'Account Blocked',
          text: 'Your account has been blocked by admin.',
          showDenyButton: true,
          confirmButtonText: 'OK',
          denyButtonText: 'Back to Home'
        }).then((result) => {
          if (result.isConfirmed) {
            window.location.href = '/login';
          } else if (result.isDenied) {
            window.location.href = '/';
          }
        });
      }

      window.togglePassword = togglePassword;
