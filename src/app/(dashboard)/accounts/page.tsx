'use client';

import { useState, Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Wallet, CreditCard, Users, Loader2, Trash2, Check, Pencil, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/firebase/auth-context';
import { getAccounts, createAccount, updateAccount, deleteAccount, markLiabilityPaid, getAccountsByType as getAccountsByTypeFromDb } from '@/lib/firebase/accounts-service';
import { createTransaction } from '@/lib/firebase/transactions-service';
import { Account, AccountType } from '@/types/firestore';

const tabConfig = {
    asset: { icon: Wallet, label: 'Assets', color: 'text-blue-500' },
    liability: { icon: CreditCard, label: 'Liabilities', color: 'text-rose-500' },
    receivable: { icon: Users, label: 'Receivables', color: 'text-emerald-500' },
};

const accountIcons: Record<AccountType, string[]> = {
    asset: ['🏦', '💵', '🐷', '💰', '📈'],
    liability: ['💳', '🏠', '🚗', '📱'],
    receivable: ['👤', '👥', '🤝'],
};

function AccountsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const initialTab = searchParams.get('type') as AccountType || 'asset';
    const [activeTab, setActiveTab] = useState<string>(initialTab);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    // Add account dialog state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountBalance, setNewAccountBalance] = useState('');
    const [newAccountIcon, setNewAccountIcon] = useState('');
    const [newAccountCategory, setNewAccountCategory] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Photo capture state for Add dialog
    const [addPhotoPreview, setAddPhotoPreview] = useState<string | null>(null);
    const [isAddAnalyzing, setIsAddAnalyzing] = useState(false);
    const addFileInputRef = useRef<HTMLInputElement>(null);

    // Edit account dialog state
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editBalance, setEditBalance] = useState('');
    const [editIcon, setEditIcon] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Photo capture state for Edit dialog
    const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
    const [isEditAnalyzing, setIsEditAnalyzing] = useState(false);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    // Delete confirmation state
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Settle receivable state
    const [isSettling, setIsSettling] = useState(false);

    // Pay liability state
    const [isPayOpen, setIsPayOpen] = useState(false);
    const [payFromAccountId, setPayFromAccountId] = useState('');
    const [isPaying, setIsPaying] = useState(false);
    const [assetAccounts, setAssetAccounts] = useState<Account[]>([]);

    // Fetch accounts
    useEffect(() => {
        async function fetchAccounts() {
            if (!user) return;
            try {
                const data = await getAccounts(user.uid);
                setAccounts(data);
            } catch (error) {
                console.error('Error fetching accounts:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchAccounts();
    }, [user]);

    const refreshAccounts = async () => {
        if (!user) return;
        const data = await getAccounts(user.uid);
        setAccounts(data);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(value);
    };

    const getAccountsByType = (type: AccountType) => {
        return accounts.filter(a => a.type === type);
    };

    const getTotal = (type: AccountType) => {
        return getAccountsByType(type).reduce((sum, acc) => sum + acc.balance, 0);
    };

    // Photo handling for Add dialog
    const handleAddPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setAddPhotoPreview(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const analyzeAddPhoto = async () => {
        if (!addPhotoPreview) return;

        setIsAddAnalyzing(true);
        try {
            const response = await fetch(addPhotoPreview);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('image', blob, 'product.jpg');

            const res = await fetch('/api/detect-product', {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();

            if (!res.ok) {
                console.error('API error:', result);
                alert(`Detection failed: ${result.error || 'Unknown error'}`);
                return;
            }

            if (result.category) {
                setNewAccountCategory(result.category);
            }
            if (result.price && result.price > 0) {
                setNewAccountBalance(result.price.toString());
            }
        } catch (error) {
            console.error('Error analyzing photo:', error);
            alert('Failed to analyze photo. Please try again.');
        } finally {
            setIsAddAnalyzing(false);
        }
    };

    // Photo handling for Edit dialog
    const handleEditPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setEditPhotoPreview(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const analyzeEditPhoto = async () => {
        if (!editPhotoPreview) return;

        setIsEditAnalyzing(true);
        try {
            const response = await fetch(editPhotoPreview);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('image', blob, 'product.jpg');

            const res = await fetch('/api/detect-product', {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();

            if (!res.ok) {
                console.error('API error:', result);
                alert(`Detection failed: ${result.error || 'Unknown error'}`);
                return;
            }

            if (result.category) {
                setEditCategory(result.category);
            }
            if (result.price && result.price > 0) {
                setEditBalance(result.price.toString());
            }
        } catch (error) {
            console.error('Error analyzing photo:', error);
            alert('Failed to analyze photo. Please try again.');
        } finally {
            setIsEditAnalyzing(false);
        }
    };

    const handleCreateAccount = async () => {
        if (!user || !newAccountName.trim()) return;

        setIsCreating(true);
        try {
            await createAccount(user.uid, {
                name: newAccountName.trim(),
                type: activeTab as AccountType,
                balance: parseFloat(newAccountBalance) || 0,
                icon: newAccountIcon || accountIcons[activeTab as AccountType][0],
                category: activeTab === 'receivable' && newAccountCategory.trim() ? newAccountCategory.trim() : undefined,
            });

            await refreshAccounts();
            setNewAccountName('');
            setNewAccountBalance('');
            setNewAccountIcon('');
            setNewAccountCategory('');
            setAddPhotoPreview(null);
            setIsAddOpen(false);
        } catch (error) {
            console.error('Error creating account:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const openEditDialog = (account: Account) => {
        setSelectedAccount(account);
        setEditName(account.name);
        setEditBalance(account.balance.toString());
        setEditIcon(account.icon || '');
        setEditCategory(account.category || '');
        setEditPhotoPreview(null);
        setIsEditOpen(true);
    };

    const handleUpdateAccount = async () => {
        if (!user || !selectedAccount || !editName.trim()) return;

        setIsSaving(true);
        try {
            await updateAccount(user.uid, selectedAccount.id, {
                name: editName.trim(),
                balance: parseFloat(editBalance) || 0,
                icon: editIcon || selectedAccount.icon,
                ...(selectedAccount.type === 'receivable' && editCategory.trim() ? { category: editCategory.trim() } : {}),
            });

            await refreshAccounts();
            setIsEditOpen(false);
            setSelectedAccount(null);
            setEditPhotoPreview(null);
        } catch (error) {
            console.error('Error updating account:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user || !selectedAccount) return;

        setIsDeleting(true);
        try {
            await deleteAccount(user.uid, selectedAccount.id);
            await refreshAccounts();
            setIsDeleteOpen(false);
            setIsEditOpen(false);
            setSelectedAccount(null);
        } catch (error) {
            console.error('Error deleting account:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSettleReceivable = async () => {
        if (!user || !selectedAccount) return;

        setIsSettling(true);
        try {
            // Get user's first asset account to receive payment
            const assetAccounts = accounts.filter(a => a.type === 'asset');
            const targetAccountId = assetAccounts[0]?.id;

            if (targetAccountId) {
                // Create a transaction for the payment received
                await createTransaction(user.uid, {
                    date: new Date(),
                    payee: selectedAccount.name,
                    category: 'Payment Received',
                    notes: `Debt settled by ${selectedAccount.name}`,
                    amount: selectedAccount.balance,
                    type: 'income',
                    splits: [
                        { accountId: targetAccountId, amount: selectedAccount.balance },
                        { accountId: selectedAccount.id, amount: -selectedAccount.balance },
                    ],
                });
            }

            await refreshAccounts();
            setIsEditOpen(false);
            setSelectedAccount(null);
        } catch (error) {
            console.error('Error settling receivable:', error);
        } finally {
            setIsSettling(false);
        }
    };

    const openPayDialog = async () => {
        if (!user) return;
        // Load asset accounts for the dropdown
        const assets = await getAccountsByTypeFromDb(user.uid, 'asset');
        setAssetAccounts(assets);
        setPayFromAccountId(assets[0]?.id || '');
        setIsPayOpen(true);
    };

    const handlePayLiability = async () => {
        if (!user || !selectedAccount || !payFromAccountId) return;

        setIsPaying(true);
        try {
            await markLiabilityPaid(user.uid, selectedAccount.id, payFromAccountId);
            await refreshAccounts();
            setIsPayOpen(false);
            setIsEditOpen(false);
            setSelectedAccount(null);
        } catch (error) {
            console.error('Error paying liability:', error);
            alert('Failed to mark as paid. Please try again.');
        } finally {
            setIsPaying(false);
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
                    <h1 className="text-xl font-bold">Accounts</h1>

                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="ml-auto">
                                <Plus className="w-4 h-4 mr-1" />
                                Add
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add {tabConfig[activeTab as keyof typeof tabConfig].label.slice(0, -1)}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div>
                                    <label className="text-sm text-muted-foreground mb-1 block">Name</label>
                                    <Input
                                        placeholder={activeTab === 'receivable' ? "Person's name" : 'Account name'}
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground mb-1 block">
                                        {activeTab === 'receivable' ? 'Amount Owed' : 'Initial Balance'}
                                    </label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={newAccountBalance}
                                        onChange={(e) => setNewAccountBalance(e.target.value)}
                                    />
                                </div>
                                {(activeTab === 'receivable' || activeTab === 'liability') && (
                                    <div>
                                        <label className="text-sm text-muted-foreground mb-1 block">
                                            {activeTab === 'receivable' ? 'Reason (what do they owe for?)' : 'Reason (what do you owe for?)'}
                                        </label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="e.g., Food, Gas, Rent split"
                                                value={newAccountCategory}
                                                onChange={(e) => setNewAccountCategory(e.target.value)}
                                                className="flex-1"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => addFileInputRef.current?.click()}
                                                title="Take photo to detect category"
                                            >
                                                <Camera className="w-4 h-4" />
                                            </Button>
                                            <input
                                                ref={addFileInputRef}
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={handleAddPhotoSelect}
                                                className="hidden"
                                            />
                                        </div>
                                        {addPhotoPreview && (
                                            <div className="mt-3 space-y-2">
                                                <div className="relative inline-block">
                                                    <img
                                                        src={addPhotoPreview}
                                                        alt="Preview"
                                                        className="rounded-lg h-24 object-cover"
                                                    />
                                                    <button
                                                        onClick={() => setAddPhotoPreview(null)}
                                                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-sm font-bold"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={analyzeAddPhoto}
                                                    disabled={isAddAnalyzing}
                                                    className="w-full"
                                                >
                                                    {isAddAnalyzing ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            Detecting...
                                                        </>
                                                    ) : (
                                                        'Detect Category from Photo'
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <label className="text-sm text-muted-foreground mb-1 block">Icon</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {accountIcons[activeTab as AccountType].map((icon) => (
                                            <button
                                                key={icon}
                                                onClick={() => setNewAccountIcon(icon)}
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl
                          ${newAccountIcon === icon ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
                        `}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <Button
                                    onClick={handleCreateAccount}
                                    disabled={isCreating || !newAccountName.trim()}
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

                    {(['asset', 'liability', 'receivable'] as AccountType[]).map((type) => {
                        const config = tabConfig[type];
                        const typeAccounts = getAccountsByType(type);

                        return (
                            <TabsContent key={type} value={type} className="space-y-3">
                                {/* Total */}
                                <Card className="bg-gradient-to-r from-card to-muted/30">
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <span className="text-muted-foreground">
                                            Total {config.label}
                                        </span>
                                        <span className={`text-xl font-bold ${config.color}`}>
                                            {formatCurrency(getTotal(type))}
                                        </span>
                                    </CardContent>
                                </Card>

                                {/* Accounts list */}
                                {typeAccounts.map((account) => (
                                    <Card
                                        key={account.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => openEditDialog(account)}
                                    >
                                        <CardContent className="p-4 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                                                {account.icon || '💰'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium">{account.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {type === 'receivable'
                                                        ? `Owes you${account.category ? ` for ${account.category}` : ''}`
                                                        : type === 'liability'
                                                            ? account.isPaid
                                                                ? '✓ Paid'
                                                                : `You owe${account.category ? ` for ${account.category}` : ''}`
                                                            : 'Balance'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${config.color}`}>
                                                    {formatCurrency(account.balance)}
                                                </span>
                                                <Pencil className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {typeAccounts.length === 0 && (
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

            {/* Edit Account Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit {selectedAccount?.type === 'receivable' ? 'Receivable' : 'Account'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Name</label>
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">
                                {selectedAccount?.type === 'receivable' ? 'Amount Owed' : 'Balance'}
                            </label>
                            <Input
                                type="number"
                                value={editBalance}
                                onChange={(e) => setEditBalance(e.target.value)}
                            />
                        </div>
                        {selectedAccount?.type === 'receivable' && (
                            <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Reason</label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="e.g., Food, Gas, Rent split"
                                        value={editCategory}
                                        onChange={(e) => setEditCategory(e.target.value)}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => editFileInputRef.current?.click()}
                                        title="Take photo to detect category"
                                    >
                                        <Camera className="w-4 h-4" />
                                    </Button>
                                    <input
                                        ref={editFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleEditPhotoSelect}
                                        className="hidden"
                                    />
                                </div>
                                {editPhotoPreview && (
                                    <div className="mt-3 space-y-2">
                                        <div className="relative inline-block">
                                            <img
                                                src={editPhotoPreview}
                                                alt="Preview"
                                                className="rounded-lg h-24 object-cover"
                                            />
                                            <button
                                                onClick={() => setEditPhotoPreview(null)}
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-sm font-bold"
                                            >
                                                ×
                                            </button>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            onClick={analyzeEditPhoto}
                                            disabled={isEditAnalyzing}
                                            className="w-full"
                                        >
                                            {isEditAnalyzing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Detecting...
                                                </>
                                            ) : (
                                                'Detect Category from Photo'
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Icon</label>
                            <div className="flex gap-2 flex-wrap">
                                {selectedAccount && accountIcons[selectedAccount.type].map((icon) => (
                                    <button
                                        key={icon}
                                        onClick={() => setEditIcon(icon)}
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl
                      ${editIcon === icon ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
                    `}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleUpdateAccount}
                                disabled={isSaving || !editName.trim()}
                                className="flex-1"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                            </Button>
                        </div>

                        {/* Settle receivable button */}
                        {selectedAccount?.type === 'receivable' && selectedAccount.balance > 0 && (
                            <Button
                                variant="outline"
                                onClick={handleSettleReceivable}
                                disabled={isSettling}
                                className="w-full text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                                {isSettling ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Check className="w-4 h-4 mr-2" />
                                )}
                                Mark as Paid ({formatCurrency(selectedAccount.balance)})
                            </Button>
                        )}

                        {/* Mark liability as paid button */}
                        {selectedAccount?.type === 'liability' && !selectedAccount?.isPaid && (
                            <Button
                                variant="outline"
                                onClick={openPayDialog}
                                className="w-full text-rose-500 border-rose-500/30 hover:bg-rose-500/10"
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Mark as Paid ({formatCurrency(selectedAccount.balance)})
                            </Button>
                        )}

                        {/* Delete button */}
                        <Button
                            variant="destructive"
                            onClick={() => setIsDeleteOpen(true)}
                            className="w-full"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Account</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete &quot;{selectedAccount?.name}&quot;?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pay Liability Dialog */}
            <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pay Liability</DialogTitle>
                        <DialogDescription>
                            Choose which account to pay from. This will deduct {selectedAccount ? formatCurrency(selectedAccount.balance) : ''} from the selected account.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm text-muted-foreground mb-2 block">Pay from:</label>
                        <select
                            value={payFromAccountId}
                            onChange={(e) => setPayFromAccountId(e.target.value)}
                            className="w-full p-3 rounded-lg bg-muted border border-border text-foreground"
                        >
                            {assetAccounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.icon || '💰'} {account.name} ({formatCurrency(account.balance)})
                                </option>
                            ))}
                        </select>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsPayOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handlePayLiability}
                            disabled={isPaying}
                            className="bg-rose-600 hover:bg-rose-700"
                        >
                            {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}

export default function AccountsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
            <AccountsContent />
        </Suspense>
    );
}
