import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 left-1/2 max-w-[calc(100%-48px)] -translate-x-1/2 translate-y-4 rounded-xl bg-fg px-[18px] py-3 font-semibold text-bg opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-[opacity,translate] duration-150 data-[open=true]:translate-y-0 data-[open=true]:opacity-100"
        role="status"
        aria-live="polite"
        data-open={message !== null}
      >
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
