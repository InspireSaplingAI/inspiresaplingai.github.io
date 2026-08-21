/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        user: import('@supabase/supabase-js').User | null
        runtime?: {
            env: {
                [key: string]: unknown
                RESEND_API_KEY?: string
                RESEND_FROM_EMAIL?: string
                OPENAI_API_KEY?: string
                RAPIDAPI_KEY?: string
                SUPABASE_SERVICE_ROLE_KEY?: string
                STRIPE_SECRET_KEY?: string
                STRIPE_WEBHOOK_SECRET?: string
            }
        }
    }
}