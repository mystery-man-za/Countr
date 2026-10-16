import { useState, useCallback, useEffect, useRef } from "react";

export interface AppError {
  id: string;
  message: string;
  timestamp: number;
}

export function useErrorHandler() {
  const [errors, setErrors] = useState<AppError[]>([]);
  const timeoutsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutsRef.current.clear();
    };
  }, []);

  const showError = useCallback((message: string) => {
    const id = crypto.randomUUID();
    const error: AppError = { id, message, timestamp: Date.now() };
    setErrors((prev) => [...prev.slice(-4), error]);
    const timeoutId = window.setTimeout(() => {
      setErrors((prev) => prev.filter((e) => e.id !== id));
      timeoutsRef.current.delete(timeoutId);
    }, 5000);
    timeoutsRef.current.add(timeoutId);
  }, []);

  const clearError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { errors, showError, clearError };
}
