import React from 'react';
import ModalShell from '../components/ModalShell';
import { useDcaUI } from '../DcaUIContext';

const MOCK_CONTACTS = [
  { role: 'Primary Contact', name: 'Dana Whitfield', email: 'dana.whitfield@example.gov', phone: '(770) 555-0142' },
  { role: 'Finance Director', name: 'Marcus Ellery', email: 'marcus.ellery@example.gov', phone: '(770) 555-0198' },
  { role: 'Clerk', name: 'Ruth Callahan', email: 'ruth.callahan@example.gov', phone: '(770) 555-0173' }
];

const ContactsModal = ({ entityName }) => {
  const { closeModal } = useDcaUI();

  return (
    <ModalShell title={entityName ? `${entityName} — Contacts` : 'Contacts'} onClose={closeModal} maxWidth="max-w-2xl">
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {MOCK_CONTACTS.map((c) => (
              <tr key={c.role}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{c.role}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.name}</td>
                <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400 whitespace-nowrap">{c.email}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end mt-6">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
};

export default ContactsModal;
