import { z } from 'zod';
export declare const RoomSchema: z.ZodObject<{
    id: z.ZodString;
    motive: z.ZodLiteral<"rooms">;
    source: z.ZodString;
    title: z.ZodString;
    location: z.ZodObject<{
        area: z.ZodString;
        postcode: z.ZodOptional<z.ZodString>;
        lat: z.ZodOptional<z.ZodNumber>;
        lng: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        area: string;
        postcode?: string | undefined;
        lat?: number | undefined;
        lng?: number | undefined;
    }, {
        area: string;
        postcode?: string | undefined;
        lat?: number | undefined;
        lng?: number | undefined;
    }>;
    price: z.ZodObject<{
        amount: z.ZodNumber;
        currency: z.ZodDefault<z.ZodString>;
        frequency: z.ZodEnum<["weekly", "monthly"]>;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        currency: string;
        frequency: "weekly" | "monthly";
    }, {
        amount: number;
        frequency: "weekly" | "monthly";
        currency?: string | undefined;
    }>;
    details: z.ZodObject<{
        bedrooms: z.ZodOptional<z.ZodNumber>;
        bathrooms: z.ZodOptional<z.ZodNumber>;
        furnished: z.ZodOptional<z.ZodString>;
        available_from: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        bedrooms?: number | undefined;
        bathrooms?: number | undefined;
        furnished?: string | undefined;
        available_from?: string | undefined;
    }, {
        bedrooms?: number | undefined;
        bathrooms?: number | undefined;
        furnished?: string | undefined;
        available_from?: string | undefined;
    }>;
    url: z.ZodString;
    scraped_at: z.ZodString;
    expires_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    motive: "rooms";
    source: string;
    title: string;
    location: {
        area: string;
        postcode?: string | undefined;
        lat?: number | undefined;
        lng?: number | undefined;
    };
    price: {
        amount: number;
        currency: string;
        frequency: "weekly" | "monthly";
    };
    details: {
        bedrooms?: number | undefined;
        bathrooms?: number | undefined;
        furnished?: string | undefined;
        available_from?: string | undefined;
    };
    url: string;
    scraped_at: string;
    expires_at?: string | undefined;
}, {
    id: string;
    motive: "rooms";
    source: string;
    title: string;
    location: {
        area: string;
        postcode?: string | undefined;
        lat?: number | undefined;
        lng?: number | undefined;
    };
    price: {
        amount: number;
        frequency: "weekly" | "monthly";
        currency?: string | undefined;
    };
    details: {
        bedrooms?: number | undefined;
        bathrooms?: number | undefined;
        furnished?: string | undefined;
        available_from?: string | undefined;
    };
    url: string;
    scraped_at: string;
    expires_at?: string | undefined;
}>;
export type Room = z.infer<typeof RoomSchema>;
