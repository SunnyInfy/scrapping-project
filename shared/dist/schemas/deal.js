import { z } from 'zod';
export const DealSchema = z.object({
    id: z.string(),
    motive: z.literal('deals'),
    source: z.string(),
    product_name: z.string(),
    category: z.string().optional(),
    price: z.object({
        current: z.number(),
        original: z.number().optional(),
        discount_percent: z.number().optional(),
        currency: z.string().default('GBP'),
    }),
    merchant: z.string(),
    rating: z.number().optional(),
    url: z.string().url(),
    scraped_at: z.string().datetime(),
    expires_at: z.string().datetime().optional(),
});
