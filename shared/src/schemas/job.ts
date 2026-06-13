import { z } from 'zod';

export const JobSchema = z.object({
  id: z.string(),
  motive: z.literal('jobs'),
  source: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  salary: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().default('GBP'),
    frequency: z.enum(['hourly', 'daily', 'monthly', 'yearly']).optional(),
  }).optional(),
  details: z.object({
    job_type: z.string().optional(),
    experience_level: z.string().optional(),
    skills: z.array(z.string()).optional(),
  }),
  url: z.string().url(),
  scraped_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
});

export type Job = z.infer<typeof JobSchema>;
