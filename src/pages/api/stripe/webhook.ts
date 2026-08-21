import type { APIRoute } from 'astro'
import type Stripe from 'stripe'
import { createAdminClient } from '../../../lib/supabase-admin'

export const prerender = false

export const POST: APIRoute = async (context) => {
    const webhookSecret = context.locals.runtime?.env?.STRIPE_WEBHOOK_SECRET as string | undefined
    const stripeKey = context.locals.runtime?.env?.STRIPE_SECRET_KEY as string | undefined
    const serviceRoleKey = context.locals.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY as string | undefined

    if (!webhookSecret || !stripeKey || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'stripe_not_configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    // Dynamically import Stripe to avoid server bundle issues
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey)

    const body = await context.request.text()
    const signature = context.request.headers.get('stripe-signature')

    if (!signature) {
        return new Response(JSON.stringify({ error: 'missing_signature' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    let event: Stripe.Event
    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
        return new Response(
            JSON.stringify({
                error: 'invalid_signature',
                message: err instanceof Error ? err.message : 'Unknown error',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }

    // Stripe webhooks arrive with no user session, so the normal cookie-based
    // client (RLS-scoped to the request user) cannot insert rows. Use the
    // service-role client which bypasses RLS — safe because the signature was
    // verified above, proving the request came from Stripe.
    const supabase = createAdminClient(serviceRoleKey)

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session
            const mentorId = session.metadata?.mentor_id
            const userId = session.metadata?.user_id || session.client_reference_id

            if (!mentorId || !userId) {
                return new Response(
                    JSON.stringify({ error: 'missing_metadata' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                )
            }

            // Idempotency: Stripe may retry webhook delivery. Check for an
            // existing row with this session ID before inserting.
            const { data: existing } = await supabase
                .from('coaching_sessions')
                .select('id')
                .eq('stripe_session_id', session.id)
                .maybeSingle()

            if (existing) {
                // Already recorded — acknowledge without duplicating
                return new Response(JSON.stringify({ received: true, duplicate: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            }

            const { error: insertError } = await supabase.from('coaching_sessions').insert({
                mentor_id: mentorId,
                member_id: userId,
                stripe_session_id: session.id,
                stripe_payment_id:
                    typeof session.payment_intent === 'string'
                        ? session.payment_intent
                        : session.payment_intent?.id ?? null,
                status: 'paid',
                amount_cents: session.amount_total ?? null,
            })

            if (insertError) {
                return new Response(
                    JSON.stringify({ error: 'insert_failed', message: insertError.message }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                )
            }
            break
        }

        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent

            // Update the coaching session if it was already created
            const { error: updateError } = await supabase
                .from('coaching_sessions')
                .update({ status: 'paid', stripe_payment_id: paymentIntent.id })
                .eq('stripe_payment_id', paymentIntent.id)

            if (updateError) {
                return new Response(
                    JSON.stringify({ error: 'update_failed', message: updateError.message }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                )
            }
            break
        }

        default:
        // Unhandled event type — respond 200 so Stripe doesn't retry
    }

    return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}