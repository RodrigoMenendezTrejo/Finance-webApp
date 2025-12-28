'use client';

import { useState, useRef } from 'react';
import { Camera, Send, Loader2, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/firebase/auth-context';
import { createExpenseWithDebt, createTransaction } from '@/lib/firebase/transactions-service';
import { createAccount, getAccountsByType } from '@/lib/firebase/accounts-service';

interface AddTransactionSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'camera' | 'text';
}

export function AddTransactionSheet({
    open,
    onOpenChange,
    mode,
}: AddTransactionSheetProps) {
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [parsedResult, setParsedResult] = useState<Record<string, unknown> | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

            setParsedResult(result);
        } catch (error) {
            console.error('Error processing:', error);
            alert('Failed to process. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirm = async () => {
        if (!user || !parsedResult) return;

        setIsSaving(true);
        try {
            // Get user's default asset account (first one)
            const assetAccounts = await getAccountsByType(user.uid, 'asset');
            const sourceAccountId = assetAccounts[0]?.id;

            if (!sourceAccountId) {
                console.error('No source account found');
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

            // Create the transaction with debt tracking
            await createExpenseWithDebt(user.uid, {
                date: new Date(parsedResult.date as string || new Date()),
                payee: parsedResult.merchant as string,
                category: (parsedResult.category as string)?.toLowerCase() || 'other',
                notes: textInput || '',
                totalAmount: parsedResult.total as number,
                sourceAccountId,
                myShare: parsedResult.myShare as number,
                debtorAccountId,
                debtShare: debtShare ?? undefined,
            });

            setSaveSuccess(true);

            // Wait a moment to show success, then close
            setTimeout(() => {
                setTextInput('');
                setPreviewImage(null);
                setParsedResult(null);
                setSaveSuccess(false);
                onOpenChange(false);
            }, 1000);

        } catch (error) {
            console.error('Error saving transaction:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(value);
    };

    return (
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
                                capture="environment"
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

                    {/* Parsed result */}
                    {parsedResult && (
                        <div className="flex-1 flex flex-col gap-4">
                            <div className="p-4 rounded-xl bg-muted space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Merchant</span>
                                    <span className="font-medium">{parsedResult.merchant as string}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total</span>
                                    <span className="font-medium">{formatCurrency(parsedResult.total as number)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Category</span>
                                    <span className="font-medium">{parsedResult.category as string}</span>
                                </div>
                                {typeof parsedResult.debtorName === 'string' && parsedResult.debtorName && (
                                    <>
                                        <div className="border-t border-border my-2" />
                                        <div className="flex justify-between text-emerald-500">
                                            <span>{parsedResult.debtorName} owes you</span>
                                            <span className="font-bold">{formatCurrency(parsedResult.debtShare as number)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2 mt-auto">
                                <Button
                                    variant="outline"
                                    onClick={() => setParsedResult(null)}
                                    className="flex-1"
                                    disabled={isSaving}
                                >
                                    Edit
                                </Button>
                                <Button
                                    onClick={handleConfirm}
                                    className="flex-1"
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
    );
}
