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
    // Number of JSearch pages (~10 jobs each) to fetch per request.
    // The UI uses this as its batch size; defaults to 5 (up to 50 jobs).
    const batchSize = Math.min(5, Math.max(1, parseInt(url.searchParams.get('batch') || '5', 10) || 5))
    const cursor = url.searchParams.get('cursor')?.trim() || null

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
    //
    // JSearch v2 (`search-v2`) uses CURSOR-based pagination: each response
    // contains a `data.cursor` opaque string; pass it back via ?cursor= for
    // the next page. There is no `page` / `num_pages` support in v2.
    const params = new URLSearchParams({
        query,
        country: 'us',
        date_posted: 'all', // "week" was too restrictive; "all" matches the verified working request
    })
    if (location) {
        params.set('location', location)
    }
    if (cursor) {
        params.set('cursor', cursor)
    }

    const FULL_PAGE_SIZE = 10 // JSearch returns ~10 jobs per "page"

    const headers = {
        'Content-Type': 'application/json',
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': RAPIDAPI_HOST,
    }

    // JSearch v2 uses cursor-based pagination. Each response returns the
    // jobs for the current cursor plus the NEXT cursor. We perform up to
    // `batchSize` sequential page requests, following the cursor chain, so
    // the user gets up to batchSize × 10 jobs per API call.
    let fullJobs: unknown[] = []
    let nextCursor: string | null = cursor
    let collected = 0

    while (collected < batchSize) {
        const p = new URLSearchParams(params)
        if (nextCursor) p.set('cursor', nextCursor)

        let pageJobs: unknown[] | null = null
        let pageNextCursor: string | null = null

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const resp = await fetch(`https://${RAPIDAPI_HOST}/search-v2?${p.toString()}`, { headers })
                if (resp.status === 429 || resp.status >= 500) {
                    if (attempt < MAX_RETRIES) {
                        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
                        continue
                    }
                    pageJobs = null
                    break
                }
                if (!resp.ok) {
                    pageJobs = null
                    break
                }
                const json = (await resp.json()) as {
                    status?: string
                    data?: { jobs?: unknown[]; cursor?: string }
                    error?: { message?: string; code?: number }
                }
                if (json.status === 'ERROR' || !json.data) {
                    pageJobs = null
                    break
                }
                pageJobs = json.data.jobs ?? []
                pageNextCursor = json.data.cursor ?? null
                break
            } catch {
                if (attempt < MAX_RETRIES) {
                    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
                    continue
                }
                pageJobs = null
                break
            }
        }

        if (!pageJobs || pageJobs.length === 0) break
        // Merge + de-dupe by apply link
        for (const j of pageJobs) {
            const link = (j as Record<string, unknown>).job_apply_link as string
            if (link && fullJobs.some((f) => (f as Record<string, unknown>).job_apply_link === link)) continue
            fullJobs.push(j)
        }
        collected++
        nextCursor = pageNextCursor
        if (!nextCursor) break // no more pages available
    }

    const jobs = fullJobs.slice(0, FULL_PAGE_SIZE * batchSize)

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

    // We fetched batchSize pages. If every page was full, there are likely
    // deeper results still available — tell the frontend "load more".
    const hasMore = mapped.length >= FULL_PAGE_SIZE * batchSize

    return new Response(
        JSON.stringify({
            jobs: mapped,
            total: mapped.length,
            cursor: nextCursor,
            hasMore,
            batchSize,
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
            },
        }
    )
}