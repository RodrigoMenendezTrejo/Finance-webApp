import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const TEXT_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are a JSON accounting assistant. Analyse the image or text provided by the user.

Your task is to identify the following from receipts, invoices, or natural language descriptions:
- Merchant/Payee name
- Date of transaction
- Total amount
- Category (use common categories like: Food & Dining, Groceries, Transport, Entertainment, Shopping, Bills & Utilities, Health, Travel, Subscriptions, Education, Personal Care, Gifts, Income, Transfer, Other)

CRITICAL: DETECT DEBT CONTEXT
If the user mentions shared expenses or that someone owes them money, you must:
1. Calculate the user's share (my_share)
2. Calculate what others owe (debt_share)
3. Identify the debtor's name (debtor_name)

Examples of debt context:
- "Paid €50 for dinner, Juan owes me €25" → my_share: 25, debt_share: 25, debtor_name: "Juan"
- "Split dinner with María, total €60" → my_share: 30, debt_share: 30, debtor_name: "María"
- "I paid for the movie tickets, €40 for me and Carlos" → my_share: 20, debt_share: 20, debtor_name: "Carlos"

You MUST respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "merchant": "string - name of the business or person",
  "date": "string - ISO 8601 date format (YYYY-MM-DD)",
  "total": number - total amount of the transaction,
  "my_share": number - the amount the user is actually paying (equals total if no split),
  "debt_share": number or null - amount someone owes the user (null if no debt),
  "debtor_name": "string or null - name of person who owes money (null if no debt)",
  "category": "string - one of the predefined categories",
  "confidence": number - 0.0 to 1.0 confidence score
}`;

interface ParsedReceipt {
    merchant: string;
    date: string;
    total: number;
    my_share: number;
    debt_share: number | null;
    debtor_name: string | null;
    category: string;
    confidence: number;
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

        const formData = await request.formData();
        const image = formData.get('image') as File | null;
        const text = formData.get('text') as string | null;

        if (!image && !text) {
            return NextResponse.json(
                { error: 'Either image or text is required' },
                { status: 400 }
            );
        }

        let messages: Array<{
            role: string;
            content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
        }>;
        let model: string;

        if (image) {
            // Convert image to base64
            const bytes = await image.arrayBuffer();
            const base64 = Buffer.from(bytes).toString('base64');
            const mimeType = image.type || 'image/jpeg';

            model = VISION_MODEL;
            messages = [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64}`,
                            },
                        },
                        {
                            type: 'text',
                            text: 'Analyze this receipt image and extract the transaction details.',
                        },
                    ],
                },
            ];
        } else {
            model = TEXT_MODEL;
            messages = [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Parse this transaction description: "${text}"`,
                },
            ];
        }

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.1,
                max_tokens: 1024,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Groq API error:', error);
            return NextResponse.json(
                { error: 'Failed to process with AI' },
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

        // Parse the JSON response
        let parsed: ParsedReceipt;
        try {
            // Remove any markdown code blocks if present
            const cleanContent = content
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            parsed = JSON.parse(cleanContent);
        } catch {
            console.error('Failed to parse AI response:', content);
            return NextResponse.json(
                { error: 'Invalid AI response format', raw: content },
                { status: 500 }
            );
        }

        // Normalize the response
        const result = {
            merchant: parsed.merchant || 'Unknown',
            date: parsed.date || new Date().toISOString().split('T')[0],
            total: Number(parsed.total) || 0,
            myShare: Number(parsed.my_share) || Number(parsed.total) || 0,
            debtShare: parsed.debt_share ? Number(parsed.debt_share) : null,
            debtorName: parsed.debtor_name || null,
            category: parsed.category || 'Other',
            confidence: Number(parsed.confidence) || 0.8,
        };

        return NextResponse.json(result);
    } catch (error) {
        console.error('Parse receipt error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
