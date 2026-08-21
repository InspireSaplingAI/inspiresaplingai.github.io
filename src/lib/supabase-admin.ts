import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Admin/service-role client. Bypasses RLS — ONLY for trusted server-side
// contexts (e.g. Stripe webhooks that arrive without a user session).
// Must NEVER be imported in client-side code or used with user-supplied input
// without additional authorization checks.
//
// The service role key is passed in rather than read from import.meta.env so
// this works on Cloudflare Pages, where encrypted secrets are only available
// via `context.locals.runtime.env` at request time.
export function createAdminClient(serviceRoleKey: string) {
    const url = import.meta.env.PUBLIC_SUPABASE_URL

    if (!url || !serviceRoleKey) {
        throw new Error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured')
    }

    return createSupabaseClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}
