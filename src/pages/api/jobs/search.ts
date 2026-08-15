import type { APIRoute } from 'astro'

export const prerender = false

const RAPIDAPI_HOST = 'jsearch.p.rapidapi.com'
const MAX_RETRIES = 2

export const GET: APIRoute = async ({ request, locals }) => {
    // RAPIDAPI_KEY is an encrypted secret — read from runtime env
    const rapidApiKey = locals.runtime?.env?.RAPIDAPI_KEY as string | undefined
    if (!rapidApiKey) {
        return new Response(JSON.stringify({ error: 'api_not_configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const url = new URL(request.url)
    const query = url.searchParams.get('query')?.trim()
    const location = url.searchParams.get('location')?.trim() || 'United States'
    const page = url.searchParams.get('page') || '1'
    const numPages = url.searchParams.get('num_pages') || '1'

    if (!query) {
        return new Response(JSON.stringify({ error: 'missing_query' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const params = new URLSearchParams({
        query,
        location,
        page,
        num_pages: numPages,
        country: 'us',
        date_posted: 'week',
    })

    let jobs: unknown[] = []
    let lastError: string | null = null

    // Per JSearch docs: retry on 429 (rate limit) and 5XX (server errors)
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const resp = await fetch(`https://${RAPIDAPI_HOST}/search?${params.toString()}`, {
                headers: {
                    'x-rapidapi-key': rapidApiKey,
                    'x-rapidapi-host': RAPIDAPI_HOST,
                },
            })

            // JSearch returns 404 when no jobs match the query/location filters.
            // Treat that as an empty result set rather than a hard error.
            if (resp.status === 404) {
                return new Response(
                    JSON.stringify({ jobs: [], total: 0, message: 'No jobs found. Try a different title or location.' }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            }

            // Retry on rate-limit (429) and server errors (5XX)
            if (resp.status === 429 || resp.status >= 500) {
                lastError = `JSearch returned ${resp.status}`
                if (attempt < MAX_RETRIES) {
                    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
                    continue
                }
            }

            if (!resp.ok) {
                // Try to read the provider's response body for a more specific error
                let providerMessage = `JSearch returned ${resp.status}`
                try {
                    const providerBody = await resp.text()
                    // Truncate to avoid giant error messages
                    if (providerBody) providerMessage += `: ${providerBody.slice(0, 300)}`
                } catch {
                    // ignore body read failures
                }
                return new Response(
                    JSON.stringify({ error: 'job_search_failed', message: providerMessage }),
                    { status: 502, headers: { 'Content-Type': 'application/json' } }
                )
            }

            const json = (await resp.json()) as {
                status?: string
                data?: unknown[]
                error?: { message?: string; code?: number }
            }

            // JSearch returns HTTP 200 with status:"ERROR" for some failures
            if (json.status === 'ERROR') {
                return new Response(
                    JSON.stringify({
                        error: 'job_search_failed',
                        message: json.error?.message ?? 'JSearch returned an error',
                    }),
                    { status: 502, headers: { 'Content-Type': 'application/json' } }
                )
            }

            jobs = json.data ?? []
            break
        } catch (err) {
            lastError = err instanceof Error ? err.message : 'unknown_error'
            if (attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
                continue
            }
        }
    }

    // If all retries failed and we have no jobs, surface the last error
    if (lastError && jobs.length === 0) {
        return new Response(
            JSON.stringify({ error: 'job_search_failed', message: lastError }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        )
    }

    // Map to a safe subset of fields for the frontend
    const mapped = jobs.slice(0, 10).map((j) => {
        const job = j as Record<string, unknown>
        const city = job?.job_city as string | undefined
        const country = job?.job_country as string | undefined
        const minSal = job?.job_min_salary as number | undefined
        const maxSal = job?.job_max_salary as number | undefined
        return {
            title: (job?.job_title as string) ?? 'Untitled',
            company: (job?.employer_name as string) ?? 'Unknown',
            location: city && country ? `${city}, ${country}` : (country ?? ''),
            salary: minSal && maxSal ? `$${Math.round(minSal).toLocaleString()} – $${Math.round(maxSal).toLocaleString()}` : null,
            posted: (job?.job_posted_at_datetime_utc as string) ?? null,
            url: (job?.job_apply_link as string) ?? '#',
            source: (job?.job_publisher as string) ?? 'JSearch',
        }
    })

    return new Response(
        JSON.stringify({ jobs: mapped, total: mapped.length }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
            },
        }
    )
}