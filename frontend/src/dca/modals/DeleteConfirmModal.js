import React from 'react';
import ModalShell from '../components/ModalShell';
import { useDcaUI } from '../DcaUIContext';

const DeleteConfirmModal = ({ label = 'this item' }) => {
  const { closeModal, showToast } = useDcaUI();

  const handleDelete = () => {
    closeModal();
    showToast('Deleted (preview only — not saved)');
  };

  return (
    <ModalShell title="Delete Confirmation" onClose={closeModal} maxWidth="max-w-md">
      <div className="flex items-start gap-3 mb-6">
        <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">{label}</span>? This cannot be undone.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleDelete}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
        >
          Delete
        </button>
        <button
          onClick={closeModal}
          className="flex-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
};

export default DeleteConfirmModal;
