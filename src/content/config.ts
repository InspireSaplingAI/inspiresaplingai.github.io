import { defineCollection, z } from 'astro:content';

// ── Resources (markdown files, supports article body rendering) ────────────
const resources = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        level: z.enum(['beginner', 'advanced']),
        type: z.enum(['article', 'link', 'video']),
        description: z.string(),
        url: z.string().optional(),
        youtube_id: z.string().optional(),
        tags: z.array(z.string()).default([]),
        published_at: z.string(),
        featured: z.boolean().optional(),
        source: z.string().optional(),
    }),
});

// ── Events (JSON files) ────────────────────────────────────────────────────
const events = defineCollection({
    type: 'data',
    schema: z.object({
        title: z.string(),
        type: z.enum(['workshop', 'competition', 'lecture', 'seminar', 'webinar']),
        mode: z.enum(['online', 'offline', 'hybrid']),
        date: z.string(),
        time: z.string().optional(),
        location: z.string().optional(),
        description: z.string(),
        external_url: z.string().optional(),
        status: z.enum(['upcoming', 'past']),
        registration_required: z.boolean().optional(),
        tags: z.array(z.string()).default([]),
        image_alt: z.string().optional(),
    }),
});

// ── Mission (JSON files, existing) ─────────────────────────────────────────
const mission = defineCollection({
    type: 'data',
    schema: z.object({
        headline: z.string().optional(),
        subtext: z.string().optional(),
        hero_image_alt: z.string().optional(),
        video_id: z.string().optional(),
        body: z.string().optional(),
        // why.json fields
        problem_title: z.string().optional(),
        problem_body: z.string().optional(),
        theory_title: z.string().optional(),
        items: z.array(z.object({
            icon: z.string().optional(),
            title: z.string(),
            description: z.string(),
        })).optional(),
        metrics: z.array(z.object({
            number: z.string(),
            suffix: z.string().optional(),
            label: z.string(),
            description: z.string().optional(),
        })).optional(),
        steps: z.array(z.object({
            number: z.string(),
            title: z.string(),
            description: z.string(),
        })).optional(),
        faqs: z.array(z.object({
            question: z.string(),
            answer: z.string(),
        })).optional(),
        primary_label: z.string().optional(),
        primary_href: z.string().optional(),
        secondary_label: z.string().optional(),
        secondary_href: z.string().optional(),
        partners: z.array(z.object({
            name: z.string(),
            logo_placeholder: z.string().optional(),
            url: z.string().optional(),
        })).optional(),
    }),
});

export const collections = { mission, resources, events };
