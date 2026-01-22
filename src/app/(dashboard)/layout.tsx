'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ChatActionProvider } from '@/lib/chat-action-context';

// Dynamic import to avoid hydration mismatch - ChatDialog uses client-only hooks
const ChatDialog = dynamic(
    () => import('@/components/chat/chat-dialog').then(mod => ({ default: mod.ChatDialog })),
    { ssr: false }
);

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <ChatActionProvider>
            {children}
            <ChatDialog />
        </ChatActionProvider>
    );
}
