import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Lightweight toast system. A provider holds a list of active toasts;
// useToast() exposes push() to anywhere in the tree. Toasts auto-
// dismiss after `duration` ms (default 4000) and are positioned in a
// fixed top-right stack.

export type ToastTone = "info" | "success" | "error";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  push: (t: Omit<Toast, "id"> & { duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((curr) => curr.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (input: Omit<Toast, "id"> & { duration?: number }) => {
      const id = Math.floor(Math.random() * 1e9);
      const toast: Toast = {
        id,
        tone: input.tone,
        title: input.title,
        ...(input.description ? { description: input.description } : {}),
      };
      setToasts((curr) => [...curr, toast]);
      const duration = input.duration ?? 4000;
      window.setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const ctx = useMemo<ToastContextValue>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <div className="toast-title">{t.title}</div>
            {t.description ? <div className="toast-desc">{t.description}</div> : null}
            <button
              className="toast-close"
              onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// Small helper that closes a callback when Escape is pressed. Used by
// modal dialogs to honour the standard keyboard shortcut.
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape]);
}
