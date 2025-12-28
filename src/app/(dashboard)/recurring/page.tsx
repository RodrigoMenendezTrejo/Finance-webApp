'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Loader2, Repeat, DollarSign, Receipt, Trash2, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuth } from '@/lib/firebase/auth-context';
import { getAccounts } from '@/lib/firebase/accounts-service';
import {
    getRecurringTransactions,
    createRecurring,
    deleteRecurring,
    toggleRecurringActive,
    getMonthlyRecurringTotal,
    calculateTotalSpent,
} from '@/lib/firebase/recurring-service';
import { RecurringTransaction, RecurringType, RecurringFrequency, SUBSCRIPTION_PRESETS, INCOME_PRESETS, BILL_PRESETS } from '@/types/recurring';
import { Account } from '@/types/firestore';

const tabConfig = {
    subscription: { icon: Repeat, label: 'Subscriptions', color: 'text-purple-500' },
    income: { icon: DollarSign, label: 'Income', color: 'text-emerald-500' },
    bill: { icon: Receipt, label: 'Bills', color: 'text-orange-500' },
};

export default function RecurringPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<string>('subscription');
    const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [monthlyTotals, setMonthlyTotals] = useState<Record<RecurringType, number>>({
        subscription: 0,
        income: 0,
        bill: 0,
    });

    // Add dialog state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newFrequency, setNewFrequency] = useState<RecurringFrequency>('monthly');
    const [newStartDate, setNewStartDate] = useState<Date | undefined>(undefined);
    const [newEndDate, setNewEndDate] = useState<Date | undefined>(undefined);
    const [hasEndDate, setHasEndDate] = useState(false);
    const [newAccountId, setNewAccountId] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Delete dialog state
    const [selectedRecurring, setSelectedRecurring] = useState<RecurringTransaction | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        async function fetchData() {
            if (!user) return;
            try {
                const [recurringData, accountsData] = await Promise.all([
                    getRecurringTransactions(user.uid),
                    getAccounts(user.uid),
                ]);
                setRecurring(recurringData);
                setAccounts(accountsData);

                // Calculate monthly totals
                const [subTotal, incomeTotal, billTotal] = await Promise.all([
                    getMonthlyRecurringTotal(user.uid, 'subscription'),
                    getMonthlyRecurringTotal(user.uid, 'income'),
                    getMonthlyRecurringTotal(user.uid, 'bill'),
                ]);
                setMonthlyTotals({
                    subscription: subTotal,
                    income: incomeTotal,
                    bill: billTotal,
                });
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [user]);

    const refreshData = async () => {
        if (!user) return;
        const data = await getRecurringTransactions(user.uid);
        setRecurring(data);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(value);
    };

    const getRecurringByType = (type: RecurringType) => {
        return recurring.filter(r => r.type === type);
    };

    const getPresets = (type: RecurringType) => {
        switch (type) {
            case 'subscription': return SUBSCRIPTION_PRESETS;
            case 'income': return INCOME_PRESETS;
            case 'bill': return BILL_PRESETS;
        }
    };

    const handleSelectPreset = (preset: { name: string; amount?: number }) => {
        setNewName(preset.name);
        if (preset.amount) {
            setNewAmount(preset.amount.toString());
        }
    };

    const handleCreate = async () => {
        if (!user || !newName.trim() || !newAmount || !newAccountId) return;

        setIsCreating(true);
        try {
            await createRecurring(user.uid, {
                type: activeTab as RecurringType,
                name: newName.trim(),
                amount: parseFloat(newAmount),
                category: activeTab === 'income' ? 'income' : 'subscriptions',
                frequency: newFrequency,
                startDate: newStartDate,
                endDate: hasEndDate ? newEndDate : undefined,
                accountId: newAccountId,
            });

            await refreshData();
            setNewName('');
            setNewAmount('');
            setNewFrequency('monthly');
            setNewStartDate(undefined);
            setNewEndDate(undefined);
            setHasEndDate(false);
            setIsAddOpen(false);
        } catch (error) {
            console.error('Error creating recurring:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleActive = async (item: RecurringTransaction) => {
        if (!user) return;
        try {
            await toggleRecurringActive(user.uid, item.id, !item.isActive);
            await refreshData();
        } catch (error) {
            console.error('Error toggling recurring:', error);
        }
    };

    const handleDelete = async () => {
        if (!user || !selectedRecurring) return;

        setIsDeleting(true);
        try {
            await deleteRecurring(user.uid, selectedRecurring.id);
            await refreshData();
            setIsDeleteOpen(false);
            setSelectedRecurring(null);
        } catch (error) {
            console.error('Error deleting recurring:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

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
                    <h1 className="text-xl font-bold">Recurring</h1>

                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="ml-auto">
                                <Plus className="w-4 h-4 mr-1" />
                                Add
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Add {tabConfig[activeTab as keyof typeof tabConfig].label.slice(0, -1)}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                {/* Presets */}
                                <div>
                                    <label className="text-sm text-muted-foreground mb-2 block">Quick Select</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {getPresets(activeTab as RecurringType).slice(0, 6).map((preset) => (
                                            <button
                                                key={preset.name}
                                                onClick={() => handleSelectPreset(preset)}
                                                className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1
                          ${newName === preset.name ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
                        `}
                                            >
                                                {preset.icon} {preset.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-muted-foreground mb-1 block">Name</label>
                                    <Input
                                        placeholder="e.g., Netflix, Salary, Rent"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-muted-foreground mb-1 block">Amount (€)</label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={newAmount}
                                        onChange={(e) => setNewAmount(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-muted-foreground mb-1 block">Frequency</label>
                                    <div className="flex gap-2">
                                        {(['weekly', 'monthly', 'yearly'] as RecurringFrequency[]).map((freq) => (
                                            <button
                                                key={freq}
                                                onClick={() => setNewFrequency(freq)}
                                                className={`flex-1 py-2 rounded-lg text-sm capitalize
                          ${newFrequency === freq ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
                        `}
                                            >
                                                {freq}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {newFrequency !== 'weekly' && (
                                    <div>
                                        <label className="text-sm text-muted-foreground mb-1 block">Start Date</label>
                                        <DatePicker
                                            date={newStartDate}
                                            onDateChange={setNewStartDate}
                                            placeholder="Select start date"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            The day of month will repeat based on this date
                                        </p>
                                    </div>
                                )}

                                {/* End Date Toggle */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            checked={hasEndDate}
                                            onChange={(e) => {
                                                setHasEndDate(e.target.checked);
                                                if (!e.target.checked) setNewEndDate(undefined);
                                            }}
                                            className="rounded"
                                        />
                                        Has end date (temporary subscription)
                                    </label>
                                </div>

                                {hasEndDate && (
                                    <div>
                                        <label className="text-sm text-muted-foreground mb-1 block">End Date</label>
                                        <DatePicker
                                            date={newEndDate}
                                            onDateChange={setNewEndDate}
                                            placeholder="Select end date"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm text-muted-foreground mb-1 block">Account</label>
                                    <div className="space-y-2">
                                        {accounts.filter(a => a.type === 'asset').map((account) => (
                                            <button
                                                key={account.id}
                                                onClick={() => setNewAccountId(account.id)}
                                                className={`w-full p-3 rounded-lg text-left flex items-center gap-3
                          ${newAccountId === account.id ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
                        `}
                                            >
                                                <span>{account.icon || '💰'}</span>
                                                <span>{account.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <Button
                                    onClick={handleCreate}
                                    disabled={isCreating || !newName.trim() || !newAmount || !newAccountId}
                                    className="w-full"
                                >
                                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            <div className="p-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full mb-4">
                        {Object.entries(tabConfig).map(([key, config]) => (
                            <TabsTrigger key={key} value={key} className="flex-1">
                                <config.icon className={`w-4 h-4 mr-1 ${config.color}`} />
                                {config.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {(['subscription', 'income', 'bill'] as RecurringType[]).map((type) => {
                        const config = tabConfig[type];
                        const items = getRecurringByType(type);

                        return (
                            <TabsContent key={type} value={type} className="space-y-3">
                                {/* Monthly Total */}
                                <Card className="bg-gradient-to-r from-card to-muted/30">
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <span className="text-muted-foreground">
                                            Monthly {config.label}
                                        </span>
                                        <span className={`text-xl font-bold ${config.color}`}>
                                            {type === 'income' ? '+' : '-'}{formatCurrency(monthlyTotals[type])}
                                        </span>
                                    </CardContent>
                                </Card>

                                {/* Items list */}
                                {items.map((item) => (
                                    <Card
                                        key={item.id}
                                        className={`transition-colors ${item.isActive ? '' : 'opacity-50'}`}
                                    >
                                        <CardContent className="p-4 flex items-center gap-3">
                                            <div className="flex-1">
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatCurrency(item.amount)} / {item.frequency}
                                                    {' · Next: '}
                                                    {item.nextDueDate.toDate().toLocaleDateString()}
                                                </p>
                                                <p className="text-xs text-purple-400">
                                                    Total spent: {formatCurrency(calculateTotalSpent(item))}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleToggleActive(item)}
                                                    className="p-2 rounded-full hover:bg-muted transition-colors"
                                                >
                                                    {item.isActive ? (
                                                        <Power className="w-4 h-4 text-emerald-500" />
                                                    ) : (
                                                        <PowerOff className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedRecurring(item);
                                                        setIsDeleteOpen(true);
                                                    }}
                                                    className="p-2 rounded-full hover:bg-muted transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4 text-rose-500" />
                                                </button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {items.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <p>No {config.label.toLowerCase()} yet</p>
                                        <Button
                                            variant="link"
                                            onClick={() => setIsAddOpen(true)}
                                            className="mt-2"
                                        >
                                            Add your first one
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </div>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Recurring</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete &quot;{selectedRecurring?.name}&quot;?
                            Future transactions will no longer be created.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
