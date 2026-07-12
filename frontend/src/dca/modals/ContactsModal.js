import React, { useEffect, useState } from 'react';
import ModalShell from '../components/ModalShell';
import { useDcaUI } from '../DcaUIContext';
import api from '../../utils/api';
import Contacts from '../../pages/Contacts';

// DCA contacts = the exact same UI ACCG uses (the real `Contacts` component), scoped to a
// county chosen from a picker. Entity mode (from DcaEntityDetail) pre-selects that county.
const ContactsModal = ({ entityName, entityType }) => {
  const { closeModal } = useDcaUI();
  const [counties, setCounties] = useState([]);
  const [countyId, setCountyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!entityType || entityType === 'county' || !entityName) {
        try {
          const list = (await api.get('/counties')).data || [];
          if (!active) return;
          setCounties(list);
          // Entity mode: pre-select the matching county by name; else default to the first.
          const match = entityName
            ? list.find((c) => (c.name || '').trim().toLowerCase() === entityName.trim().toLowerCase())
            : null;
          setCountyId((match || list[0])?._id || '');
          if (entityName && !match) setError(`No county record found for ${entityName}.`);
          setLoading(false);
        } catch (err) {
          if (active) { setError('Could not load counties. Make sure you are signed in.'); setLoading(false); }
        }
      } else {
        // Non-county entity (city/authority) — no server-side contacts record.
        setError('Contacts are managed per county. This entity type has no linked county record yet.');
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [entityName, entityType]);

  return (
    <ModalShell title="Contacts" onClose={closeModal} maxWidth="max-w-4xl">
      {counties.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">County</label>
          <select
            value={countyId}
            onChange={(e) => setCountyId(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {counties.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{error}</div>
      ) : countyId ? (
        // Reuse the ACCG contacts UI verbatim. key forces a clean remount when switching counties.
        <Contacts key={countyId} countyId={countyId} />
      ) : (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No counties available.</div>
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
