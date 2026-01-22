'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Define the types of actions we can trigger
interface ChatActions {
    openBudgetForm: (prefillData?: any) => void;
    openGoalForm: (prefillData?: any) => void;
    openTransactionForm: (prefillData?: any) => void;

    // State to track if these modals should be open
    isBudgetFormOpen: boolean;
    isGoalFormOpen: boolean;
    isTransactionFormOpen: boolean;

    // Methods to close them (used by the components themselves)
    closeBudgetForm: () => void;
    closeGoalForm: () => void;
    closeTransactionForm: () => void;

    // Prefill data access
    budgetPrefill: any;
    goalPrefill: any;
    transactionPrefill: any;
}

const ChatActionContext = createContext<ChatActions | undefined>(undefined);

export function useChatActions() {
    const context = useContext(ChatActionContext);
    if (!context) {
        throw new Error('useChatActions must be used within a ChatActionProvider');
    }
    return context;
}

export function ChatActionProvider({ children }: { children: ReactNode }) {
    const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);
    const [budgetPrefill, setBudgetPrefill] = useState<any>(null);

    const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
    const [goalPrefill, setGoalPrefill] = useState<any>(null);

    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
    const [transactionPrefill, setTransactionPrefill] = useState<any>(null);

    const openBudgetForm = useCallback((data?: any) => {
        if (data) setBudgetPrefill(data);
        setIsBudgetFormOpen(true);
    }, []);

    const closeBudgetForm = useCallback(() => {
        setIsBudgetFormOpen(false);
        setBudgetPrefill(null);
    }, []);

    const openGoalForm = useCallback((data?: any) => {
        if (data) setGoalPrefill(data);
        setIsGoalFormOpen(true);
    }, []);

    const closeGoalForm = useCallback(() => {
        setIsGoalFormOpen(false);
        setGoalPrefill(null);
    }, []);

    const openTransactionForm = useCallback((data?: any) => {
        if (data) setTransactionPrefill(data);
        setIsTransactionFormOpen(true);
        // Note: You might need to coordinate this with existing transaction sheet logic
    }, []);

    const closeTransactionForm = useCallback(() => {
        setIsTransactionFormOpen(false);
        setTransactionPrefill(null);
    }, []);

    const value = {
        openBudgetForm,
        openGoalForm,
        openTransactionForm,
        isBudgetFormOpen,
        isGoalFormOpen,
        isTransactionFormOpen,
        closeBudgetForm,
        closeGoalForm,
        closeTransactionForm,
        budgetPrefill,
        goalPrefill,
        transactionPrefill,
    };

    return (
        <ChatActionContext.Provider value={value}>
            {children}
        </ChatActionContext.Provider>
    );
}
