import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed bottom-20 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const colors = {
    success: { border: 'rgba(0,200,150,0.4)', bg: 'rgba(0,200,150,0.08)', icon: '✓', text: '#00c896' },
    error:   { border: 'rgba(255,71,87,0.4)',  bg: 'rgba(255,71,87,0.08)',  icon: '✕', text: '#ff4757' },
    info:    { border: 'rgba(201,150,12,0.4)', bg: 'rgba(201,150,12,0.08)', icon: 'ℹ', text: '#c9960c' },
  }[toast.type];

  return (
    <div
      className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-semibold"
      style={{
        background: `rgba(8,8,8,0.95)`,
        border: `1px solid ${colors.border}`,
        backdropFilter: 'blur(12px)',
        color: '#f5f5f5',
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(48px) scale(0.95)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        minWidth: 220,
        maxWidth: 360,
      }}
    >
      <span className="text-base font-bold" style={{ color: colors.text }}>{colors.icon}</span>
      <span className="flex-1 text-xs leading-snug">{toast.message}</span>
    </div>
  );
}

// Hook
let _addToast: ((msg: Omit<ToastMessage, 'id'>) => void) | null = null;

export function useToastRegistry() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  _addToast = (msg) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...msg, id }]);
  };

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));
  return { toasts, remove };
}

export const toast = {
  success: (message: string) => _addToast?.({ type: 'success', message }),
  error:   (message: string) => _addToast?.({ type: 'error', message }),
  info:    (message: string) => _addToast?.({ type: 'info', message }),
};
