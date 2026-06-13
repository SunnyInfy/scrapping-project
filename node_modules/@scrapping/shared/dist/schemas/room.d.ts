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
        propertyType: z.ZodOptional<z.ZodEnum<["flat", "house", "studio", "bungalow", "terraced", "semi-detached"]>>;
        furnished: z.ZodOptional<z.ZodEnum<["furnished", "unfurnished", "part-furnished"]>>;
        epcRating: z.ZodOptional<z.ZodEnum<["A", "B", "C", "D", "E", "F", "G"]>>;
        leaseType: z.ZodOptional<z.ZodEnum<["long-term", "short-term"]>>;
        availableDate: z.ZodOptional<z.ZodString>;
        available_from: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        bedrooms?: number | undefined;
        bathrooms?: number | undefined;
        propertyType?: "flat" | "house" | "studio" | "bungalow" | "terraced" | "semi-detached" | undefined;
        furnished?: "furnished" | "unfurnished" | "part-furnished" | undefined;
        epcRating?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | undefined;
        leaseType?: "long-term" | "short-term" | undefined;
        availableDate?: string | undefined;
        available_from?: string | undefined;
    }, {
        bedrooms?: number | undefined;
        bathrooms?: number | undefined;
        propertyType?: "flat" | "house" | "studio" | "bungalow" | "terraced" | "semi-detached" | undefined;
        furnished?: "furnished" | "unfurnished" | "part-furnished" | undefined;
        epcRating?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | undefined;
        leaseType?: "long-term" | "short-term" | undefined;
        availableDate?: string | undefined;
        available_from?: string | undefined;
    }>;
    amenities: z.ZodOptional<z.ZodObject<{
        garden: z.ZodOptional<z.ZodBoolean>;
        parking: z.ZodOptional<z.ZodBoolean>;
        gym: z.ZodOptional<z.ZodBoolean>;
        balcony: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        garden?: boolean | undefined;
        parking?: boolean | undefined;
        gym?: boolean | undefined;
        balcony?: boolean | undefined;
    }, {
        garden?: boolean | undefined;
        parking?: boolean | undefined;
        gym?: boolean | undefined;
        balcony?: boolean | undefined;
    }>>;
    agentName: z.ZodOptional<z.ZodString>;
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
        propertyType?: "flat" | "house" | "studio" | "bungalow" | "terraced" | "semi-detached" | undefined;
        furnished?: "furnished" | "unfurnished" | "part-furnished" | undefined;
        epcRating?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | undefined;
        leaseType?: "long-term" | "short-term" | undefined;
        availableDate?: string | undefined;
        available_from?: string | undefined;
    };
    url: string;
    scraped_at: string;
    amenities?: {
        garden?: boolean | undefined;
        parking?: boolean | undefined;
        gym?: boolean | undefined;
        balcony?: boolean | undefined;
    } | undefined;
    agentName?: string | undefined;
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
        propertyType?: "flat" | "house" | "studio" | "bungalow" | "terraced" | "semi-detached" | undefined;
        furnished?: "furnished" | "unfurnished" | "part-furnished" | undefined;
        epcRating?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | undefined;
        leaseType?: "long-term" | "short-term" | undefined;
        availableDate?: string | undefined;
        available_from?: string | undefined;
    };
    url: string;
    scraped_at: string;
    amenities?: {
        garden?: boolean | undefined;
        parking?: boolean | undefined;
        gym?: boolean | undefined;
        balcony?: boolean | undefined;
    } | undefined;
    agentName?: string | undefined;
    expires_at?: string | undefined;
}>;
export type Room = z.infer<typeof RoomSchema>;
