import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Tiny toast system — kept inline so we don't pull in a UI library for
// a single notification widget. <ToastProvider> wraps the app, then any
// component calls useToast().show(message, kind?).

interface Toast {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
}

interface ToastContextValue {
  show: (message: string, kind?: Toast["kind"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const show = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = idRef.current++;
    setToasts((cur) => [...cur, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((cur) => cur.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
