import React, { useState } from 'react';
import ModalShell from '../components/ModalShell';
import { useDcaUI } from '../DcaUIContext';

const ReturnForCorrectionModal = ({ submissionLabel = '' }) => {
  const { closeModal, showToast } = useDcaUI();
  const [comment, setComment] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    closeModal();
    showToast('Returned for correction (preview only — not saved)');
  };

  return (
    <ModalShell title="Return for Correction" onClose={closeModal} maxWidth="max-w-lg">
      {submissionLabel && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{submissionLabel}</p>
      )}
      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            What needs to be corrected? *
          </label>
          <textarea
            required
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows="5"
            placeholder="Explain what the submitter needs to fix before resubmitting…"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all resize-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            Send
          </button>
          <button
            type="button"
            onClick={closeModal}
            className="flex-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

export default ReturnForCorrectionModal;
