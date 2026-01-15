/* global Swal */

function copyCouponCode(code) {
    const showSuccess = () => {
        Swal.fire({
            icon: 'success',
            title: 'Copied!',
            text: `Coupon code "${code}" copied to clipboard`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    };

    // Preferred modern API (HTTPS only)
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code)
            .then(showSuccess)
            .catch(() => fallbackCopy(code, showSuccess));
    } else {
        fallbackCopy(code, showSuccess);
    }
}

function fallbackCopy(code, callback) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();

        document.execCommand('copy');
        document.body.removeChild(textArea);

        callback();
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Copy failed',
            text: 'Please copy the code manually',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
    }
}

window.copyCouponCode = copyCouponCode;
