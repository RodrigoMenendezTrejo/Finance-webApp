'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, User, CreditCard, Moon, Sun, Monitor, Bell, Shield, HelpCircle, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/firebase/auth-context';
import { useTheme, Theme } from '@/lib/theme-context';
import { updateUserSettings } from '@/lib/firebase/settings-service';
import { ReactNode } from 'react';

export default function SettingsPage() {
    const router = useRouter();
    const { user, userProfile, signOut } = useAuth();
    const { theme, setTheme } = useTheme();

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

    const handleToggleAutoSuggest = async (checked: boolean) => {
        if (!user) return;
        try {
            // Update local state is handled by auth context real-time listener mostly, 
            // but for immediate feedback we rely on the prop updating or we could optimistically update if needed.
            // The auth context listener should pick it up quickly.
            await updateUserSettings(user.uid, { autoSuggestGoals: checked });
        } catch (error) {
            console.error('Error updating settings:', error);
        }
    };

    interface SettingsItem {
        icon: any;
        label: string;
        description?: string;
        onClick?: () => void;
        action?: ReactNode;
    }

    interface SettingsSection {
        title: string;
        items: SettingsItem[];
    }

    const settingsSections: SettingsSection[] = [
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
                {
                    icon: Target,
                    label: 'Auto-suggest Goals',
                    description: 'Suggest saving when adding income',
                    action: (
                        <Switch
                            checked={userProfile?.autoSuggestGoals !== false}
                            onCheckedChange={handleToggleAutoSuggest}
                        />
                    )
                },
                {
                    icon: Moon,
                    label: 'Appearance',
                    description: theme === 'dark' ? 'Dark mode' : theme === 'light' ? 'Light mode' : 'System',
                    action: (
                        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                            <button
                                onClick={() => setTheme('light')}
                                className={`p-2 rounded-md transition-all ${theme === 'light'
                                        ? 'bg-card text-amber-500 shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <Sun className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`p-2 rounded-md transition-all ${theme === 'dark'
                                        ? 'bg-card text-blue-500 shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <Moon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`p-2 rounded-md transition-all ${theme === 'system'
                                        ? 'bg-card text-emerald-500 shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <Monitor className="w-4 h-4" />
                            </button>
                        </div>
                    )
                },
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
                                        <div
                                            onClick={item.onClick}
                                            className={`w-full p-4 flex items-center gap-3 ${item.onClick ? 'hover:bg-muted/50 cursor-pointer' : ''} transition-colors text-left`}
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
                                            {item.action && (
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    {item.action}
                                                </div>
                                            )}
                                        </div>
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
