import { z } from 'zod';
export declare const DealSchema: z.ZodObject<{
    id: z.ZodString;
    motive: z.ZodLiteral<"deals">;
    source: z.ZodString;
    product_name: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    price: z.ZodObject<{
        current: z.ZodNumber;
        original: z.ZodOptional<z.ZodNumber>;
        discount_percent: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        currency: string;
        current: number;
        original?: number | undefined;
        discount_percent?: number | undefined;
    }, {
        current: number;
        currency?: string | undefined;
        original?: number | undefined;
        discount_percent?: number | undefined;
    }>;
    merchant: z.ZodString;
    rating: z.ZodOptional<z.ZodNumber>;
    url: z.ZodString;
    scraped_at: z.ZodString;
    expires_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    motive: "deals";
    source: string;
    price: {
        currency: string;
        current: number;
        original?: number | undefined;
        discount_percent?: number | undefined;
    };
    url: string;
    scraped_at: string;
    product_name: string;
    merchant: string;
    expires_at?: string | undefined;
    category?: string | undefined;
    rating?: number | undefined;
}, {
    id: string;
    motive: "deals";
    source: string;
    price: {
        current: number;
        currency?: string | undefined;
        original?: number | undefined;
        discount_percent?: number | undefined;
    };
    url: string;
    scraped_at: string;
    product_name: string;
    merchant: string;
    expires_at?: string | undefined;
    category?: string | undefined;
    rating?: number | undefined;
}>;
export type Deal = z.infer<typeof DealSchema>;
