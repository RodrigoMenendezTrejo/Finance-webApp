'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, User, CreditCard, Moon, Bell, Shield, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/firebase/auth-context';

export default function SettingsPage() {
    const router = useRouter();
    const { user, userProfile, signOut } = useAuth();

    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const settingsSections = [
        {
            title: 'Account',
            items: [
                { icon: User, label: 'Profile', onClick: () => { } },
                { icon: CreditCard, label: 'Accounts & Budgets', onClick: () => router.push('/accounts') },
            ],
        },
        {
            title: 'Preferences',
            items: [
                { icon: Moon, label: 'Appearance', description: 'Dark mode', onClick: () => { } },
                { icon: Bell, label: 'Notifications', onClick: () => { } },
            ],
        },
        {
            title: 'Support',
            items: [
                { icon: HelpCircle, label: 'Help & Feedback', onClick: () => { } },
                { icon: Shield, label: 'Privacy Policy', onClick: () => { } },
            ],
        },
    ];

    return (
        <main className="min-h-screen pb-8">
            {/* Header */}
            <header className="sticky top-0 z-40 backdrop-blur-lg bg-background/80 border-b border-border/50">
                <div className="px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-bold">Settings</h1>
                </div>
            </header>

            <div className="p-4 space-y-6">
                {/* User Profile Card */}
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="w-16 h-16">
                            <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                                {getInitials(userProfile?.displayName || user?.email || 'U')}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="font-semibold text-lg">
                                {userProfile?.displayName || 'User'}
                            </p>
                            <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Settings Sections */}
                {settingsSections.map((section) => (
                    <div key={section.title}>
                        <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">
                            {section.title}
                        </h2>
                        <Card>
                            <CardContent className="p-0">
                                {section.items.map((item, index) => (
                                    <div key={item.label}>
                                        <button
                                            onClick={item.onClick}
                                            className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                                        >
                                            <item.icon className="w-5 h-5 text-muted-foreground" />
                                            <div className="flex-1">
                                                <p className="font-medium">{item.label}</p>
                                                {item.description && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                        {index < section.items.length - 1 && <Separator />}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                ))}

                {/* Sign Out Button */}
                <Button
                    variant="destructive"
                    onClick={handleSignOut}
                    className="w-full"
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                </Button>

                {/* App Version */}
                <p className="text-center text-xs text-muted-foreground">
                    SafeBalance v1.0.0
                </p>
            </div>
        </main>
    );
}
