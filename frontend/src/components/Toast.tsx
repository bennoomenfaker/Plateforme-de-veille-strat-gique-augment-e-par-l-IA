import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'error', onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const colors = {
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in">
      <div className={`${colors[type]} border rounded-lg px-5 py-3 text-sm shadow-xl max-w-md flex items-center gap-2`}>
        <span className="flex-1">{message}</span>
        <button onClick={onClose} className="opacity-60 hover:opacity-100 text-lg leading-none">&times;</button>
      </div>
    </div>
  );
}
