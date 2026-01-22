import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = 'llama-3.3-70b-versatile';

const BASE_SYSTEM_PROMPT = `You are a friendly and knowledgeable personal finance assistant for a user's finance tracking app called "SafeBalance". 

Your role is to:
1. Help users understand their financial situation based on their real data
2. Provide personalized advice on budgeting and spending habits
3. Suggest budget limits based on their spending patterns
4. Help them reach their savings goals faster
5. Answer questions about their transactions and accounts
6. Provide summaries and insights about their finances

Guidelines:
- Be concise and helpful - users are busy
- Use the actual data provided to give specific, actionable advice
- When suggesting budget limits, base them on actual spending history plus a reasonable buffer
- Celebrate wins (under budget, goal progress) and gently highlight areas needing attention
- Use emojis occasionally to be friendly but professional
- Currency is EUR (€)
- Format numbers as currency when discussing money
- If asked about something not in the data, explain what information you have access to

## ACTION CAPABILITIES
You can trigger specific actions in the app to help the user.
If a user asks to create a budget or a savings goal, OR if you suggest it and they agree, you can open the form for them.
To do this, append a specific tag at the VERY END of your response.

Supported Actions:
1. Open Budget Form:
   Tag: [[ACTION:open_budget_form:{"category":"<category_id>","amount":<number>}]]
   Example: "I've opened the budget form for Food with a suggested limit of €200."
   [[ACTION:open_budget_form:{"category":"food","amount":200}]]

2. Open Savings Goal Form:
   Tag: [[ACTION:open_goal_form:{"name":"<name>","target":<number>,"icon":"<emoji>"}]]
   Example: "Great idea! I've started a new goal for your Vacation."
   [[ACTION:open_goal_form:{"name":"Vacation","target":1000,"icon":"✈️"}]]

RULES FOR ACTIONS:
- CRITICAL: Only trigger an action if the user EXPLICITLY asks for it (e.g., "Create a budget", "Open the form") or EXPLICITLY confirms your suggestion (e.g., "Yes, do that").
- NEVER trigger an action just because you mentioned a topic. For example, if discussing "Food budgets", do NOT open the form unless the user says "Set a food budget".
- If the user asks general questions like "What is this?", DO NOT trigger any actions. Just explain.
- You can pre-fill data based on the conversation (e.g., if they say "set a budget of 500", pre-fill 500).
- Do not output the tag if you are just discussing, only when taking action.
- The tag must be the last thing in your message.
- ONLY ONE action per message. If multiple actions are needed, ask the user to confirm the first one, then the next.
`;

const VIEW_SPECIFIC_PROMPTS: Record<string, string> = {
    'Budgets': `
CURRENT CONTEXT: The user is currently looking at the "Budgets" page.
VISIBLE CONTENT:
- A list of their active budget categories (e.g., Food, Transport) with progress bars.
- Total budget vs. total spending summary.
- A button to "Add Budget".

IMPORTANT: If the user was previously discussing a different topic (like Goals or Insights), SWITCH FOCUS IMMEDIATELY to Budgets.
- Focus your advice on their current budget performance.
- IF they are over budget, suggest adjustments or explain why.
- IF they have no budgets, encourage them to create one for their top spending category.
- If they ask to "add a budget", use the action tool immediately.
`,
    'Savings Goals': `
CURRENT CONTEXT: The user is currently looking at the "Savings Goals" page.
VISIBLE CONTENT:
- A grid of their savings goals (e.g., Vacation, Emergency Fund) with progress circles.
- Total saved amount.
- A button to "Create Goal".

IMPORTANT: If the user was previously discussing a different topic, SWITCH FOCUS IMMEDIATELY to Goals.
- Focus on their progress towards goals.
- IF they are behind on a goal, suggest ways to catch up (e.g., "add €50 today").
- IF they have no goals, suggest creating an Emergency Fund or Vacation goal.
- If they ask to "create a goal", use the action tool immediately.
`,
    'Recurring': `
CURRENT CONTEXT: The user is currently looking at the "Recurring Transactions" page.
VISIBLE CONTENT:
- A list of detected recurring payments (subscriptions, bills).
- Monthly fixed cost summary.

IMPORTANT: If the user was previously discussing a different topic, SWITCH FOCUS IMMEDIATELY to Recurring Transactions.
- Help them identify subscriptions they might want to cancel.
- Sum up their monthly fixed costs.
`,
    'Insights': `
CURRENT CONTEXT: The user is currently looking at the "Insights / Spending Trajectory" page.
VISIBLE CONTENT:
- A SINGLE large line chart showing "Spending Trajectory".
- The chart compares "This Month" (cumulative spending) vs "Last Month" (gray line).
- A text summary stating if they are trending higher or lower than last month.
- NO other lists, NO budgets, NO goals are visible on this page.

IMPORTANT: If the user was previously discussing a different topic, SWITCH FOCUS IMMEDIATELY to Insights.
- EXPLAIN the Trajectory Chart. (e.g., "You are currently spending less than this time last month.")
- Highlight top spending categories that are increasing (movers) ONLY if relevant to the trajectory analysis.
- Do NOT list all budgets or goals. They are NOT visible here.
- If asked "What is this?", explain it is the Spending Trajectory tool.
- DO NOT trigger any actions (like opening forms) unless the user EXPLICITLY asks to "Create a budget" or "Add a goal". if they just ask about them, discuss textually.
`,
    'Dashboard': `
CURRENT CONTEXT: The user is on the Dashboard (Home).
VISIBLE CONTENT:
- High-level summary cards (Total Balance, Monthly Spending).
- A brief list of "Recent Transactions".
- A snippet of "Savings Goals".
- A "Receivables" summary card (money owed to user).
- A "Quick Actions" area.

IMPORTANT: If the user was previously discussing a different topic, SWITCH FOCUS IMMEDIATELY to the Dashboard overview.
- Give a high-level overview.
- If you see critical alerts (over budget, low balance), mention those first.
`,
    'Transactions': `
CURRENT CONTEXT: The user is looking at the Transactions list.
VISIBLE CONTENT:
- A standard list of all past income and expenses.
- Filters for Date, Category, and Type.

IMPORTANT: If the user was previously discussing a different topic, SWITCH FOCUS IMMEDIATELY to Transactions.
- Help them categorize uncategorized transactions.
- Spot unusual spending patterns in recent transactions.
`,
    'Accounts': `
CURRENT CONTEXT: The user is viewing their Accounts list.
VISIBLE CONTENT:
- A list of their distinct accounts (Bank, Cash, Savings).
- Debt accounts (Liabilities) and Receivables (money others owe them).

IMPORTANT: If the user was previously discussing a different topic, SWITCH FOCUS IMMEDIATELY to Accounts.
- Help them understand their net worth components.
- Discuss specific account balances.
`
};

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages, financialContext, currentView } = body as {
            messages: ChatMessage[];
            financialContext: string;
            currentView?: string;
        };

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: 'Messages array is required' },
                { status: 400 }
            );
        }

        // Determine system prompt additions based on view
        const viewPrompt = currentView && VIEW_SPECIFIC_PROMPTS[currentView]
            ? VIEW_SPECIFIC_PROMPTS[currentView]
            : '';

        // Build the messages array for Groq
        const groqMessages: ChatMessage[] = [
            {
                role: 'system',
                content: `${BASE_SYSTEM_PROMPT}\n\n${viewPrompt}\n\n### USER FINANCIAL DATA:\n${financialContext || 'No financial data available.'}`,
            },
            ...messages,
            // Critical: Append a final system instruction to force context switching
            {
                role: 'system',
                content: `SYSTEM ALERT: The user is currently viewing the "${currentView || 'General'}" page. If the previous conversation was about a different topic, DROP IT immediately and focus on ${currentView || 'General'}. Do not assume previous actions were completed successfully unless confirmed.`
            }
        ];

        // API Keys Strategy: Failover
        // 1. Try env variable primary key
        // 2. Try env variable backup key
        // 3. Try hardcoded backup (provided by user) - *Temporary/Dev fallback*
        const BACKUP_KEY_HARDCODED = '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';

        const apiKeys = [
            process.env.GROQ_API_KEY,
            process.env.GROQ_API_KEY_BACKUP,
            BACKUP_KEY_HARDCODED
        ].filter(Boolean) as string[];

        // Remove duplicates in case env backup matches hardcoded
        const uniqueKeys = [...new Set(apiKeys)];

        if (uniqueKeys.length === 0) {
            return NextResponse.json(
                { error: 'Groq API key not configured' },
                { status: 500 }
            );
        }

        let lastError: any = null;
        let lastStatus = 500;

        // Try keys in order
        for (const apiKey of uniqueKeys) {
            try {
                const response = await fetch(GROQ_API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: TEXT_MODEL,
                        messages: groqMessages,
                        temperature: 0.7,
                        max_tokens: 1024,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const content = data.choices?.[0]?.message?.content;

                    if (!content) {
                        throw new Error('No response content from AI');
                    }

                    return NextResponse.json({
                        message: content,
                        usage: data.usage,
                    });
                } else {
                    // If rate limited (429), try next key.
                    const errorText = await response.text();
                    console.warn(`Groq API error with key ending in ...${apiKey.slice(-4)}: ${response.status} - ${errorText}`);
                    lastStatus = response.status;
                    lastError = errorText;

                    if (response.status === 429) {
                        console.log('Rate limit hit, switching to backup key...');
                        continue;
                    }
                }
            } catch (error) {
                console.error(`Fetch error with key ending in ...${apiKey.slice(-4)}:`, error);
                lastError = error;
                continue;
            }
        }

        // If we exhausted all keys
        console.error('All Groq API keys failed.');
        return NextResponse.json(
            { error: 'Failed to get response from AI after trying all available keys.', details: lastError },
            { status: lastStatus }
        );

    } catch (error) {
        console.error('Chat API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
