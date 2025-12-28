'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { Loader2, AlertTriangle } from 'lucide-react';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/register'];

interface AuthGuardProps {
    children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    useEffect(() => {
        if (!loading && isFirebaseConfigured) {
            if (!user && !isPublicRoute) {
                router.push('/login');
            } else if (user && isPublicRoute) {
                router.push('/');
            }
        }
    }, [user, loading, isPublicRoute, router]);

    // Show setup instructions if Firebase is not configured
    if (!isFirebaseConfigured) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="max-w-md text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
                    <h1 className="text-2xl font-bold">Firebase Not Configured</h1>
                    <p className="text-muted-foreground">
                        To use this app, you need to configure Firebase credentials.
                    </p>
                    <div className="text-left bg-muted p-4 rounded-lg text-sm space-y-2">
                        <p className="font-medium">Quick Setup:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                            <li>Create a project at <a href="https://console.firebase.google.com" target="_blank" className="text-primary underline">Firebase Console</a></li>
                            <li>Enable Authentication (Email/Password)</li>
                            <li>Create a Firestore database</li>
                            <li>Copy your config to <code className="bg-background px-1 rounded">.env.local</code></li>
                            <li>Restart the dev server</li>
                        </ol>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        See <code className="bg-muted px-1 rounded">FIREBASE_SETUP.md</code> for detailed instructions.
                    </p>
                </div>
            </div>
        );
    }

    // Show loading spinner while checking auth
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render protected content if not authenticated
    if (!user && !isPublicRoute) {
        return null;
    }

    // Don't render login page if already authenticated
    if (user && isPublicRoute) {
        return null;
    }

    return <>{children}</>;
}
