import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Safe isIframe check — guards against SSR and sandboxed iframes that throw on window.top access
export const isIframe = (() => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true; // cross-origin iframes throw a SecurityError
  }
})();
