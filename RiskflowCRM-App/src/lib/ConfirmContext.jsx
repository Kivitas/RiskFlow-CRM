import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ConfirmContext = createContext(null);

const initialState = {
  open: false,
  title: 'Confirm action',
  description: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  destructive: false,
};

export function ConfirmProvider({ children }) {
  const resolverRef = useRef(null);
  const [state, setState] = useState(initialState);

  const closeWith = useCallback((result) => {
    setState((current) => ({ ...current, open: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }
    resolverRef.current = resolve;
    setState({
      open: true,
      title: options?.title || initialState.title,
      description: options?.description || '',
      confirmLabel: options?.confirmLabel || 'Confirm',
      cancelLabel: options?.cancelLabel || 'Cancel',
      destructive: Boolean(options?.destructive),
    });
  }), []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) {
            closeWith(false);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.description ? <AlertDialogDescription>{state.description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => closeWith(false)}>{state.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              className={state.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => closeWith(true)}
            >
              {state.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
}
