import React, { useState } from 'react';
import ModalShell from '../components/ModalShell';
import { useDcaUI } from '../DcaUIContext';

const MOCK_OWNERS = [
  { id: 'o1', name: 'Dana Whitfield', role: 'Finance Director' },
  { id: 'o2', name: 'Marcus Ellery', role: 'City Auditor' },
  { id: 'o3', name: 'Ruth Callahan', role: 'County Clerk' },
  { id: 'o4', name: 'Priya Nair', role: 'Authority Secretary' }
];

const AddFormOwnersModal = ({ taskTitle = '' }) => {
  const { closeModal, showToast } = useDcaUI();
  const [selected, setSelected] = useState([]);

  const toggle = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const handleSave = (e) => {
    e.preventDefault();
    closeModal();
    showToast('Form owners saved (preview only — not saved)');
  };

  return (
    <ModalShell title={taskTitle ? `Form Owners — ${taskTitle}` : 'Add Form Owners'} onClose={closeModal} maxWidth="max-w-lg">
      <form onSubmit={handleSave} className="space-y-2">
        {MOCK_OWNERS.map((owner) => (
          <label
            key={owner.id}
            className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.includes(owner.id)}
              onChange={() => toggle(owner.id)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white">{owner.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{owner.role}</span>
          </label>
        ))}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 dark:bg-blue-700 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium transition-colors shadow-sm"
          >
            Save
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

export default AddFormOwnersModal;
