// Thin wrapper around sonner — keeps the useToast() API that all pages expect
import { toast as sonnerToast } from "sonner";

function toast({ title, description, variant, ...rest }) {
  const message = title || description || "";
  const opts = {
    description: title && description ? description : undefined,
    ...rest,
  };
  if (variant === "destructive") {
    return sonnerToast.error(message, opts);
  }
  return sonnerToast(message, opts);
}

function useToast() {
  return {
    toast,
    toasts: [], // sonner manages its own queue
    dismiss: (id) => sonnerToast.dismiss(id),
  };
}

export { useToast, toast };