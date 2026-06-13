import { z } from 'zod';
export declare const JobSchema: z.ZodObject<{
    id: z.ZodString;
    motive: z.ZodLiteral<"jobs">;
    source: z.ZodString;
    title: z.ZodString;
    company: z.ZodString;
    location: z.ZodString;
    salary: z.ZodOptional<z.ZodObject<{
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodDefault<z.ZodString>;
        frequency: z.ZodOptional<z.ZodEnum<["hourly", "daily", "monthly", "yearly"]>>;
    }, "strip", z.ZodTypeAny, {
        currency: string;
        frequency?: "monthly" | "hourly" | "daily" | "yearly" | undefined;
        min?: number | undefined;
        max?: number | undefined;
    }, {
        currency?: string | undefined;
        frequency?: "monthly" | "hourly" | "daily" | "yearly" | undefined;
        min?: number | undefined;
        max?: number | undefined;
    }>>;
    details: z.ZodObject<{
        job_type: z.ZodOptional<z.ZodString>;
        experience_level: z.ZodOptional<z.ZodString>;
        skills: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        job_type?: string | undefined;
        experience_level?: string | undefined;
        skills?: string[] | undefined;
    }, {
        job_type?: string | undefined;
        experience_level?: string | undefined;
        skills?: string[] | undefined;
    }>;
    url: z.ZodString;
    scraped_at: z.ZodString;
    expires_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    motive: "jobs";
    source: string;
    title: string;
    location: string;
    details: {
        job_type?: string | undefined;
        experience_level?: string | undefined;
        skills?: string[] | undefined;
    };
    url: string;
    scraped_at: string;
    company: string;
    expires_at?: string | undefined;
    salary?: {
        currency: string;
        frequency?: "monthly" | "hourly" | "daily" | "yearly" | undefined;
        min?: number | undefined;
        max?: number | undefined;
    } | undefined;
}, {
    id: string;
    motive: "jobs";
    source: string;
    title: string;
    location: string;
    details: {
        job_type?: string | undefined;
        experience_level?: string | undefined;
        skills?: string[] | undefined;
    };
    url: string;
    scraped_at: string;
    company: string;
    expires_at?: string | undefined;
    salary?: {
        currency?: string | undefined;
        frequency?: "monthly" | "hourly" | "daily" | "yearly" | undefined;
        min?: number | undefined;
        max?: number | undefined;
    } | undefined;
}>;
export type Job = z.infer<typeof JobSchema>;
