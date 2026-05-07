import { defineCollection, z } from 'astro:content';

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

export const collections = { mission };
