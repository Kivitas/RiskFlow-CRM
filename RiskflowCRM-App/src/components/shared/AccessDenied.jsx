import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/use-document-title';

export default function AccessDenied() {
  useDocumentTitle('Access Denied');

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-amber-500" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-800">You don't have access to this page</h1>
          <p className="text-slate-600 leading-relaxed">
            Your role doesn't include permission to view this section. If you think this is a mistake, ask an administrator to update your access.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
