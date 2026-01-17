import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFollowUpEmail } from "@/lib/gemini/client";

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get request body
        const body = await request.json();
        const { transcript, contactName, contactCompany, meetingTitle, tone } =
            body;

        if (!transcript || transcript.trim().length === 0) {
            return NextResponse.json(
                { error: "Transcript is required" },
                { status: 400 }
            );
        }

        // Generate email using Gemini
        const email = await generateFollowUpEmail({
            transcript,
            contactName,
            contactCompany,
            meetingTitle,
            tone: tone || "professional",
        });

        return NextResponse.json(email);
    } catch (error) {
        console.error("Error generating email:", error);
        return NextResponse.json(
            { error: "Failed to generate email" },
            { status: 500 }
        );
    }
}
