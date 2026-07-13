import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysUntil = (deadline) => Math.ceil((new Date(deadline).getTime() - Date.now()) / DAY_MS);
const dueText = (d) => {
  if (d < 0) return `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`;
  if (d === 0) return 'Due today';
  return `Due in ${d} day${d === 1 ? '' : 's'}`;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '');
// DCA only concerns forms addressed to DCA (mirrors DcaDashboard).
const isDcaAgency = (s) => /\bDCA\b/i.test(s || '') || /community affairs/i.test(s || '');

const DcaReminders = () => {
  // Reminder-sending tool
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState('');
  const [mode, setMode] = useState('all'); // all | overdue | window | custom
  const [windowDays, setWindowDays] = useState('');
  const [customIds, setCustomIds] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // Real notifications
  const [notifications, setNotifications] = useState([]);
  const [upcoming, setUpcoming] = useState([]);

  const loadNotifications = async () => {
    const [n, u] = await Promise.all([api.get('/notifications'), api.get('/notifications/upcoming')]);
    setNotifications(n.data || []);
    setUpcoming(u.data || []);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [t, n, u] = await Promise.all([
          api.get('/tasks'),
          api.get('/notifications'),
          api.get('/notifications/upcoming')
        ]);
        if (!active) return;
        setTasks(t.data || []);
        setNotifications(n.data || []);
        setUpcoming(u.data || []);
      } catch (err) {
        // leave sections empty on error
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const dcaTasks = useMemo(() => tasks.filter((t) => isDcaAgency(t.submittedTo)), [tasks]);
  const filings = useMemo(
    () => [...new Set(dcaTasks.map((t) => t.title))].sort((a, b) => a.localeCompare(b)),
    [dcaTasks]
  );

  const outstanding = useMemo(() => {
    if (!form) return [];
    return dcaTasks
      .filter((t) => t.title === form && t.status !== 'completed')
      .map((t) => ({ id: t._id, countyName: t.countyId?.name || 'Unknown county', deadline: t.deadline, days: daysUntil(t.deadline) }));
  }, [dcaTasks, form]);

  const overdueList = outstanding.filter((t) => t.days < 0);
  const windows = useMemo(() => {
    const counts = {};
    outstanding.filter((t) => t.days >= 0).forEach((t) => { counts[t.days] = (counts[t.days] || 0) + 1; });
    return Object.keys(counts).map(Number).sort((a, b) => a - b).map((d) => ({ days: d, count: counts[d] }));
  }, [outstanding]);

  const recipients = useMemo(() => {
    if (!form) return [];
    if (mode === 'all') return outstanding;
    if (mode === 'overdue') return overdueList;
    if (mode === 'window' && windowDays !== '') return outstanding.filter((t) => t.days === Number(windowDays));
    if (mode === 'custom') return outstanding.filter((t) => customIds.includes(t.id));
    return [];
  }, [form, mode, windowDays, customIds, outstanding, overdueList]);

  const toggleCounty = (id) => setCustomIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const onFormChange = (value) => { setForm(value); setMode('all'); setWindowDays(''); setCustomIds([]); setResult(null); };

  const handleSend = async () => {
    if (recipients.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api.post('/tasks/send-reminders', { taskIds: recipients.map((r) => r.id), message: message.trim() });
      setResult({ ok: true, text: `Reminder sent to ${res.data.sent} ${res.data.sent === 1 ? 'county' : 'counties'}.` });
      setMessage('');
      loadNotifications(); // reflect the "Reminders Sent" notification
    } catch (err) {
      setResult({ ok: false, text: err.response?.data?.message || 'Failed to send reminders.' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const labelCls = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5';
  const inputCls =
    'w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white';

  return (
    <div className="px-2 sm:px-4 py-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reminders</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Send reminders to counties and review your notifications.</p>
      </div>

      {/* Send a reminder */}
      <div className="max-w-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5 mb-8">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Send a reminder</h2>

        <div>
          <label className={labelCls}>Filing</label>
          <select className={inputCls} value={form} onChange={(e) => onFormChange(e.target.value)}>
            <option value="">Select a filing…</option>
            {filings.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Send to</label>
            <select className={inputCls} value={mode} disabled={!form} onChange={(e) => { setMode(e.target.value); setWindowDays(''); setResult(null); }}>
              <option value="all">All counties still owing ({outstanding.length})</option>
              <option value="overdue">Overdue counties ({overdueList.length})</option>
              <option value="window">Counties due in a specific window…</option>
              <option value="custom">Custom — pick counties…</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Window</label>
            <select className={inputCls} value={windowDays} disabled={!form || mode !== 'window'} onChange={(e) => { setWindowDays(e.target.value); setResult(null); }}>
              <option value="">Select a window…</option>
              {windows.map((w) => (
                <option key={w.days} value={w.days}>{w.days === 0 ? 'Due today' : `Due in ${w.days} days`} ({w.count} {w.count === 1 ? 'county' : 'counties'})</option>
              ))}
            </select>
          </div>
        </div>

        {mode === 'custom' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Select counties</span>
              {outstanding.length > 0 && (
                <div className="text-xs">
                  <button type="button" onClick={() => setCustomIds(outstanding.map((o) => o.id))} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">Select all</button>
                  <span className="text-gray-300 dark:text-gray-600 mx-2">|</span>
                  <button type="button" onClick={() => setCustomIds([])} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">Clear</button>
                </div>
              )}
            </div>
            {outstanding.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No counties still owe this filing.</p>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-60 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                {outstanding.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm">
                    <input type="checkbox" checked={customIds.includes(o.id)} onChange={() => toggleCounty(o.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-gray-800 dark:text-gray-200">{o.countyName}</span>
                    <span className={`ml-auto text-xs ${o.days < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{dueText(o.days)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className={labelCls}>Message <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea className={`${inputCls} resize-none`} rows="3" placeholder="Add a note to include in the reminder email…" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        {form && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-4">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {recipients.length > 0 ? `This reminder will go to ${recipients.length} ${recipients.length === 1 ? 'county' : 'counties'}:` : 'No counties match this selection.'}
            </div>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recipients.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                    {r.countyName}
                    <span className={r.days < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}>· {dueText(r.days)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className={`text-sm font-medium rounded-lg px-4 py-3 ${result.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
            {result.text}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={handleSend} disabled={sending || recipients.length === 0} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? (<><div className="w-4 h-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></div>Sending…</>) : (<>Send reminder{recipients.length > 0 ? ` (${recipients.length})` : ''}</>)}
          </button>
        </div>
      </div>

      {/* Real notifications + upcoming deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Notifications</h2>
          </div>
          {notifications.length === 0 ? (
            <div className="py-12 text-center"><p className="text-gray-500 dark:text-gray-400">No notifications</p></div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[26rem] overflow-y-auto">
              {notifications.map((n) => (
                <li key={n._id} className="px-6 py-4 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.66V5a2 2 0 1 0-4 0v.34A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{n.title}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{n.message}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{fmtDateTime(n.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Upcoming Deadlines</h2>
          </div>
          {upcoming.length === 0 ? (
            <div className="py-12 text-center"><p className="text-gray-500 dark:text-gray-400">No upcoming deadlines</p></div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[26rem] overflow-y-auto">
              {upcoming.map((t) => (
                <li key={t._id} className="px-6 py-4 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.title}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{t.countyId?.name || 'County'}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Due {fmtDate(t.deadline)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default DcaReminders;
