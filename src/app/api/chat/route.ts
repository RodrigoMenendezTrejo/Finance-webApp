import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are a friendly and knowledgeable personal finance assistant for a user's finance tracking app called "Sovereign Finance". 

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

Remember: You have access to their accounts, transactions, budgets, goals, and recurring payments. Reference specific data points in your responses.`;

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Groq API key not configured' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { messages, financialContext } = body as {
            messages: ChatMessage[];
            financialContext: string;
        };

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: 'Messages array is required' },
                { status: 400 }
            );
        }

        // Build the messages array for Groq
        const groqMessages: ChatMessage[] = [
            {
                role: 'system',
                content: `${SYSTEM_PROMPT}\n\n${financialContext || 'No financial data available.'}`,
            },
            ...messages,
        ];

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

        if (!response.ok) {
            const error = await response.text();
            console.error('Groq API error:', error);
            return NextResponse.json(
                { error: 'Failed to get response from AI' },
                { status: response.status }
            );
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return NextResponse.json(
                { error: 'No response from AI' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: content,
            usage: data.usage,
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
