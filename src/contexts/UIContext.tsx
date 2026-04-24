import React, { createContext, useContext, useState } from 'react';

type UIContextType = {
  showPasswordModal: boolean;
  openChangePassword: () => void;
  closeChangePassword: () => void;
};

const UIContext = createContext<UIContextType | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const openChangePassword = () => setShowPasswordModal(true);
  const closeChangePassword = () => setShowPasswordModal(false);

  return (
    <UIContext.Provider value={{ showPasswordModal, openChangePassword, closeChangePassword }}>
      {children}
    </UIContext.Provider>
  );
}

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
};
