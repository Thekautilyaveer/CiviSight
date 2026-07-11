import React from 'react';
import { Outlet } from 'react-router-dom';
import { DcaUIProvider } from './DcaUIContext';
import DcaLayout from './DcaLayout';

// Single shell mounted for the whole /dca section so modal/toast state and the
// navbar/chatbot persist across in-section navigations.
const DcaShell = () => (
  <DcaUIProvider>
    <DcaLayout>
      <Outlet />
    </DcaLayout>
  </DcaUIProvider>
);

export default DcaShell;
