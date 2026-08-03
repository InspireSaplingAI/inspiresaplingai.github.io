import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { createClient } from '../../../lib/supabase-server'
import { Resend } from 'resend'

export const prerender = false

export const POST: APIRoute = async (context) => {
    const supabase = createClient(context)
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    let slug: string
    try {
        const body = await context.request.json()
        slug = body?.slug
    } catch {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    if (!slug || typeof slug !== 'string') {
        return new Response(JSON.stringify({ error: 'missing_slug' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    // Check for an active (non-cancelled) registration
    const { data: existing } = await supabase
        .from('event_registrations')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('event_slug', slug)
        .maybeSingle()

    if (existing?.status === 'confirmed') {
        return new Response(JSON.stringify({ error: 'already_registered' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    // Upsert — handles both new registrations and re-registrations after cancel
    const { error: upsertError } = await supabase
        .from('event_registrations')
        .upsert(
            { user_id: user.id, event_slug: slug, status: 'confirmed' },
            { onConflict: 'user_id,event_slug' }
        )

    if (upsertError) {
        return new Response(JSON.stringify({ error: 'registration_failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    // Send confirmation email (non-fatal if it fails)
    const resendKey = import.meta.env.RESEND_API_KEY
    if (resendKey && user.email) {
        try {
            const allEvents = await getCollection('events')
            const eventEntry = allEvents.find((e) => e.id === slug)

            if (eventEntry) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name')
                    .eq('id', user.id)
                    .single()

                const userName = profile?.name ?? user.email.split('@')[0]
                const event = eventEntry.data

                const lines = [
                    `Hi ${userName},`,
                    '',
                    `You're confirmed for: ${event.title}`,
                    `Date: ${event.date}${event.time ? ` at ${event.time}` : ''}`,
                ]
                if (event.location) lines.push(`Location: ${event.location}`)
                lines.push('', "We'll send a reminder 24 hours before the event.", '', '— InspireSaplingAI Team')

                const resend = new Resend(resendKey)
                await resend.emails.send({
                    from: 'InspireSaplingAI <noreply@inspiresaplingai.org>',
                    to: user.email,
                    subject: `You're registered for ${event.title}!`,
                    text: lines.join('\n'),
                })
            }
        } catch {
            // Email failure is non-fatal — the registration row is already saved
        }
    }

    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

export const PATCH: APIRoute = async (context) => {
    const supabase = createClient(context)
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    let slug: string
    try {
        const body = await context.request.json()
        slug = body?.slug
    } catch {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    if (!slug || typeof slug !== 'string') {
        return new Response(JSON.stringify({ error: 'missing_slug' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const { error } = await supabase
        .from('event_registrations')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id)
        .eq('event_slug', slug)
        .eq('status', 'confirmed')

    if (error) {
        return new Response(JSON.stringify({ error: 'cancellation_failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}
