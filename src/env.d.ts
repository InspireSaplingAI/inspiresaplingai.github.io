/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        user: import('@supabase/supabase-js').User | null
        runtime?: {
            env: {
                [key: string]: unknown
                RESEND_API_KEY?: string
                RESEND_FROM_EMAIL?: string
            }
        }
    }
}