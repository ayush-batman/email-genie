/**
 * Emails API - Save generated emails
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: emails, error } = await supabase
        .from('generated_emails')
        .select(`
      *,
      meetings(title),
      contacts(name, company)
    `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ emails });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subject, body, meetingId, contactId, keyPoints, status } = await request.json();

    if (!subject || !body) {
        return NextResponse.json(
            { error: 'Subject and body are required' },
            { status: 400 }
        );
    }

    const { data: email, error } = await supabase
        .from('generated_emails')
        .insert({
            user_id: user.id,
            subject,
            body,
            meeting_id: meetingId || null,
            contact_id: contactId || null,
            key_points: keyPoints || [],
            status: status || 'draft',
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ email }, { status: 201 });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, subject, body, status } = await request.json();

    if (!id) {
        return NextResponse.json({ error: 'Email ID required' }, { status: 400 });
    }

    const { data: email, error } = await supabase
        .from('generated_emails')
        .update({
            subject,
            body,
            status,
            ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ email });
}

export async function DELETE(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();

    if (!id) {
        return NextResponse.json({ error: 'Email ID required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('generated_emails')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
