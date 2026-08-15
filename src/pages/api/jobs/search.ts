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
    const location = url.searchParams.get('location')?.trim()
    const page = String(Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1))
    const numPages = url.searchParams.get('num_pages') || '1'

    if (!query) {
        return new Response(JSON.stringify({ error: 'missing_query' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    // JSearch v2 accepts a `location` param and a `country` filter.
    // Only include `location` when the user actually provides one — sending a
    // broad string like "United States" alongside country=us can cause
    // misleading empty results.
    const params = new URLSearchParams({
        query,
        page,
        num_pages: numPages,
        country: 'us',
        date_posted: 'all', // "week" was too restrictive; "all" matches the verified working request
    })
    if (location) {
        params.set('location', location)
    }

    let jobs: unknown[] = []
    let lastError: string | null = null

    // Per JSearch docs: retry on 429 (rate limit) and 5XX (server errors)
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const resp = await fetch(`https://${RAPIDAPI_HOST}/search-v2?${params.toString()}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-rapidapi-key': rapidApiKey,
                    'x-rapidapi-host': RAPIDAPI_HOST,
                },
            })

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
                data?: { jobs?: unknown[]; cursor?: string }
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

            // JSearch v2 returns data as an object: { jobs: [...] }
            // (when no jobs match, it returns 200 with an empty jobs array — not 404)
            jobs = json.data?.jobs ?? []
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

    // JSearch v2 returns ~10 jobs per page (when num_pages=1).
    // Don't hard-cap the results here — the frontend handles pagination.
    const FULL_PAGE_SIZE = 10

    // Map to a safe subset of fields for the frontend
    const mapped = jobs.map((j) => {
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

    // A full page of results means there are likely more pages to load.
    // If a later page returns fewer than a full page, we're at the end.
    const hasMore = mapped.length >= FULL_PAGE_SIZE

    return new Response(
        JSON.stringify({ jobs: mapped, total: mapped.length, page: Number(page), hasMore }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
            },
        }
    )
}