import React, { useState } from 'react';
import ModalShell from '../components/ModalShell';
import { useDcaUI } from '../DcaUIContext';
import { ENTITY_TYPES, ENTITY_TYPE_LABELS } from '../mockData';

const TYPE_OPTIONS = [ENTITY_TYPES.COUNTY, ENTITY_TYPES.CITY, ENTITY_TYPES.AUTHORITY];

const AddFilingModal = () => {
  const { closeModal, showToast } = useDcaUI();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [appliesTo, setAppliesTo] = useState([]);

  const toggleType = (type) =>
    setAppliesTo((cur) => (cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type]));

  const handleSubmit = (e) => {
    e.preventDefault();
    closeModal();
    showToast('Filing added (preview only — not saved)');
  };

  return (
    <ModalShell title="Add Filing" onClose={closeModal} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Filing Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Annual Debt Service Report"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Agency</label>
          <input
            type="text"
            value="Dept. of Community Affairs (DCA)"
            disabled
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Applies to entity type(s) *</label>
          <div className="flex flex-wrap gap-3">
            {TYPE_OPTIONS.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={appliesTo.includes(type)}
                  onChange={() => toggleType(type)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{ENTITY_TYPE_LABELS[type]}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="3"
            placeholder="Brief description of what this filing covers"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all resize-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 bg-blue-600 dark:bg-blue-700 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium transition-colors shadow-sm"
          >
            Add Filing
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

export default AddFilingModal;
