import { useEffect } from 'react';

const APP_NAME = 'RiskFlow CRM';

/**
 * Sets document.title to "<title> · RiskFlow CRM" while the calling component is mounted,
 * and restores the previous title on unmount or when the title changes.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return undefined;

    const previousTitle = document.title;
    document.title = `${title} · ${APP_NAME}`;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}

export default useDocumentTitle;
