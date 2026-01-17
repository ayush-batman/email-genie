import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { to, subject, body, emailId } = await request.json();

    if (!to || !subject || !body) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get Google integration tokens
    const { data: integration } = await supabase
        .from("integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", "google")
        .single();

    if (!integration?.access_token) {
        return NextResponse.json({
            error: "Google account not connected. Please connect in Settings → Integrations."
        }, { status: 400 });
    }

    // Check if token needs refresh
    let accessToken = integration.access_token;
    if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
        // Refresh the token
        try {
            const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                    refresh_token: integration.refresh_token,
                    grant_type: "refresh_token",
                }),
            });

            if (!tokenResponse.ok) {
                return NextResponse.json({ error: "Failed to refresh Google token" }, { status: 400 });
            }

            const tokens = await tokenResponse.json();
            accessToken = tokens.access_token;

            // Update stored token
            await supabase
                .from("integrations")
                .update({
                    access_token: tokens.access_token,
                    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                })
                .eq("id", integration.id);
        } catch {
            return NextResponse.json({ error: "Token refresh failed" }, { status: 500 });
        }
    }

    // Compose email in RFC 2822 format
    const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        body,
    ].join("\n");

    // Base64 encode for Gmail API
    const encodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    // Send via Gmail API
    try {
        const gmailResponse = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ raw: encodedEmail }),
            }
        );

        if (!gmailResponse.ok) {
            const error = await gmailResponse.json();
            console.error("Gmail API error:", error);
            return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
        }

        const result = await gmailResponse.json();

        // Update email status if emailId provided
        if (emailId) {
            await supabase
                .from("generated_emails")
                .update({ status: "sent", sent_at: new Date().toISOString() })
                .eq("id", emailId)
                .eq("user_id", user.id);
        }

        return NextResponse.json({
            success: true,
            messageId: result.id,
            message: "Email sent successfully"
        });
    } catch (error) {
        console.error("Send email error:", error);
        return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
}
