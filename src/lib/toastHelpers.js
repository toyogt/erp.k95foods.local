import Swal from 'sweetalert2';
import { toast } from 'react-toastify';

/**
 * Show error/warning alerts using SweetAlert2 (modal)
 */
export function showErrorAlert(title, message) {
  Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonColor: '#dc2626',
    confirmButtonText: 'OK',
  });
}

export function showWarningAlert(title, message) {
  Swal.fire({
    icon: 'warning',
    title,
    text: message,
    confirmButtonColor: '#d97706',
    confirmButtonText: 'OK',
  });
}

export function showValidationErrors(title, errors) {
  Swal.fire({
    icon: 'error',
    title,
    html: `<ul style="text-align:left;margin:0;padding-left:1.2em;">${errors.map(e => `<li style="margin-bottom:4px;">${e}</li>`).join('')}</ul>`,
    confirmButtonColor: '#dc2626',
    confirmButtonText: 'OK',
  });
}

export function showConfirmAlert(title, message, onConfirm) {
  Swal.fire({
    icon: 'warning',
    title,
    text: message,
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
  }).then((result) => {
    if (result.isConfirmed) onConfirm();
  });
}

/**
 * Show success alerts using react-toastify
 */
export function showSuccessToast(message) {
  toast.success(message, {
    position: 'top-right',
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
  });
}

export function showInfoToast(message) {
  toast.info(message, {
    position: 'top-right',
    autoClose: 3000,
  });
}