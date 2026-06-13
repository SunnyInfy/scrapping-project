import { z } from 'zod';
export const RoomSchema = z.object({
    id: z.string(),
    motive: z.literal('rooms'),
    source: z.string(),
    title: z.string(),
    location: z.object({
        area: z.string(),
        postcode: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
    }),
    price: z.object({
        amount: z.number(),
        currency: z.string().default('GBP'),
        frequency: z.enum(['weekly', 'monthly']),
    }),
    details: z.object({
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        propertyType: z.enum(['flat', 'house', 'studio', 'bungalow', 'terraced', 'semi-detached']).optional(),
        furnished: z.enum(['furnished', 'unfurnished', 'part-furnished']).optional(),
        epcRating: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).optional(),
        leaseType: z.enum(['long-term', 'short-term']).optional(),
        availableDate: z.string().optional(),
        available_from: z.string().optional(),
    }),
    amenities: z.object({
        garden: z.boolean().optional(),
        parking: z.boolean().optional(),
        gym: z.boolean().optional(),
        balcony: z.boolean().optional(),
    }).optional(),
    agentName: z.string().optional(),
    url: z.string().url(),
    scraped_at: z.string().datetime(),
    expires_at: z.string().datetime().optional(),
});
