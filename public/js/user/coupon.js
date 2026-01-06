/* global Swal */
        function copyCouponCode(code) {
            navigator.clipboard.writeText(code).then(() => {
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
            }).catch(() => {
                // Fallback
                const textArea = document.createElement('textarea');
                textArea.value = code;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
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
            });
        }
window.copyCouponCode = copyCouponCode;