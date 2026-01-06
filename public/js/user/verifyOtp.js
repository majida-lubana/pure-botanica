/* global Swal */

  let timeLeft = 30;
  const defaultResendTime = 30;
  let countdownInterval = null;

  const timerEl = document.getElementById('timer');
  const resendBtn = document.getElementById('resendBtn');
  const otpForm = document.getElementById('otpForm');

  function startCountdown() {
    // Clear any existing interval
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        timerEl.textContent = '';
        resendBtn.disabled = false;
      } else {
        const seconds = timeLeft % 60;
        timerEl.textContent = `00:${seconds < 10 ? '0' : ''}${seconds}`;
        timeLeft--;
      }
    }, 1000);
  }

  // SINGLE RESEND OTP HANDLER - Manual button click only
  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    
    try {
      const response = await fetch('/resendSignUp-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Swal.fire({
          icon: "success",
          title: "OTP Resent",
          text: "A new code has been sent to your email",
          showConfirmButton: false,
          timer: 2000,
        });
        
        // Reset timer
        timeLeft = defaultResendTime;
        timerEl.textContent = '00:30';
        startCountdown();
        
        // Clear OTP inputs
        document.querySelectorAll('.otp-input').forEach(input => input.value = '');
        document.getElementById('otp1').focus();
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: data.message || "Failed to resend OTP",
        });
        resendBtn.disabled = false;
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      Swal.fire({
        icon: "error",
        title: "Network Error",
        text: "Unable to resend OTP. Please check your connection.",
      });
      resendBtn.disabled = false;
    }
  });

  // OTP input navigation
  document.addEventListener('DOMContentLoaded', function () {
    const otpInputs = document.querySelectorAll('.otp-input');

    otpInputs.forEach((input, index) => {
      // Only allow numbers
      input.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
        
        if (this.value.length === 1 && index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && this.value === '' && index > 0) {
          otpInputs[index - 1].focus();
        }
      });

      // Handle paste
      input.addEventListener('paste', function (e) {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
        
        if (pastedData.length === 4) {
          otpInputs.forEach((inp, idx) => {
            inp.value = pastedData[idx] || '';
          });
          otpInputs[3].focus();
        }
      });
    });

    startCountdown();
  });

  // VERIFY OTP HANDLER - No auto-resend on error
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const otp1 = document.getElementById("otp1").value;
    const otp2 = document.getElementById("otp2").value;
    const otp3 = document.getElementById("otp3").value;
    const otp4 = document.getElementById("otp4").value;
    const otpValue = otp1 + otp2 + otp3 + otp4;

    if (otpValue.length !== 4) {
      Swal.fire({
        icon: "error",
        title: "Invalid Input",
        text: "Please enter all 4 digits"
      });
      return;
    }

    try {
      const response = await fetch('/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ otp: otpValue })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Swal.fire({
          icon: "success",
          title: "Verified!",
          text: "OTP verified successfully",
          showConfirmButton: false,
          timer: 1500,
        }).then(() => {
          window.location.href = data.redirectUrl || '/';
        });
      } else {
        // Just show error - let user manually resend if needed
        Swal.fire({
          icon: "error",
          title: "Invalid OTP",
          text: data.message || "The code you entered is incorrect. Please try again or click 'Resend OTP'",
          confirmButtonText: "Try Again"
        });
        
        // Clear inputs for retry
        document.querySelectorAll('.otp-input').forEach(input => input.value = '');
        document.getElementById('otp1').focus();
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      Swal.fire({
        icon: "error",
        title: "Network Error",
        text: "Unable to verify OTP. Please check your connection and try again.",
      });
    }
  });
