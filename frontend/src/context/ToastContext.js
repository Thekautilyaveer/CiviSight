import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

// App-wide toasts + a promise-based confirm dialog, so pages can replace alert()/confirm()
// with non-blocking UI. Usage:
//   const { showToast, confirm } = useToast();
//   showToast('Saved', 'success');
//   if (await confirm({ title: 'Delete?', message: '…', danger: true })) { … }
const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext) || { showToast: () => {}, confirm: async () => window.confirm('Are you sure?') };

const toastCls = (type) => {
  const base = 'pointer-events-auto max-w-sm px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium';
  if (type === 'success') return `${base} bg-green-600 text-white`;
  if (type === 'error') return `${base} bg-red-600 text-white`;
  return `${base} bg-gray-900 text-white`;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { title, message, confirmText, cancelText, danger, resolve }
  const idRef = useRef(0);

  const showToast = useCallback((message, type = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const confirm = useCallback(
    (opts = {}) => new Promise((resolve) => setConfirmState({ ...opts, resolve })),
    []
  );

  const closeConfirm = (result) => {
    setConfirmState((cur) => {
      if (cur?.resolve) cur.resolve(result);
      return null;
    });
  };

  return (
    <ToastContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* Toasts */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={toastCls(t.type)}>{t.message}</div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/50 p-4" onClick={() => closeConfirm(false)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            {confirmState.title && <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{confirmState.title}</h3>}
            {confirmState.message && <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{confirmState.message}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => closeConfirm(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {confirmState.cancelText || 'Cancel'}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
                  confirmState.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmState.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
