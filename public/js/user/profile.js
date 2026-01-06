
        function closeModal() {
        document.getElementById('doneBtn').style.display = 'none';
    }
document.addEventListener('DOMContentLoaded', function () {
    // Tab Switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab, .content-section').forEach(el => {
                el.classList.remove('active');
            });
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Password Visibility Toggle
    function togglePasswordVisibility(icon, inputId) {
        const passwordInput = document.getElementById(inputId);
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    document.querySelectorAll('.password-visibility').forEach(icon => {
        icon.addEventListener('click', () => {
            const inputId = icon.previousElementSibling.id;
            togglePasswordVisibility(icon, inputId);
        });
    });

    // Edit Profile Modal Handling
    const openEditProfileBtn = document.getElementById('open-edit-profile-modal');
    const editProfileModal = document.getElementById('edit-profile-modal');

    if (openEditProfileBtn && editProfileModal) {
        const closeModalBtn = editProfileModal.querySelector('.close-btn');
        const cancelEditBtn = document.getElementById('cancel-edit-profile');
        const editProfileForm = document.getElementById('edit-profile-modal-form');

        function openEditProfileModal() {
            const fullNameDisplay = document.getElementById('display-fullName');
            const phoneDisplay = document.getElementById('display-phone');

            if (fullNameDisplay && phoneDisplay) {
                document.getElementById('modal-fullName').value = fullNameDisplay.textContent.trim();
                document.getElementById('modal-phone').value = phoneDisplay.textContent.trim();
            }

            const errorMessages = editProfileModal.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.textContent = '';
                msg.style.display = 'none';
            });

            editProfileModal.style.display = 'block';
        }

        function closeEditProfileModal() {
            editProfileModal.style.display = 'none';
        }

        openEditProfileBtn.addEventListener('click', openEditProfileModal);

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeEditProfileModal);
        }

        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', closeEditProfileModal);
        }

        window.addEventListener('click', function (event) {
            if (event.target === editProfileModal) {
                closeEditProfileModal();
            }
        });

        if (editProfileForm) {
            editProfileForm.addEventListener('submit', async function (e) {
                e.preventDefault();

                const errorMessages = editProfileForm.querySelectorAll('.error-message');
                errorMessages.forEach(msg => {
                    msg.textContent = '';
                    msg.style.display = 'none';
                });

                const name = document.getElementById('modal-fullName').value.trim();
                const phone = document.getElementById('modal-phone').value.trim();

                let isValid = true;
                if (!name) {
                    const nameError = document.getElementById('modal-name-error');
                    nameError.textContent = 'Name is required';
                    nameError.style.display = 'block';
                    isValid = false;
                }

                const phoneRegex = /^\+?[\d\s-]{8,15}$/;
                if (phone && !phoneRegex.test(phone)) {
                    const phoneError = document.getElementById('modal-phone-error');
                    phoneError.textContent = 'Invalid phone number format';
                    phoneError.style.display = 'block';
                    isValid = false;
                }

                if (!isValid) return;

                try {
                    const response = await fetch('/update-profile', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            name: name,
                            phone: phone
                        })
                    });

                    const data = await response.json();

                    if (data.success) {
                        document.getElementById('display-fullName').textContent = data.user.name;
                        document.getElementById('display-phone').textContent = data.user.phone;
                        closeEditProfileModal();
                    } else {
                        if (data.message.includes('name')) {
                            const nameError = document.getElementById('modal-name-error');
                            nameError.textContent = data.message;
                            nameError.style.display = 'block';
                        } else if (data.message.includes('phone')) {
                            const phoneError = document.getElementById('modal-phone-error');
                            phoneError.textContent = data.message;
                            phoneError.style.display = 'block';
                        } else {
                            const nameError = document.getElementById('modal-name-error');
                            nameError.textContent = data.message;
                            nameError.style.display = 'block';
                        }
                    }
                } catch (error) {
                    console.error('Error updating profile:', error);
                    const nameError = document.getElementById('modal-name-error');
                    nameError.textContent = 'An error occurred. Please try again.';
                    nameError.style.display = 'block';
                }
            });
        }
    }

    // Change Password Form Handling
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const errorMessages = document.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.textContent = '';
                msg.style.display = 'none';
            });
            document.getElementById('password-change-success').style.display = 'none';

            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            let isValid = true;

            if (!currentPassword) {
                const currentPasswordError = document.getElementById('current-password-error');
                currentPasswordError.textContent = 'Current password is required';
                currentPasswordError.style.display = 'block';
                isValid = false;
            }

            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!newPassword) {
                const newPasswordError = document.getElementById('new-password-error');
                newPasswordError.textContent = 'New password is required';
                newPasswordError.style.display = 'block';
                isValid = false;
            } else if (!passwordRegex.test(newPassword)) {
                const newPasswordError = document.getElementById('new-password-error');
                newPasswordError.textContent = 'Password does not meet requirements';
                newPasswordError.style.display = 'block';
                isValid = false;
            }

            if (!confirmPassword) {
                const confirmPasswordError = document.getElementById('confirm-password-error');
                confirmPasswordError.textContent = 'Please confirm your new password';
                confirmPasswordError.style.display = 'block';
                isValid = false;
            } else if (newPassword !== confirmPassword) {
                const confirmPasswordError = document.getElementById('confirm-password-error');
                confirmPasswordError.textContent = 'Passwords do not match';
                confirmPasswordError.style.display = 'block';
                isValid = false;
            }

            if (isValid) {
                fetch('/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        currentPassword: currentPassword,
                        newPassword: newPassword,
                        confirmPassword: confirmPassword
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(errorData => {
                            throw new Error(errorData.message || 'Password change failed');
                        });
                    }
                    return response.json();
                })
                .then(() => {
    document.getElementById('password-change-success').style.display = 'block';
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
})

                .catch(error => {
                    const errorMessage = error.message || 'Password change failed';
                    if (errorMessage.toLowerCase().includes('current password')) {
                        const currentPasswordError = document.getElementById('current-password-error');
                        currentPasswordError.textContent = errorMessage;
                        currentPasswordError.style.display = 'block';
                    } else if (errorMessage.toLowerCase().includes('passwords do not match')) {
                        const confirmPasswordError = document.getElementById('confirm-password-error');
                        confirmPasswordError.textContent = errorMessage;
                        confirmPasswordError.style.display = 'block';
                    } else {
                        const currentPasswordError = document.getElementById('current-password-error');
                        currentPasswordError.textContent = errorMessage;
                        currentPasswordError.style.display = 'block';
                    }
                });
            }
        });
    }

    // Email Change Modal Handling
    const emailChangeModal = document.getElementById('email-change-modal');
    const sendOtpBtn = document.getElementById('send-otp-btn');
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    const resendOtpBtn = document.getElementById('resend-otp-btn');
    const closeModalBtns = document.querySelectorAll('.close-btn');
    const emailInputSection = document.getElementById('email-input-section');
    const otpSection = document.getElementById('otp-section');
    const successSection = document.getElementById('success-section');

    const displayEmailElement = document.getElementById('display-email');
    const emailChangeButton = document.createElement('button');
    emailChangeButton.textContent = 'Change Email';
    emailChangeButton.classList.add('btn', 'btn-secondary');
    emailChangeButton.style.marginLeft = '10px';
    displayEmailElement.parentNode.appendChild(emailChangeButton);

    emailChangeButton.addEventListener('click', function () {
        emailChangeModal.style.display = 'block';
        emailInputSection.style.display = 'block';
        otpSection.style.display = 'none';
        successSection.style.display = 'none';
        document.getElementById('new-email').value = '';
        document.getElementById('new-email-error').textContent = '';
        document.getElementById('new-email-error').style.display = 'none';
        document.getElementById('otp-input').value = '';
        document.getElementById('otp-error').textContent = '';
        document.getElementById('otp-error').style.display = 'none';
    });

    function closeModal() {
        emailChangeModal.style.display = 'none';
    }

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    window.addEventListener('click', function (event) {
        if (event.target === emailChangeModal) {
            closeModal();
        }
    });

    
if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', async function () {
        const newEmail = document.getElementById('new-email').value.trim();
        const emailError = document.getElementById('new-email-error');
        emailError.textContent = '';
        emailError.style.display = 'none';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!newEmail) {
            emailError.textContent = 'Email is required';
            emailError.style.display = 'block';
            return;
        }
        if (!emailRegex.test(newEmail)) {
            emailError.textContent = 'Invalid email format';
            emailError.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/send-emailOtp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: newEmail })
            });

            const data = await response.json();
            console.log('Send OTP response:', { status: response.status, data }); // Debug log

            if (data.success) {
                emailInputSection.style.display = 'none';
                otpSection.style.display = 'block';
                document.getElementById('otp-input').value = '';
                document.getElementById('otp-error').textContent = '';
                document.getElementById('otp-error').style.display = 'none';
            } else {
                emailError.textContent = data.message;
                emailError.style.display = 'block';
            }
        } catch (error) {
            console.error('Error sending OTP:', error.message, error.stack); // Detailed error log
            emailError.textContent = 'An error occurred. Please try again.';
            emailError.style.display = 'block';
        }
    });
}

    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', async function () {
            const newEmail = document.getElementById('new-email').value.trim();
            const otpInput = document.getElementById('otp-input').value.trim();
            const otpError = document.getElementById('otp-error');

            otpError.textContent = '';
            otpError.style.display = 'none';

            if (!otpInput) {
                otpError.textContent = 'OTP is required';
                otpError.style.display = 'block';
                return;
            }

            try {
                const response = await fetch('/verify-email-otp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        email: newEmail, 
                        otp: otpInput 
                    })
                });

                const data = await response.json();

                if (data.success) {
                    emailInputSection.style.display = 'none';
                    otpSection.style.display = 'none';
                    successSection.style.display = 'block';
                    document.getElementById('display-email').textContent = newEmail;
                } else {
                    otpError.textContent = data.message;
                    otpError.style.display = 'block';
                }
            } catch (error) {
                console.error('Error verifying OTP:', error);
                otpError.textContent = 'An error occurred. Please try again.';
                otpError.style.display = 'block';
            }
        });
    }

    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', async function () {
            const newEmail = document.getElementById('new-email').value.trim();
            const otpError = document.getElementById('otp-error');
            otpError.textContent = '';
            otpError.style.display = 'none';

            if (!newEmail) {
                otpError.textContent = 'Email is required to resend OTP';
                otpError.style.display = 'block';
                return;
            }

            try {
                const response = await fetch('/resend-emailOtp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: newEmail }),
                });
                const data = await response.json();
                if (data.success) {
                    alert('New OTP sent successfully');
                    document.getElementById('otp-input').value = '';
                    document.getElementById('otp-error').textContent = '';
                    document.getElementById('otp-error').style.display = 'none';
                } else {
                    otpError.textContent = data.message;
                    otpError.style.display = 'block';
                }
            } catch (error) {
                console.error('Error resending OTP:', error);
                otpError.textContent = 'An error occurred. Please try again.';
                otpError.style.display = 'block';
            }
        });
    }
});

window.closeModal = closeModal;
