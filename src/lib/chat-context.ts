// Chat context builder for AI Finance Assistant
// Aggregates user financial data to provide context to the chatbot

import { getAccounts } from './firebase/accounts-service';
import { getTransactions, getSpendingByCategory, getMonthlySpendingHistory, getSpendingProjection } from './firebase/transactions-service';
import { getBudgetProgress } from './firebase/budget-service';
import { getGoals } from './firebase/goals-service';
import { getRecurringTransactions } from './firebase/recurring-service';
import { DEFAULT_CATEGORIES } from './categories';

export interface FinancialContext {
    summary: string;
    accounts: {
        assets: { name: string; balance: number }[];
        liabilities: { name: string; balance: number }[];
        receivables: { name: string; balance: number }[];
        totalAssets: number;
        totalLiabilities: number;
        totalReceivables: number;
        netWorth: number;
    };
    spending: {
        thisMonth: number;
        lastMonth: number;
        byCategory: { category: string; amount: number }[];
        averageMonthly: number;
        projection: {
            current: number;
            projected: number;
            lastMonthTotal: number;
            isOnTrack: boolean;
        };
    };
    budgets: {
        items: { category: string; limit: number; spent: number; percentUsed: number; isOverBudget: boolean }[];
        totalBudgeted: number;
        totalSpent: number;
        overBudgetCount: number;
    };
    goals: {
        items: { name: string; target: number; current: number; progress: number }[];
        totalTarget: number;
        totalSaved: number;
    };
    recurring: {
        expenses: { name: string; amount: number; frequency: string }[];
        income: { name: string; amount: number; frequency: string }[];
        monthlyExpenseTotal: number;
        monthlyIncomeTotal: number;
    };
    recentTransactions: {
        date: string;
        payee: string;
        amount: number;
        type: string;
        category: string;
    }[];
}

// Calculate monthly equivalent for recurring amounts
function toMonthlyAmount(amount: number, frequency: string): number {
    switch (frequency) {
        case 'daily': return amount * 30;
        case 'weekly': return amount * 4.33;
        case 'biweekly': return amount * 2.17;
        case 'monthly': return amount;
        case 'quarterly': return amount / 3;
        case 'yearly': return amount / 12;
        default: return amount;
    }
}

export async function buildFinancialContext(userId: string): Promise<FinancialContext> {
    // Fetch all data in parallel
    const [accounts, transactionsResult, budgetProgress, goals, recurring, projection] = await Promise.all([
        getAccounts(userId),
        getTransactions(userId, { limit: 20 }),
        getBudgetProgress(userId),
        getGoals(userId),
        getRecurringTransactions(userId),
        getSpendingProjection(userId),
    ]);

    // Calculate account totals
    const assets = accounts.filter(a => a.type === 'asset');
    const liabilities = accounts.filter(a => a.type === 'liability');
    const receivables = accounts.filter(a => a.type === 'receivable');

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalReceivables = receivables.reduce((sum, a) => sum + a.balance, 0);
    const netWorth = totalAssets + totalReceivables - totalLiabilities;

    // Get spending data
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonthSpending, lastMonthSpending, spendingHistory] = await Promise.all([
        getSpendingByCategory(userId, thisMonthStart, thisMonthEnd),
        getSpendingByCategory(userId, lastMonthStart, lastMonthEnd),
        getMonthlySpendingHistory(userId, 3),
    ]);

    const thisMonthTotal = Object.values(thisMonthSpending).reduce((sum, v) => sum + v, 0);
    const lastMonthTotal = Object.values(lastMonthSpending).reduce((sum, v) => sum + v, 0);
    const averageMonthly = spendingHistory.length > 0
        ? spendingHistory.reduce((sum, v) => sum + v, 0) / spendingHistory.length
        : 0;

    // Format spending by category
    const spendingByCategory = Object.entries(thisMonthSpending)
        .map(([catId, amount]) => ({
            category: DEFAULT_CATEGORIES.find(c => c.id === catId)?.name || catId,
            amount,
        }))
        .sort((a, b) => b.amount - a.amount);

    // Format budget progress
    const budgetItems = budgetProgress.map(bp => ({
        category: DEFAULT_CATEGORIES.find(c => c.id === bp.budget.categoryId)?.name || bp.budget.categoryId,
        limit: bp.budget.amount,
        spent: bp.spent,
        percentUsed: bp.percentUsed,
        isOverBudget: bp.isOverBudget,
    }));

    // Format goals
    const goalItems = goals.map(g => ({
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        progress: g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0,
    }));

    // Format recurring transactions (subscription and bill are expense types)
    const recurringExpenses = recurring
        .filter(r => r.type === 'subscription' || r.type === 'bill')
        .map(r => ({
            name: r.name,
            amount: r.amount,
            frequency: r.frequency,
        }));

    const recurringIncome = recurring
        .filter(r => r.type === 'income')
        .map(r => ({
            name: r.name,
            amount: r.amount,
            frequency: r.frequency,
        }));

    const monthlyExpenseTotal = recurringExpenses.reduce(
        (sum, r) => sum + toMonthlyAmount(r.amount, r.frequency), 0
    );
    const monthlyIncomeTotal = recurringIncome.reduce(
        (sum, r) => sum + toMonthlyAmount(r.amount, r.frequency), 0
    );

    // Format recent transactions
    const recentTransactions = transactionsResult.transactions.slice(0, 10).map(t => ({
        date: t.date.toDate().toLocaleDateString('en-US'),
        payee: t.payee,
        amount: t.amount,
        type: t.type,
        category: t.category,
    }));

    // Build summary
    const summary = `
User Financial Summary:
- Net Worth: €${netWorth.toFixed(2)} (Assets: €${totalAssets.toFixed(2)}, Liabilities: €${totalLiabilities.toFixed(2)}, Receivables: €${totalReceivables.toFixed(2)})
- This Month's Spending: €${thisMonthTotal.toFixed(2)} (Last month: €${lastMonthTotal.toFixed(2)}, Average: €${averageMonthly.toFixed(2)})
- Budgets: ${budgetProgress.length} categories tracked, ${budgetProgress.filter(b => b.isOverBudget).length} over budget
- Goals: ${goals.length} savings goals, €${goalItems.reduce((s, g) => s + g.current, 0).toFixed(2)} saved of €${goalItems.reduce((s, g) => s + g.target, 0).toFixed(2)} target
- Recurring: €${monthlyIncomeTotal.toFixed(2)}/month income, €${monthlyExpenseTotal.toFixed(2)}/month expenses
    `.trim();

    return {
        summary,
        accounts: {
            assets: assets.map(a => ({ name: a.name, balance: a.balance })),
            liabilities: liabilities.map(a => ({ name: a.name, balance: a.balance })),
            receivables: receivables.map(a => ({ name: a.name, balance: a.balance })),
            totalAssets,
            totalLiabilities,
            totalReceivables,
            netWorth,
        },
        spending: {
            thisMonth: thisMonthTotal,
            lastMonth: lastMonthTotal,
            byCategory: spendingByCategory,
            averageMonthly,
            projection: {
                current: projection.currentSpending,
                projected: projection.projectedTotal,
                lastMonthTotal: projection.lastMonthTotal,
                isOnTrack: projection.isOnTrack,
            },
        },
        budgets: {
            items: budgetItems,
            totalBudgeted: budgetProgress.reduce((s, b) => s + b.budget.amount, 0),
            totalSpent: budgetProgress.reduce((s, b) => s + b.spent, 0),
            overBudgetCount: budgetProgress.filter(b => b.isOverBudget).length,
        },
        goals: {
            items: goalItems,
            totalTarget: goalItems.reduce((s, g) => s + g.target, 0),
            totalSaved: goalItems.reduce((s, g) => s + g.current, 0),
        },
        recurring: {
            expenses: recurringExpenses,
            income: recurringIncome,
            monthlyExpenseTotal,
            monthlyIncomeTotal,
        },
        recentTransactions,
    };
}

// Format context for the AI system prompt
export function formatContextForAI(context: FinancialContext): string {
    return `
### USER'S FINANCIAL DATA (as of ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}):

${context.summary}

### ACCOUNTS:
${context.accounts.assets.map(a => `- ${a.name}: €${a.balance.toFixed(2)}`).join('\n')}
${context.accounts.liabilities.length > 0 ? '\nLiabilities:\n' + context.accounts.liabilities.map(a => `- ${a.name}: €${a.balance.toFixed(2)}`).join('\n') : ''}
${context.accounts.receivables.length > 0 ? '\nReceivables (money owed to user):\n' + context.accounts.receivables.map(a => `- ${a.name}: €${a.balance.toFixed(2)}`).join('\n') : ''}

### SPENDING THIS MONTH:
${context.spending.byCategory.map(c => `- ${c.category}: €${c.amount.toFixed(2)}`).join('\n') || 'No spending recorded this month.'}

### SPENDING PROJECTION (End of Month):
- Current Spending (Day ${new Date().getDate()}): €${context.spending.projection.current.toFixed(2)}
- Projected Total: €${context.spending.projection.projected.toFixed(2)} (Last Month Total: €${context.spending.projection.lastMonthTotal.toFixed(2)})
- Status: ${context.spending.projection.isOnTrack ? '✅ On track to spend less than last month' : '⚠️ Projected to spend MORE than last month'}

### BUDGET STATUS:
${context.budgets.items.length > 0
            ? context.budgets.items.map(b => `- ${b.category}: €${b.spent.toFixed(2)} / €${b.limit.toFixed(2)} (${b.percentUsed.toFixed(0)}%)${b.isOverBudget ? ' ⚠️ OVER BUDGET' : ''}`).join('\n')
            : 'No budgets set.'}

### SAVINGS GOALS:
${context.goals.items.length > 0
            ? context.goals.items.map(g => `- ${g.name}: €${g.current.toFixed(2)} / €${g.target.toFixed(2)} (${g.progress.toFixed(0)}%)`).join('\n')
            : 'No savings goals set.'}

### RECURRING TRANSACTIONS:
Income (monthly equivalent): €${context.recurring.monthlyIncomeTotal.toFixed(2)}
Expenses (monthly equivalent): €${context.recurring.monthlyExpenseTotal.toFixed(2)}
Net recurring: €${(context.recurring.monthlyIncomeTotal - context.recurring.monthlyExpenseTotal).toFixed(2)}/month

### RECENT TRANSACTIONS:
${context.recentTransactions.map(t => `- ${t.date}: ${t.payee} - €${t.amount.toFixed(2)} (${t.type}, ${t.category})`).join('\n') || 'No recent transactions.'}
    `.trim();
}
