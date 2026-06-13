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
    furnished: z.string().optional(),
    available_from: z.string().optional(),
  }),
  url: z.string().url(),
  scraped_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
});

export type Room = z.infer<typeof RoomSchema>;
