import React, { useEffect, useState } from 'react';
import ModalShell from '../components/ModalShell';
import { useDcaUI } from '../DcaUIContext';
import api from '../../utils/api';

// Real per-county contacts, read from the same backend ACCG uses (GET /contacts/:countyId).
// Contacts are stored per county (County-only backend), so city/authority entities have no
// linked record yet — those get a graceful message rather than fake data.
const ContactsModal = ({ entityName, entityType }) => {
  const { closeModal } = useDcaUI();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState([]);
  const [countyName, setCountyName] = useState(entityName);

  useEffect(() => {
    let active = true;
    (async () => {
      if (entityType && entityType !== 'county') {
        if (active) {
          setError('Contacts are managed per county. This entity type has no linked county record yet.');
          setLoading(false);
        }
        return;
      }
      try {
        setLoading(true);
        setError('');
        // Bridge the DCA entity to its real county by name, then load that county's contacts.
        const countyRes = await api.get('/counties');
        const match = (countyRes.data || []).find(
          (c) => (c.name || '').trim().toLowerCase() === (entityName || '').trim().toLowerCase()
        );
        if (!match) {
          if (active) {
            setError(`No county record found for ${entityName}.`);
            setLoading(false);
          }
          return;
        }
        const res = await api.get(`/contacts/${match._id}`);
        const filled = (res.data?.contacts || []).filter((c) => c.name || c.email || c.phone);
        if (active) {
          setContacts(filled);
          setCountyName(match.name);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError('Could not load contacts. Make sure you are signed in.');
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [entityName, entityType]);

  return (
    <ModalShell title={entityName ? `${entityName} — Contacts` : 'Contacts'} onClose={closeModal} maxWidth="max-w-2xl">
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading contacts…</div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{error}</div>
      ) : contacts.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No contacts have been added for {countyName} yet.
        </div>
      ) : (
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
              {contacts.map((c) => (
                <tr key={c._id || c.role}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{c.role}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400 whitespace-nowrap">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
