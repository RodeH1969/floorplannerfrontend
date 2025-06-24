// js/modals.js

function showCustomAlert(message) {
    const modal = document.getElementById('customModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalOkBtn = document.getElementById('modalOkBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    modalMessage.textContent = message;
    modalCancelBtn.style.display = 'none'; // Hide cancel button for alerts
    modal.style.display = 'flex'; // Show the modal (using flex for centering)

    return new Promise(resolve => {
        const handleClick = () => {
            modal.style.display = 'none'; // Hide modal on OK click
            modalOkBtn.removeEventListener('click', handleClick); // Clean up event listener
            document.removeEventListener('keydown', handleEscape); // Clean up key listener
            resolve(true); // Resolve promise with true
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') { // Allow Escape or Enter to close
                modal.style.display = 'none';
                modalOkBtn.removeEventListener('click', handleClick);
                document.removeEventListener('keydown', handleEscape);
                resolve(true);
            }
        };

        modalOkBtn.addEventListener('click', handleClick); // Add event listener for OK button
        document.addEventListener('keydown', handleEscape); // Add global keydown listener
        modalOkBtn.focus(); // Focus OK button for keyboard navigation
    });
}

function showCustomConfirm(message) {
    const modal = document.getElementById('customModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalOkBtn = document.getElementById('modalOkBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    modalMessage.textContent = message;
    modalCancelBtn.style.display = 'inline-block'; // Show cancel button for confirms
    modal.style.display = 'flex';

    return new Promise(resolve => {
        const handleOk = () => {
            modal.style.display = 'none';
            modalOkBtn.removeEventListener('click', handleOk);
            modalCancelBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleEscape);
            resolve(true); // Resolve with true for OK
        };
        const handleCancel = () => {
            modal.style.display = 'none';
            modalOkBtn.removeEventListener('click', handleOk);
            modalCancelBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleEscape);
            resolve(false); // Resolve with false for Cancel
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                handleCancel(); // Escape key acts as Cancel
            } else if (e.key === 'Enter') {
                handleOk(); // Enter key acts as OK
            }
        };

        modalOkBtn.addEventListener('click', handleOk);
        modalCancelBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleEscape);
        modalOkBtn.focus();
    });
}

function showSuccessModal(message, autoHide = true, duration = 2000) {
    const modal = document.getElementById('customModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalOkBtn = document.getElementById('modalOkBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    modalMessage.textContent = `✓ ${message}`; // Prepend checkmark
    modalMessage.style.color = '#4CAF50'; // Green color for success
    modalCancelBtn.style.display = 'none';
    modalOkBtn.style.display = 'none'; // Hide OK button if auto-hiding
    modal.style.display = 'flex';

    if (autoHide) {
        setTimeout(() => {
            modal.style.display = 'none';
            modalMessage.style.color = ''; // Reset color
            modalOkBtn.style.display = 'inline-block'; // Restore OK button display for future use
        }, duration);
    } else {
        modalOkBtn.style.display = 'inline-block'; // Show OK button if not auto-hiding
        modalOkBtn.onclick = () => { // Set click handler for OK button
            modal.style.display = 'none';
            modalMessage.style.color = '';
            modalOkBtn.style.display = 'inline-block';
        };
        modalOkBtn.focus();
    }
}

function showErrorModal(message, autoHide = false, duration = 3000) {
    const modal = document.getElementById('customModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalOkBtn = document.getElementById('modalOkBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    modalMessage.textContent = `✗ ${message}`; // Prepend X mark
    modalMessage.style.color = '#f44336'; // Red color for error
    modalCancelBtn.style.display = 'none';
    modalOkBtn.style.display = 'none';
    modal.style.display = 'flex';

    if (autoHide) {
        setTimeout(() => {
            modal.style.display = 'none';
            modalMessage.style.color = '';
            modalOkBtn.style.display = 'inline-block';
        }, duration);
    } else {
        modalOkBtn.style.display = 'inline-block';
        modalOkBtn.onclick = () => {
            modal.style.display = 'none';
            modalMessage.style.color = '';
            modalOkBtn.style.display = 'inline-block';
        };
        modalOkBtn.focus();
    }
}

// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    const modal = document.getElementById('customModal');
    if (e.target === modal) { // If the click target is the modal backdrop itself
        modal.style.display = 'none';
        // Reset modal state
        const modalMessage = document.getElementById('modalMessage');
        modalMessage.style.color = '';
        modalMessage.innerHTML = '';

        const modalOkBtn = document.getElementById('modalOkBtn');
        const modalCancelBtn = document.getElementById('modalCancelBtn');
        modalOkBtn.style.display = 'inline-block'; // Restore OK button
        modalCancelBtn.style.display = 'none';     // Hide cancel button
    }
});
