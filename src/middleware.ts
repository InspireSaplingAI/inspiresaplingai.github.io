import { defineMiddleware } from 'astro:middleware'

const protectedRoutes = ['/dashboard']

export const onRequest = defineMiddleware(async (context, next) => {
    let user = null

    // Only attempt Supabase client if env vars are available (not during static prerender)
    try {
        const { createClient } = await import('./lib/supabase-server')
        const supabase = createClient(context)
        const { data } = await supabase.auth.getUser()
        user = data.user ?? null
    } catch {
        // Silently handle — during prerendering env vars won't be available
    }

    // Make user available to all routes via locals
    context.locals.user = user

    // Protect dashboard routes
    const url = new URL(context.request.url)
    if (protectedRoutes.some((route) => url.pathname.startsWith(route))) {
        if (!user) {
            const redirectTo = `/auth/login?next=${encodeURIComponent(url.pathname + url.search)}`
            return context.redirect(redirectTo)
        }
    }

    return next()
})
