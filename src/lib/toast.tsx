'use client';

let toastId = 0;

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let listeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function notifyListeners() {
  listeners.forEach((l) => l([...toasts]));
}

function addToast(message: string, type: ToastType) {
  const id = ++toastId;
  toasts = [...toasts, { id, message, type }];
  notifyListeners();

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  }, 3000);
}

export const toast = {
  success: (message: string) => addToast(message, 'success'),
  error: (message: string) => addToast(message, 'error'),
  info: (message: string) => addToast(message, 'info'),
  subscribe: (listener: (toasts: Toast[]) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
  getToasts: () => [...toasts],
};

export function ToastContainer() {
  const [currentToasts, setCurrentToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => {
    return toast.subscribe(setCurrentToasts);
  }, []);

  if (currentToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {currentToasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-4 py-3 shadow-lg text-white text-sm font-medium animate-in slide-in-from-right ${
            t.type === 'success'
              ? 'bg-green-600'
              : t.type === 'error'
              ? 'bg-red-600'
              : 'bg-indigo-600'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

import * as React from 'react';