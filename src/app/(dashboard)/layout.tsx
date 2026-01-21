'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import to avoid hydration mismatch - ChatDialog uses client-only hooks
const ChatDialog = dynamic(
    () => import('@/components/chat/chat-dialog').then(mod => ({ default: mod.ChatDialog })),
    { ssr: false }
);

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <ChatDialog />
        </>
    );
}
