import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { createClient } from '../../../lib/supabase-server'
import { Resend } from 'resend'

export const prerender = false

export const POST: APIRoute = async (context) => {
    if (!import.meta.env.PUBLIC_SUPABASE_URL || !import.meta.env.PUBLIC_SUPABASE_ANON_KEY) {
        return new Response(JSON.stringify({ error: 'supabase_not_configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        })
    }

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
    // Use runtime env (context.locals.runtime.env) for secrets — import.meta.env is
    // statically inlined at build time and won't see Cloudflare encrypted secrets.
    const runtimeEnv = context.locals.runtime?.env ?? {}
    const resendKey = runtimeEnv.RESEND_API_KEY
    let emailError: string | null = null

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

                // RESEND_FROM_EMAIL can be overridden via env var.
                // Use "onboarding@resend.dev" for testing before your domain is verified.
                const fromEmail = runtimeEnv.RESEND_FROM_EMAIL ?? 'InspireSaplingAI <noreply@inspiresaplingai.org>'

                const resend = new Resend(resendKey)
                const { error: sendError } = await resend.emails.send({
                    from: fromEmail,
                    to: user.email,
                    subject: `You're registered for ${event.title}!`,
                    text: lines.join('\n'),
                })

                if (sendError) {
                    emailError = sendError.message
                }
            }
        } catch (err) {
            emailError = err instanceof Error ? err.message : 'unknown_error'
        }
    } else if (!resendKey) {
        emailError = 'RESEND_API_KEY not configured'
    }

    return new Response(
        JSON.stringify({
            success: true,
            email_sent: emailError === null && !!resendKey,
            ...(emailError ? { email_error: emailError } : {}),
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }
    )
}

export const PATCH: APIRoute = async (context) => {
    if (!import.meta.env.PUBLIC_SUPABASE_URL || !import.meta.env.PUBLIC_SUPABASE_ANON_KEY) {
        return new Response(JSON.stringify({ error: 'supabase_not_configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        })
    }

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

    // Send cancellation confirmation email (non-fatal)
    const runtimeEnv = context.locals.runtime?.env ?? {}
    const resendKey = runtimeEnv.RESEND_API_KEY
    let emailError: string | null = null

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
                const fromEmail =
                    runtimeEnv.RESEND_FROM_EMAIL ?? 'InspireSaplingAI <noreply@inspiresaplingai.org>'

                const resend = new Resend(resendKey)
                const { error: sendError } = await resend.emails.send({
                    from: fromEmail,
                    to: user.email,
                    subject: `Registration cancelled: ${event.title}`,
                    text: [
                        `Hi ${userName},`,
                        '',
                        `Your registration has been cancelled for: ${event.title}`,
                        `Date: ${event.date}${event.time ? ` at ${event.time}` : ''}`,
                        '',
                        'If this was a mistake, you can re-register at inspiresaplingai.org/events.',
                        '',
                        '— InspireSaplingAI Team',
                    ].join('\n'),
                })

                if (sendError) {
                    emailError = sendError.message
                }
            }
        } catch (err) {
            emailError = err instanceof Error ? err.message : 'unknown_error'
        }
    } else if (!resendKey) {
        emailError = 'RESEND_API_KEY not configured'
    }

    return new Response(
        JSON.stringify({
            success: true,
            email_sent: emailError === null && !!resendKey,
            ...(emailError ? { email_error: emailError } : {}),
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }
    )
}
