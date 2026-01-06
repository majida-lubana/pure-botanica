/* global Swal */

    async function updateItemStatus(orderId, itemId, newStatus) {
      try {
        const confirmResult = await Swal.fire({
          title: 'Update Status?',
          text: `Change status to "${newStatus}"?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#108a7e',
          cancelButtonColor: '#6b7280',
          confirmButtonText: 'Yes, update it!',
          cancelButtonText: 'Cancel'
        });
        if (!confirmResult.isConfirmed) return;

        const response = await fetch(`/admin/order/update-status/${orderId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, status: newStatus })
        });

        let data = {};
        try { data = await response.json(); } catch { console.warn('No JSON body in response');}
        if (!response.ok) throw new Error(data.message || 'Failed to update status');

        await Swal.fire({
          icon: 'success',
          title: 'Updated!',
          text: data.message || 'Status updated successfully',
          confirmButtonColor: '#108a7e',
          timer: 2000
        });
        location.reload();
      } catch (error) {
        console.error('Error:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to update status',
          confirmButtonColor: '#ef4444'
        });
      }
    }

    async function verifyReturnRequest(orderId, itemId, action) {
      try {
        const confirmResult = await Swal.fire({
          title: 'Verify Return Request?',
          text: `Mark return as "${action}"?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#108a7e',
          cancelButtonColor: '#6b7280',
          confirmButtonText: `Yes, ${action}!`,
          cancelButtonText: 'Cancel'
        });
        if (!confirmResult.isConfirmed) return;

        const response = await fetch(`/admin/order/verify-return/${orderId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, action })
        });

        let data = {};
        try { data = await response.json(); } catch {console.warn('No JSON body in response');}
        if (!response.ok) throw new Error(data.message || 'Failed to verify return');

        await Swal.fire({
          icon: 'success',
          title: 'Return Processed!',
          text: data.message || `Return request ${action} successfully`,
          confirmButtonColor: '#108a7e',
          timer: 2000
        });
        location.reload();
      } catch (error) {
        console.error('Error:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to process return',
          confirmButtonColor: '#ef4444'
        });
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      const cards = document.querySelectorAll('.animate-in');
      cards.forEach((card, i) => card.style.animationDelay = `${i * 0.1}s`);
    });
window.verifyReturnRequest = verifyReturnRequest;
window.updateItemStatus = updateItemStatus;
