'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AlertOptions = {
  title?: string;
  description: string;
  onConfirm?: () => void;
  showCancel?: boolean;
};

type AlertContextType = {
  showAlert: (description: string, title?: string) => void;
  showConfirm: (description: string, onConfirm: () => void, title?: string) => void;
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AlertOptions>({ description: '' });

  const showAlert = (description: string, title = 'Notification') => {
    setOptions({ description, title, showCancel: false });
    setOpen(true);
  };

  const showConfirm = (description: string, onConfirm: () => void, title = 'Confirm Action') => {
    setOptions({ description, title, onConfirm, showCancel: true });
    setOpen(true);
  };

  const handleConfirm = () => {
    if (options.onConfirm) {
      options.onConfirm();
    }
    setOpen(false);
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {options.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {options.showCancel && (
              <AlertDialogCancel onClick={() => setOpen(false)}>Cancel</AlertDialogCancel>
            )}
            <AlertDialogAction onClick={handleConfirm}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
