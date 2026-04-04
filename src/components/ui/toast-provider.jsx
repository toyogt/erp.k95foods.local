import React, { createContext, useContext, useState, useEffect } from 'react';

const ToastContextData = createContext(undefined);

export function ToastContextProvider({ children }) {
  const [state, setState] = useState({ toasts: [] });

  return (
    <ToastContextData.Provider value={{ state, setState }}>
      {children}
    </ToastContextData.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContextData);
  if (!context) {
    throw new Error('useToastContext must be used within ToastContextProvider');
  }
  return context;
}