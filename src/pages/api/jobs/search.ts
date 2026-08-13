import type { APIRoute } from 'astro'

export const prerender = false

const RAPIDAPI_HOST = 'jsearch.p.rapidapi.com'

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
    try {
        const resp = await fetch(`https://${RAPIDAPI_HOST}/search?${params.toString()}`, {
            headers: {
                'x-rapidapi-key': rapidApiKey,
                'x-rapidapi-host': RAPIDAPI_HOST,
            },
        })

        if (!resp.ok) {
            return new Response(
                JSON.stringify({ error: 'job_search_failed', message: `Provider returned ${resp.status}` }),
                { status: 502, headers: { 'Content-Type': 'application/json' } }
            )
        }

        const data = (await resp.json()) as { data?: unknown[] }
        jobs = data.data ?? []
    } catch (err) {
        return new Response(
            JSON.stringify({ error: 'job_search_failed', message: err instanceof Error ? err.message : 'unknown_error' }),
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