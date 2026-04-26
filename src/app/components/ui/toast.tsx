"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

type ToastInput = {
  title: string;
  description?: string;
};

type ToastItem = ToastInput & {
  id: string;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, ...input }]);
      window.setTimeout(() => dismiss(id), 3000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:justify-end">
        <div className="grid w-full max-w-sm gap-2">
          {toasts.map((item) => (
            <div
              key={item.id}
              className="pointer-events-auto flex items-start gap-3 rounded-lg border bg-popover px-4 py-3 text-popover-foreground shadow-lg"
            >
              <div className="grid gap-0.5">
                <div className="text-sm font-medium">{item.title}</div>
                {item.description && <div className="text-sm text-muted-foreground">{item.description}</div>}
              </div>
              <Button variant="ghost" size="icon-sm" className="ml-auto shrink-0" onClick={() => dismiss(item.id)} aria-label="Fechar toast">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}
