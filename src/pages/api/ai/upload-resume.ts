import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase-server'

export const prerender = false

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export const POST: APIRoute = async (context) => {
    if (!import.meta.env.PUBLIC_SUPABASE_URL || !import.meta.env.PUBLIC_SUPABASE_ANON_KEY) {
        return new Response(JSON.stringify({ error: 'supabase_not_configured' }), {
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

    let formData: FormData
    try {
        formData = await context.request.formData()
    } catch {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
        return new Response(JSON.stringify({ error: 'missing_file' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
        return new Response(
            JSON.stringify({ error: 'invalid_type', message: 'Only PDF or DOCX files are allowed.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }

    if (file.size > MAX_SIZE) {
        return new Response(
            JSON.stringify({ error: 'file_too_large', message: 'File must be 5MB or smaller.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }

    const timestamp = Date.now()
    const ext = file.type === 'application/pdf' ? 'pdf' : 'docx'
    // Strip an existing extension so "resume.pdf" doesn't become "resume.pdf.pdf"
    const safeName = (file.name || 'resume')
        .replace(/\.[^.]+$/, '')                    // remove existing extension
        .replace(/[^a-zA-Z0-9._-]/g, '_')           // sanitize
        .slice(-50) || 'resume'
    // Path is relative to the `resumes` bucket — the first folder MUST be the
    // user's UUID so the storage RLS policies (foldername(name))[1] check passes.
    const storagePath = `${user.id}/${timestamp}-${safeName}.${ext}`

    const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
        return new Response(
            JSON.stringify({ error: 'upload_failed', message: uploadError.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
        JSON.stringify({ storage_path: storagePath }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
}