import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase-server'
import OpenAI from 'openai'

export const prerender = false

const FREE_LIMIT = 3

export const POST: APIRoute = async (context) => {
    if (!import.meta.env.PUBLIC_SUPABASE_URL || !import.meta.env.PUBLIC_SUPABASE_ANON_KEY) {
        return new Response(JSON.stringify({ error: 'supabase_not_configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const openaiKey = context.locals.runtime?.env?.OPENAI_API_KEY as string | undefined
    if (!openaiKey) {
        return new Response(JSON.stringify({ error: 'ai_not_configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const supabase = createClient(context)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    let body: { storage_path?: string; job_title?: string }
    try {
        body = await context.request.json()
    } catch {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    if (!body.storage_path || !body.job_title) {
        return new Response(JSON.stringify({ error: 'missing_fields' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('ai_credits_used')
        .eq('id', user.id)
        .single()

    const creditsUsed = profile?.ai_credits_used ?? 0
    if (creditsUsed >= FREE_LIMIT) {
        return new Response(JSON.stringify({ error: 'free_limit_reached' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const { data: signedData } = await supabase.storage
        .from('resumes')
        .createSignedUrl(body.storage_path, 60)

    if (!signedData?.signedUrl) {
        return new Response(JSON.stringify({ error: 'file_not_found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    let fileBuffer: ArrayBuffer
    try {
        const resp = await fetch(signedData.signedUrl)
        if (!resp.ok) throw new Error('download_failed')
        fileBuffer = await resp.arrayBuffer()
    } catch {
        return new Response(JSON.stringify({ error: 'file_download_failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const isPdf = body.storage_path.toLowerCase().endsWith('.pdf')
    const ext = isPdf ? 'pdf' : 'docx'
    const mime = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    const openai = new OpenAI({ apiKey: openaiKey })
    let fileId: string | undefined
    let analysisJson: unknown

    try {
        const file = await openai.files.create({
            file: new File([fileBuffer], `resume.${ext}`, { type: mime }),
            purpose: 'user_data',
        })
        fileId = file.id

        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            input: [
                {
                    role: 'user',
                    content: [
                        { type: 'input_file', file_id: file.id },
                        {
                            type: 'input_text',
                            text: `You are an expert career coach. Analyze this resume for the target role: ${body.job_title}. Return a JSON object with: strengths (string[]), gaps (string[]), rewrite_suggestions ({section, original, improved}[]), overall_score (1-10), summary (string).`,
                        },
                    ],
                },
            ],
        })

        const text = response.output_text || ''
        const match = text.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('invalid_ai_response')
        analysisJson = JSON.parse(match[0])
    } catch (err) {
        return new Response(
            JSON.stringify({ error: 'analysis_failed', message: err instanceof Error ? err.message : 'unknown_error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    } finally {
        if (fileId) {
            try { await openai.files.delete(fileId) } catch { /* ignore */ }
        }
    }

    const { error: insertError } = await supabase.from('resume_analyses').insert({
        user_id: user.id,
        storage_path: body.storage_path,
        job_title: body.job_title,
        analysis_result: analysisJson,
    })

    if (insertError) {
        return new Response(
            JSON.stringify({ error: 'save_failed', message: insertError.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }

    // ============================================================
    // 🔁 ATOMIC INCREMENT (also fixes double-click race: both requests
    // would read 0 and write 1; this makes each click persist +1)
    // ============================================================
    // The preferred path is the SECURITY DEFINER RPC — it is atomic and
    // immune to the double-click race. However, the RPC relies on the
    // migration `supabase/migrations/20260817_add_ai_credit_persistence.sql`
    // having been applied to the database. If it hasn't, PostgREST returns
    // "Could not find the function public.increment_ai_credits(target_user)
    // in the schema cache" → so we fall back to a direct UPDATE below.
    const { data: incrementData, error: rpcError } = await supabase.rpc('increment_ai_credits', {
        target_user: user.id,
    })

    if (rpcError) {
        // Fallback: direct UPDATE via the REST API.
        // NOTE: This is not atomic under a rapid double-click race, but it
        // keeps the feature working even if the migration hasn't been
        // applied to the Supabase project yet.
        const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({ ai_credits_used: creditsUsed + 1 })
            .eq('id', user.id)
            .select('ai_credits_used')
            .single()

        if (updateError) {
            return new Response(
                JSON.stringify({ error: 'increment_failed', message: updateError.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // RLS-silent failure: if UPDATE silently affected 0 rows
        // (updatedProfile is null), throw a real 500.
        if (!updatedProfile) {
            return new Response(
                JSON.stringify({ error: 'profile_update_failed', message: rpcError.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ analysis: analysisJson, credits_used: updatedProfile.ai_credits_used }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    }

    // RLS-silent failure: if UPDATE silently affected 0 rows (data: null), throw a real 500
    if (incrementData === null) {
        return new Response(
            JSON.stringify({ error: 'profile_update_failed' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
        JSON.stringify({ analysis: analysisJson, credits_used: incrementData }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
}