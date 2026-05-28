"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/cn";

type ToastVariant = "success" | "error" | "info" | "warning";

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
};

type ToastContextValue = {
  toast: (msg: string, opts?: { variant?: ToastVariant; duration?: number }) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (msg: string, opts?: { variant?: ToastVariant; duration?: number }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const variant = opts?.variant ?? "info";
      const duration = opts?.duration ?? 3000;
      setToasts((prev) => [...prev, { id, message: msg, variant, duration }]);
      const timer = setTimeout(() => remove(id), duration);
      timers.current.set(id, timer);
    },
    [remove],
  );

  const value: ToastContextValue = {
    toast,
    success: (m) => toast(m, { variant: "success" }),
    error: (m) => toast(m, { variant: "error", duration: 4500 }),
    info: (m) => toast(m, { variant: "info" }),
    warning: (m) => toast(m, { variant: "warning" }),
  };

  useEffect(() => {
    const refMap = timers.current;
    return () => {
      refMap.forEach((t) => clearTimeout(t));
      refMap.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-3 sm:bottom-4"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

const ICONS: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-success/40 bg-success/15 text-success",
  error: "border-danger/40 bg-danger/15 text-danger",
  warning: "border-warning/40 bg-warning/15 text-warning",
  info: "border-accent-border bg-accent-bg text-accent-soft",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const Icon = ICONS[toast.variant];
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-lg backdrop-blur-sm animate-toast-in",
        VARIANT_STYLES[toast.variant],
      )}
    >
      <Icon className="size-4 shrink-0" />
      <p className="min-w-0 flex-1 text-xs">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer"
        className="text-current opacity-70 hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
