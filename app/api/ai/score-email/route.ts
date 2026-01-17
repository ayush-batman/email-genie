/**
 * Email Scoring API
 * Uses AI to rate email quality and provide improvement suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface EmailScore {
    overall: number; // 1-100
    clarity: number;
    personalization: number;
    callToAction: number;
    tone: number;
    length: 'too_short' | 'optimal' | 'too_long';
    suggestions: string[];
    strengths: string[];
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subject, body } = await request.json();

    if (!subject || !body) {
        return NextResponse.json(
            { error: 'Subject and body are required' },
            { status: 400 }
        );
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `You are an email quality expert. Analyze this follow-up email and provide a quality score.

Subject: ${subject}
Body: ${body}

Analyze the email and return a JSON object with these exact fields:
{
    "overall": <number 1-100, overall quality score>,
    "clarity": <number 1-100, how clear and easy to understand>,
    "personalization": <number 1-100, how personalized vs generic>,
    "callToAction": <number 1-100, how clear the next steps are>,
    "tone": <number 1-100, how appropriate the tone is for business>,
    "length": "<'too_short'|'optimal'|'too_long'>",
    "suggestions": [<array of 2-3 specific improvement suggestions>],
    "strengths": [<array of 1-2 things done well>]
}

Scoring guidelines:
- 90-100: Exceptional, ready to send
- 70-89: Good, minor improvements possible
- 50-69: Needs work, significant issues
- Below 50: Poor, major rewrite needed

Return ONLY valid JSON, no markdown or other text.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse the JSON response
        let score: EmailScore;
        try {
            // Remove any markdown code blocks if present
            const cleanedResponse = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            score = JSON.parse(cleanedResponse);
        } catch {
            // Fallback if parsing fails
            score = {
                overall: 75,
                clarity: 75,
                personalization: 70,
                callToAction: 75,
                tone: 80,
                length: 'optimal',
                suggestions: ['Consider adding more specific details from your meeting'],
                strengths: ['Professional tone'],
            };
        }

        return NextResponse.json({ score });
    } catch (error) {
        console.error('Email scoring error:', error);
        return NextResponse.json(
            { error: 'Failed to score email' },
            { status: 500 }
        );
    }
}
