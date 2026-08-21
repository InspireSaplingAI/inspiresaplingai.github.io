import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase-server'

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

    let body: { mentor_id?: string }
    try {
        body = await context.request.json()
    } catch {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    if (!body.mentor_id) {
        return new Response(JSON.stringify({ error: 'missing_mentor_id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const { data: mentor, error: mentorError } = await supabase
        .from('mentor_profiles')
        .select('*')
        .eq('id', body.mentor_id)
        .eq('approved', true)
        .single()

    if (mentorError) {
        return new Response(JSON.stringify({ error: 'mentor_not_found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const stripeKey = context.locals.runtime?.env?.STRIPE_SECRET_KEY as string | undefined

    if (!stripeKey) {
        return new Response(JSON.stringify({ error: 'stripe_not_configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    if (!mentor.stripe_price_id) {
        return new Response(JSON.stringify({ error: 'stripe_not_configured' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    // Determine the site origin (fall back to the request's origin in dev)
    const origin =
        context.site?.origin ?? new URL(context.request.url).origin ?? 'http://localhost:4321'

    // Dynamically import Stripe to avoid server bundle issues
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey)

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price: mentor.stripe_price_id,
                    quantity: 1,
                },
            ],
            success_url: `${origin}/dashboard?booked=true`,
            cancel_url: `${origin}/mentors/${mentor.id}`,
            client_reference_id: user.id,
            metadata: {
                mentor_id: mentor.id,
                user_id: user.id,
            },
        })

        return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (err) {
        return new Response(
            JSON.stringify({
                error: 'checkout_failed',
                message: err instanceof Error ? err.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}