'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to dashboard route so it uses the dashboard layout
export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to /home which will use the (dashboard) layout
        router.replace('/home');
    }, [router]);

    return null;
}
