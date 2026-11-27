import React, { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "warning";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl transition-all ${
              t.type === "error"
                ? "bg-red-50 border-red-200 text-red-900"
                : t.type === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-charcoal border-charcoal text-cream"
            }`}
          >
            {t.type === "error" ? (
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : t.type === "warning" ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-food-orange shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
