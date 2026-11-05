import { Link, useLocation } from 'react-router-dom';
import { crmClient } from '@/api/crmClient';
import { useQuery } from '@tanstack/react-query';
import { FileQuestion, Home } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/use-document-title';


export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);
    useDocumentTitle('Page Not Found');

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await crmClient.auth.me();
                return { user, isAuthenticated: true };
            } catch (error) {
                return { user: null, isAuthenticated: false };
            }
        }
    });

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-md w-full">
                <div className="text-center space-y-6">
                    {/* Icon */}
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                        <FileQuestion className="w-7 h-7 text-slate-400" aria-hidden="true" />
                    </div>

                    {/* 404 Error Code */}
                    <div className="space-y-2">
                        <h1 className="text-7xl font-light text-slate-300">404</h1>
                        <div className="h-0.5 w-16 bg-slate-200 mx-auto"></div>
                    </div>

                    {/* Main Message */}
                    <div className="space-y-3">
                        <h2 className="text-2xl font-medium text-slate-800">
                            Page Not Found
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            The page <span className="font-medium text-slate-700 break-all">"{pageName}"</span> could not be found in this application.
                        </p>
                    </div>

                    {/* Admin Note */}
                    {isFetched && authData.isAuthenticated && authData.user?.role === 'admin' && (
                        <div className="mt-8 p-4 bg-slate-100 rounded-lg border border-slate-200">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center mt-0.5">
                                    <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                                </div>
                                <div className="text-left space-y-1">
                                    <p className="text-sm font-medium text-slate-700">Admin Note</p>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        This route is not registered in the current application build.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Link */}
                    <div className="pt-6">
                        <Link
                            to="/"
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                        >
                            <Home className="w-4 h-4 mr-2" aria-hidden="true" />
                            Go Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
