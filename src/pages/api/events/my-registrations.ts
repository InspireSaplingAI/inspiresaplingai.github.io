import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase-server'

export const prerender = false

export const GET: APIRoute = async (context) => {
    // Return empty slugs if Supabase env vars are not configured
    if (!import.meta.env.PUBLIC_SUPABASE_URL || !import.meta.env.PUBLIC_SUPABASE_ANON_KEY) {
        return new Response(JSON.stringify({ slugs: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const supabase = createClient(context)
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        // Return empty array for unauthenticated users — not an error
        return new Response(JSON.stringify({ slugs: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const { data: registrations } = await supabase
        .from('event_registrations')
        .select('event_slug')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')

    const slugs = registrations?.map((r) => r.event_slug) ?? []

    return new Response(JSON.stringify({ slugs }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}
