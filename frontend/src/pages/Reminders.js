import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';

const DAY_MS = 24 * 60 * 60 * 1000;

const daysUntil = (deadline) => Math.ceil((new Date(deadline).getTime() - Date.now()) / DAY_MS);

const dueText = (d) => {
  if (d < 0) return `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`;
  if (d === 0) return 'Due today';
  return `Due in ${d} day${d === 1 ? '' : 's'}`;
};

const Reminders = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState('');
  const [mode, setMode] = useState('all'); // 'all' | 'overdue' | 'window' | 'custom'
  const [windowDays, setWindowDays] = useState('');
  const [customIds, setCustomIds] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const res = await api.get('/tasks');
        setTasks(res.data || []);
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  // Distinct filings (task titles), alphabetical.
  const filings = useMemo(
    () => [...new Set(tasks.map((t) => t.title))].sort((a, b) => a.localeCompare(b)),
    [tasks]
  );

  // Not-yet-completed tasks for the chosen filing, with days-until-deadline.
  const outstanding = useMemo(() => {
    if (!form) return [];
    return tasks
      .filter((t) => t.title === form && t.status !== 'completed')
      .map((t) => ({
        id: t._id,
        countyName: t.countyId?.name || 'Unknown county',
        deadline: t.deadline,
        days: daysUntil(t.deadline)
      }));
  }, [tasks, form]);

  const overdueList = outstanding.filter((t) => t.days < 0);

  // Distinct upcoming due-horizons (clustered by fiscal year), each with a count.
  const windows = useMemo(() => {
    const counts = {};
    outstanding.filter((t) => t.days >= 0).forEach((t) => {
      counts[t.days] = (counts[t.days] || 0) + 1;
    });
    return Object.keys(counts)
      .map(Number)
      .sort((a, b) => a - b)
      .map((d) => ({ days: d, count: counts[d] }));
  }, [outstanding]);

  // Resolve the currently-selected recipient set.
  const recipients = useMemo(() => {
    if (!form) return [];
    if (mode === 'all') return outstanding;
    if (mode === 'overdue') return overdueList;
    if (mode === 'window' && windowDays !== '') {
      return outstanding.filter((t) => t.days === Number(windowDays));
    }
    if (mode === 'custom') return outstanding.filter((t) => customIds.includes(t.id));
    return [];
  }, [form, mode, windowDays, customIds, outstanding, overdueList]);

  const toggleCounty = (id) =>
    setCustomIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const onFormChange = (value) => {
    setForm(value);
    setMode('all');
    setWindowDays('');
    setCustomIds([]);
    setResult(null);
  };

  const handleSend = async () => {
    if (recipients.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api.post('/tasks/send-reminders', {
        taskIds: recipients.map((r) => r.id),
        message: message.trim()
      });
      setResult({ ok: true, text: `Reminder sent to ${res.data.sent} ${res.data.sent === 1 ? 'county' : 'counties'}.` });
      setMessage('');
    } catch (error) {
      setResult({ ok: false, text: error.response?.data?.message || 'Failed to send reminders.' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const labelCls = 'block text-sm font-semibold text-gray-700 mb-1.5';
  const inputCls =
    'w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900';

  return (
    <div className="px-2 sm:px-4 py-6">
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-gray-900">Reminders</h1>
        <p className="mt-1 text-sm text-gray-600">
          Send a reminder to counties on top of the automated ones.
        </p>
      </div>

      <div className="max-w-2xl bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        {/* Filing */}
        <div>
          <label className={labelCls}>Filing</label>
          <select className={inputCls} value={form} onChange={(e) => onFormChange(e.target.value)}>
            <option value="">Select a filing…</option>
            {filings.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Recipients — two dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Send to</label>
            <select
              className={inputCls}
              value={mode}
              disabled={!form}
              onChange={(e) => { setMode(e.target.value); setWindowDays(''); setResult(null); }}
            >
              <option value="all">All counties still owing ({outstanding.length})</option>
              <option value="overdue">Overdue counties ({overdueList.length})</option>
              <option value="window">Counties due in a specific window…</option>
              <option value="custom">Custom — pick counties…</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Window</label>
            <select
              className={inputCls}
              value={windowDays}
              disabled={!form || mode !== 'window'}
              onChange={(e) => { setWindowDays(e.target.value); setResult(null); }}
            >
              <option value="">Select a window…</option>
              {windows.map((w) => (
                <option key={w.days} value={w.days}>
                  {w.days === 0 ? 'Due today' : `Due in ${w.days} days`} ({w.count} {w.count === 1 ? 'county' : 'counties'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom county checklist */}
        {mode === 'custom' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-gray-700">Select counties</span>
              {outstanding.length > 0 && (
                <div className="text-xs">
                  <button type="button" onClick={() => setCustomIds(outstanding.map((o) => o.id))} className="text-blue-600 hover:text-blue-800 font-medium">Select all</button>
                  <span className="text-gray-300 mx-2">|</span>
                  <button type="button" onClick={() => setCustomIds([])} className="text-blue-600 hover:text-blue-800 font-medium">Clear</button>
                </div>
              )}
            </div>
            {outstanding.length === 0 ? (
              <p className="text-sm text-gray-500">No counties still owe this filing.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                {outstanding.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={customIds.includes(o.id)}
                      onChange={() => toggleCounty(o.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-800">{o.countyName}</span>
                    <span className={`ml-auto text-xs ${o.days < 0 ? 'text-red-600' : 'text-gray-400'}`}>{dueText(o.days)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message */}
        <div>
          <label className={labelCls}>Message <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea
            className={`${inputCls} resize-none`}
            rows="3"
            placeholder="Add a note to include in the reminder email…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {/* Preview */}
        {form && (
          <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              {recipients.length > 0
                ? `This reminder will go to ${recipients.length} ${recipients.length === 1 ? 'county' : 'counties'}:`
                : 'No counties match this selection.'}
            </div>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recipients.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1 text-xs font-medium text-gray-700"
                  >
                    {r.countyName}
                    <span className={r.days < 0 ? 'text-red-600' : 'text-gray-400'}>· {dueText(r.days)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`text-sm font-medium rounded-lg px-4 py-3 ${result.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {result.text}
          </div>
        )}

        {/* Send */}
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={sending || recipients.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></div>
                Sending…
              </>
            ) : (
              <>Send reminder{recipients.length > 0 ? ` (${recipients.length})` : ''}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reminders;
