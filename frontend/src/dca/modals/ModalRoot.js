import React from 'react';
import ContactsModal from './ContactsModal';
import AddFilingModal from './AddFilingModal';
import AddEditTaskModal from './AddEditTaskModal';
import AddFormOwnersModal from './AddFormOwnersModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import ReturnForCorrectionModal from './ReturnForCorrectionModal';
import ManageEntitiesModal from './ManageEntitiesModal';
import AddEntityModal from './AddEntityModal';

const MODALS = {
  contacts: ContactsModal,
  addFiling: AddFilingModal,
  addEditTask: AddEditTaskModal,
  addFormOwners: AddFormOwnersModal,
  deleteConfirm: DeleteConfirmModal,
  returnForCorrection: ReturnForCorrectionModal,
  manageEntities: ManageEntitiesModal,
  addEntity: AddEntityModal
};

const ModalRoot = ({ type, modalProps }) => {
  const Component = MODALS[type];
  if (!Component) return null;
  return <Component {...modalProps} />;
};

export default ModalRoot;
