import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ModalRoot from './modals/ModalRoot';
import Toast from './components/Toast';

const DcaUIContext = createContext(null);

export const useDcaUI = () => useContext(DcaUIContext);

export const DcaUIProvider = ({ children }) => {
  const [modalStack, setModalStack] = useState([]);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const openModal = useCallback((type, props = {}) => {
    setModalStack((stack) => [...stack, { type, props }]);
  }, []);

  const closeModal = useCallback(() => {
    setModalStack((stack) => stack.slice(0, -1));
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  return (
    <DcaUIContext.Provider value={{ openModal, closeModal, showToast }}>
      {children}
      {modalStack.map((m, i) => (
        <ModalRoot key={i} type={m.type} modalProps={m.props} />
      ))}
      <Toast message={toast} />
    </DcaUIContext.Provider>
  );
};

export default DcaUIContext;
