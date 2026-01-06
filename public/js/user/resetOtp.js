/* global Swal */
    let timeLeft = 30;
    let countdownInterval = null;
    const timer = document.getElementById('otpTimer');
    const resendBtn = document.getElementById('resendBtn');

    function startTimer() {
      if (countdownInterval) clearInterval(countdownInterval);

      timeLeft = 30;
      timer.textContent = timeLeft;
      resendBtn.disabled = true;

      countdownInterval = setInterval(() => {
        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          countdownInterval = null;
          timer.textContent = '00';
          resendBtn.disabled = false;
        } else {
          timer.textContent = timeLeft;
          timeLeft--;
        }
      }, 1000);
    }

    // Start timer on page load
    startTimer();

    function moveToNext(current, nextFieldId) {
      if (current.value.length === 1 && nextFieldId) {
        document.getElementById(nextFieldId).focus();
      }
    }

    function handleBackspace(event, current, prevFieldId) {
      if (event.key === 'Backspace' && current.value === '' && prevFieldId) {
        event.preventDefault();
        const prevField = document.getElementById(prevFieldId);
        prevField.focus();
        prevField.value = '';
      }
    }

    function isDigit(event) {
      const charCode = event.which ? event.which : event.keyCode;
      return (charCode >= 48 && charCode <= 57) || charCode === 8 || charCode === 0;
    }

    function combineOtp() {
      const otp1 = document.getElementById('otp1').value || '';
      const otp2 = document.getElementById('otp2').value || '';
      const otp3 = document.getElementById('otp3').value || '';
      const otp4 = document.getElementById('otp4').value || '';
      return otp1 + otp2 + otp3 + otp4;
    }

    function verifyOtp(event) {
      event.preventDefault();
      const otp = combineOtp();
      const errorMessage = document.getElementById('errorMessage');

      if (otp.length !== 4) {
        errorMessage.textContent = 'Please enter all 4 digits.';
        errorMessage.classList.remove('hidden');
        return false;
      }

      fetch('/reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'OTP Verified!',
            text: 'Redirecting to reset password...',
            timer: 1500,
            showConfirmButton: false
          }).then(() => {
            window.location.href = data.redirectUrl || '/reset-password';
          });
        } else {
          errorMessage.textContent = data.message || 'Invalid OTP. Please try again.';
          errorMessage.classList.remove('hidden');
        }
      })
      .catch(() => {
        errorMessage.textContent = 'Network error. Please try again.';
        errorMessage.classList.remove('hidden');
      });

      return false;
    }

    function resendOtp() {
      resendBtn.disabled = true;
      timer.textContent = '30';
      console.log("button clicked")
      fetch('/resendForgotPassword-otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({})
      })
      .then(response => {
        if (!response.ok && response.status === 400) {
          console.log(response)
          return response.json().then(data => {
            console.log(data)
            throw new Error(data.message || 'Session expired');
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'OTP Resent!',
            text: 'A new OTP has been sent to your email.',
            showConfirmButton: false,
            timer: 1500
          });
          startTimer();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: data.message || 'Failed to resend OTP'
          });
          resendBtn.disabled = false;
        }
      })
      .catch((error) => {
        if (error.message.includes('Session expired') || error.message.includes('start over')) {
          Swal.fire({
            icon: 'warning',
            title: 'Session Expired',
            text: 'Please start the password reset process again.',
            confirmButtonText: 'Go to Forgot Password'
          }).then(() => {
            window.location.href = '/forgot-password';
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Network error. Please try again.'
          });
          resendBtn.disabled = false;
        }
      });
    }
window.moveToNext = moveToNext;
window.handleBackspace = handleBackspace;
window.isDigit = isDigit;
window.verifyOtp = verifyOtp;
window.resendOtp = resendOtp;
