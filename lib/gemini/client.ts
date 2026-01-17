import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface EmailGenerationInput {
    transcript: string;
    contactName?: string;
    contactEmail?: string;
    contactCompany?: string;
    meetingTitle?: string;
    tone?: 'professional' | 'friendly' | 'casual';
    additionalContext?: string;
}

export interface GeneratedEmail {
    subject: string;
    body: string;
    keyPoints: string[];
    suggestedFollowUpDate?: string;
}

export async function generateFollowUpEmail(
    input: EmailGenerationInput
): Promise<GeneratedEmail> {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an expert sales professional who writes compelling follow-up emails after meetings.

Based on the following meeting transcript, generate a professional follow-up email.

MEETING DETAILS:
${input.meetingTitle ? `Meeting Title: ${input.meetingTitle}` : ''}
${input.contactName ? `Contact Name: ${input.contactName}` : ''}
${input.contactCompany ? `Company: ${input.contactCompany}` : ''}
Tone: ${input.tone || 'professional'}
${input.additionalContext ? `Additional Context: ${input.additionalContext}` : ''}

TRANSCRIPT:
${input.transcript}

Generate a follow-up email with the following requirements:
1. Reference specific points discussed in the meeting
2. Include any action items or next steps mentioned
3. Be concise but warm and personable
4. Include a clear call-to-action

Respond in the following JSON format ONLY (no markdown, no code blocks):
{
  "subject": "Email subject line",
  "body": "Full email body with proper formatting using \\n for line breaks",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "suggestedFollowUpDate": "Suggested date for next follow-up if applicable"
}`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse the JSON response
        const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedText);

        return {
            subject: parsed.subject || 'Follow-up from our meeting',
            body: parsed.body || '',
            keyPoints: parsed.keyPoints || [],
            suggestedFollowUpDate: parsed.suggestedFollowUpDate,
        };
    } catch (error) {
        console.error('Error generating email:', error);
        throw new Error('Failed to generate follow-up email. Please try again.');
    }
}

export async function summarizeMeeting(transcript: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Summarize the following meeting transcript in 2-3 paragraphs. 
Focus on:
- Main topics discussed
- Key decisions made
- Action items and next steps

TRANSCRIPT:
${transcript}

Provide a clear, professional summary:`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error summarizing meeting:', error);
        throw new Error('Failed to summarize meeting. Please try again.');
    }
}
