'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Send, Loader2, Check, Wallet, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/firebase/auth-context';
import { createExpenseWithDebt, createTransaction } from '@/lib/firebase/transactions-service';
import { createAccount, getAccountsByType, getAccounts } from '@/lib/firebase/accounts-service';
import { AllocationSuggestSheet } from './allocation-suggest-sheet';
import { findBestCategory, getCategoryById } from '@/lib/categories';
import { Account } from '@/types/firestore';

interface AddTransactionSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'camera' | 'text';
    onSuccess?: () => void;
}

export function AddTransactionSheet({
    open,
    onOpenChange,
    mode,
    onSuccess,
}: AddTransactionSheetProps) {
    const { user, userProfile } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [parsedResult, setParsedResult] = useState<Record<string, unknown> | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Allocation Sheet State
    const [showAllocation, setShowAllocation] = useState(false);
    const [allocationData, setAllocationData] = useState<{ amount: number; sourceId: string } | null>(null);

    // Editable parsed fields
    const [editMerchant, setEditMerchant] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
    const [categoryError, setCategoryError] = useState(false);

    // Account selection state
    const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

    // Fetch accounts when sheet opens
    useEffect(() => {
        async function fetchAccounts() {
            if (!user || !open) return;
            try {
                const accounts = await getAccounts(user.uid);
                // Filter to only asset accounts (bank, cash, etc.)
                const assetAccounts = accounts.filter(a => a.type === 'asset');
                setAvailableAccounts(assetAccounts);
                // Default to first account if not already selected
                if (assetAccounts.length > 0 && !selectedAccountId) {
                    setSelectedAccountId(assetAccounts[0].id);
                }
            } catch (error) {
                console.error('Error fetching accounts:', error);
            }
        }
        fetchAccounts();
    }, [user, open]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setPreviewImage(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        setIsProcessing(true);

        try {
            const formData = new FormData();

            if (mode === 'camera' && previewImage) {
                const response = await fetch(previewImage);
                const blob = await response.blob();
                formData.append('image', blob, 'receipt.jpg');
            } else if (mode === 'text' && textInput) {
                formData.append('text', textInput);
            }

            const res = await fetch('/api/parse-receipt', {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();

            if (!res.ok) {
                console.error('API error:', result);
                alert(`Failed to process: ${result.error || 'Unknown error'}`);
                return;
            }

            // Populate editable fields from parsed result
            setEditMerchant(result.merchant || '');
            setEditAmount(String(result.total || ''));
            setEditDate(result.date || new Date().toISOString().split('T')[0]);
            setEditCategory(result.category || '');
            setCategoryError(false);

            // Detect if it's income based on keywords
            const textLower = textInput.toLowerCase();
            const isIncome = textLower.includes('received') ||
                textLower.includes('income') ||
                textLower.includes('salary') ||
                textLower.includes('paid me') ||
                textLower.includes('bizum');
            setTransactionType(isIncome ? 'income' : 'expense');

            setParsedResult(result);
        } catch (error) {
            console.error('Error processing:', error);
            alert('Failed to process. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirm = async () => {
        if (!user || !parsedResult || isSaving) return;

        // Validate category
        if (!editCategory.trim()) {
            setCategoryError(true);
            return;
        }
        setCategoryError(false);

        const amount = parseFloat(editAmount) || 0;
        if (amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        setIsSaving(true);
        try {
            // Use selected account or fallback to first asset account
            let sourceAccountId = selectedAccountId;
            if (!sourceAccountId) {
                const assetAccounts = await getAccountsByType(user.uid, 'asset');
                sourceAccountId = assetAccounts[0]?.id;
            }

            if (!sourceAccountId) {
                console.error('No source account found');
                alert('Please select an account');
                setIsSaving(false);
                return;
            }

            const debtorName = parsedResult.debtorName as string | null;
            const debtShare = parsedResult.debtShare as number | null;

            // If there's a debtor, create or find their receivable account
            let debtorAccountId: string | undefined;
            if (debtorName && debtShare && debtShare > 0) {
                const receivables = await getAccountsByType(user.uid, 'receivable');
                const existingDebtor = receivables.find(
                    a => a.name.toLowerCase() === debtorName.toLowerCase()
                );

                if (existingDebtor) {
                    debtorAccountId = existingDebtor.id;
                } else {
                    // Create new receivable account for this person
                    debtorAccountId = await createAccount(user.uid, {
                        name: debtorName,
                        type: 'receivable',
                        balance: 0,
                        icon: '👤',
                    });
                }
            }

            // Get a valid date (fallback to now if invalid)
            const getValidDate = () => {
                if (!editDate) return new Date();
                const parsed = new Date(editDate);
                return isNaN(parsed.getTime()) ? new Date() : parsed;
            };
            const transactionDate = getValidDate();

            // Normalize category to ID (e.g., 'Food & Dining' -> 'food')
            const categoryId = findBestCategory(editCategory).id;

            if (transactionType === 'income') {
                // Create income transaction (adds to account)
                await createTransaction(user.uid, {
                    date: transactionDate,
                    payee: editMerchant || 'Income',
                    category: categoryId,
                    notes: textInput || '',
                    amount: amount,
                    type: 'income',
                    splits: [
                        { accountId: sourceAccountId, amount: amount },
                    ],
                });
            } else {
                // Create expense transaction with debt tracking
                await createExpenseWithDebt(user.uid, {
                    date: transactionDate,
                    payee: editMerchant || 'Unknown',
                    category: categoryId,
                    notes: textInput || '',
                    totalAmount: amount,
                    sourceAccountId,
                    myShare: amount - (debtShare ?? 0),
                    debtorAccountId,
                    debtShare: debtShare ?? undefined,
                });
            }

            setSaveSuccess(true);

            // Close normally after success
            setTimeout(() => {
                cleanupAndClose();
            }, 1500);

        } catch (error) {
            console.error('Error saving transaction:', error);
            alert('Failed to save transaction');
        } finally {
            setIsSaving(false);
        }
    };

    const cleanupAndClose = () => {
        setTextInput('');
        setPreviewImage(null);
        setParsedResult(null);
        setSaveSuccess(false);
        setEditMerchant('');
        setEditAmount('');
        setEditDate('');
        setEditCategory('');
        setTransactionType('expense');
        setCategoryError(false);
        onSuccess?.();
        onOpenChange(false);
    };

    const handleAllocationClose = (open: boolean) => {
        setShowAllocation(open);
        if (!open) {
            cleanupAndClose();
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(value);
    };

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
                    <SheetHeader className="pb-4">
                        <SheetTitle>
                            {mode === 'camera' ? 'Scan Receipt' : 'Add Transaction'}
                        </SheetTitle>
                    </SheetHeader>

                    <div className="flex flex-col gap-4 h-full pb-8">
                        {/* Camera mode */}
                        {mode === 'camera' && !parsedResult && (
                            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                                {previewImage ? (
                                    <div className="relative rounded-xl overflow-hidden bg-muted max-h-[50vh]">
                                        <img
                                            src={previewImage}
                                            alt="Receipt preview"
                                            className="w-full h-full object-contain max-h-[50vh]"
                                        />
                                        <button
                                            onClick={() => setPreviewImage(null)}
                                            className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors min-h-[200px]"
                                    >
                                        <Camera className="w-12 h-12 text-muted-foreground" />
                                        <span className="text-muted-foreground">Tap to capture receipt</span>
                                    </button>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                {previewImage && (
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isProcessing}
                                        className="w-full"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            'Analyze Receipt'
                                        )}
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Text mode */}
                        {mode === 'text' && !parsedResult && (
                            <div className="flex-1 flex flex-col gap-4">
                                <div className="flex-1 flex flex-col gap-2">
                                    <p className="text-sm text-muted-foreground">
                                        Describe your transaction naturally, for example:
                                    </p>
                                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                                        <li>&quot;Dinner at Burger King, €15&quot;</li>
                                        <li>&quot;Paid €50 for dinner, Juan owes me €25&quot;</li>
                                        <li>&quot;Received €100 salary&quot;</li>
                                    </ul>
                                    <div className="flex-1 relative mt-4">
                                        <textarea
                                            value={textInput}
                                            onChange={(e) => setTextInput(e.target.value)}
                                            placeholder="Type your transaction..."
                                            className="w-full h-full min-h-[120px] p-4 rounded-xl bg-muted border-0 resize-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isProcessing || !textInput.trim()}
                                    className="w-full"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Process
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Parsed result - EDITABLE */}
                        {parsedResult && (
                            <div className="flex-1 flex flex-col gap-4 overflow-auto">
                                {/* Income/Expense Toggle */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setTransactionType('expense')}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${transactionType === 'expense'
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                            }`}
                                    >
                                        Expense
                                    </button>
                                    <button
                                        onClick={() => setTransactionType('income')}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${transactionType === 'income'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                            }`}
                                    >
                                        Income
                                    </button>
                                </div>

                                {/* Editable Fields */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm text-muted-foreground mb-1 block">
                                            {transactionType === 'income' ? 'From (optional)' : 'Merchant (optional)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={editMerchant}
                                            onChange={(e) => setEditMerchant(e.target.value)}
                                            placeholder={transactionType === 'income' ? 'e.g., Bizum, Salary' : 'e.g., Burger King'}
                                            className="w-full p-3 rounded-xl bg-muted border-0 focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm text-muted-foreground mb-1 block">Date</label>
                                        <input
                                            type="date"
                                            value={editDate}
                                            onChange={(e) => setEditDate(e.target.value)}
                                            className="w-full p-3 rounded-xl bg-muted border-0 focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm text-muted-foreground mb-1 block">Amount (€)</label>
                                        <input
                                            type="number"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full p-3 rounded-xl bg-muted border-0 focus:ring-2 focus:ring-primary text-lg font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm text-muted-foreground mb-1 block">
                                            Category <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={editCategory}
                                            onChange={(e) => {
                                                setEditCategory(e.target.value);
                                                if (e.target.value.trim()) setCategoryError(false);
                                            }}
                                            placeholder="e.g., Food, Transport, Income"
                                            className={`w-full p-3 rounded-xl bg-muted border-2 focus:ring-2 focus:ring-primary ${categoryError ? 'border-rose-500' : 'border-transparent'
                                                }`}
                                        />
                                        {categoryError && (
                                            <p className="text-rose-500 text-sm mt-1">Please select a category</p>
                                        )}
                                    </div>

                                    {/* Account Selector */}
                                    <div>
                                        <label className="text-sm text-muted-foreground mb-1 block">
                                            Account <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                                                className="w-full p-3 rounded-xl bg-muted border-0 focus:ring-2 focus:ring-primary flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Wallet className="w-5 h-5 text-muted-foreground" />
                                                    <span>
                                                        {availableAccounts.find(a => a.id === selectedAccountId)?.name || 'Select Account'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-muted-foreground">
                                                        {availableAccounts.find(a => a.id === selectedAccountId)?.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) || ''}
                                                    </span>
                                                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isAccountDropdownOpen ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>

                                            {isAccountDropdownOpen && (
                                                <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                                                    {availableAccounts.map((account) => (
                                                        <button
                                                            key={account.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedAccountId(account.id);
                                                                setIsAccountDropdownOpen(false);
                                                            }}
                                                            className={`w-full p-3 flex items-center justify-between hover:bg-muted transition-colors ${selectedAccountId === account.id ? 'bg-primary/10' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-lg">{account.icon}</span>
                                                                <span className="font-medium">{account.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm text-muted-foreground">
                                                                    {account.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                                </span>
                                                                {selectedAccountId === account.id && (
                                                                    <Check className="w-4 h-4 text-primary" />
                                                                )}
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {availableAccounts.length === 0 && (
                                                        <div className="p-3 text-center text-muted-foreground">
                                                            No accounts available
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Debtor info (if any) */}
                                {typeof parsedResult.debtorName === 'string' && parsedResult.debtorName && (
                                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                                        <div className="flex justify-between text-emerald-500">
                                            <span>{parsedResult.debtorName} owes you</span>
                                            <span className="font-bold">{formatCurrency(parsedResult.debtShare as number)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2 mt-auto">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setParsedResult(null);
                                            setEditMerchant('');
                                            setEditAmount('');
                                            setEditDate('');
                                            setEditCategory('');
                                            setCategoryError(false);
                                        }}
                                        className="flex-1"
                                        disabled={isSaving}
                                    >
                                        Start Over
                                    </Button>
                                    <Button
                                        onClick={handleConfirm}
                                        className={`flex-1 ${transactionType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                                        disabled={isSaving || saveSuccess}
                                    >
                                        {saveSuccess ? (
                                            <>
                                                <Check className="w-4 h-4 mr-2" />
                                                Saved!
                                            </>
                                        ) : isSaving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Confirm'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Allocation Sheet - must be outside parent Sheet */}
            {user && allocationData && (
                <AllocationSuggestSheet
                    open={showAllocation}
                    onOpenChange={handleAllocationClose}
                    userId={user.uid}
                    incomeAmount={allocationData.amount}
                    sourceAccountId={allocationData.sourceId}
                    onComplete={() => { /* Handled by onOpenChange(false) which calls cleanupAndClose */ }}
                />
            )}
        </>
    );
}
