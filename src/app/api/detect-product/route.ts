import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const SYSTEM_PROMPT = `You are a product category and price detection assistant. Analyze the image provided and identify what type of product or item it is, and estimate its price if visible or if you can reasonably estimate it.

Your task is to:
1. Identify the main product/item in the image
2. Categorize it into one of these common categories: Food & Dining, Groceries, Transport, Fuel/Gas, Entertainment, Shopping, Bills & Utilities, Health, Travel, Electronics, Clothing, Home, Sports, Personal Care, Gifts, Other
3. Detect or estimate the price if visible (look for price tags, receipts, etc.)

You MUST respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "category": "string - one of the predefined categories",
  "productName": "string - specific name or description of the product",
  "price": number or null - detected or estimated price in EUR (null if cannot determine),
  "confidence": number - 0.0 to 1.0 confidence score
}

Examples:
- Image of pizza → {"category": "Food & Dining", "productName": "Pizza", "price": 12.50, "confidence": 0.95}
- Image of gas pump showing €50 → {"category": "Fuel/Gas", "productName": "Gasoline", "price": 50, "confidence": 0.90}
- Image of groceries → {"category": "Groceries", "productName": "Grocery items", "price": 35, "confidence": 0.70}`;

interface DetectionResult {
    category: string;
    productName: string;
    price: number | null;
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

        if (!image) {
            return NextResponse.json(
                { error: 'Image is required' },
                { status: 400 }
            );
        }

        // Convert image to base64
        const bytes = await image.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');
        const mimeType = image.type || 'image/jpeg';

        const messages = [
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
                        text: 'Analyze this image and identify the product category.',
                    },
                ],
            },
        ];

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: VISION_MODEL,
                messages,
                temperature: 0.1,
                max_tokens: 256,
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
        let parsed: DetectionResult;
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
            category: parsed.category || 'Other',
            productName: parsed.productName || 'Unknown',
            price: parsed.price ? Number(parsed.price) : null,
            confidence: Number(parsed.confidence) || 0.8,
        };

        return NextResponse.json(result);
    } catch (error) {
        console.error('Detect product error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
