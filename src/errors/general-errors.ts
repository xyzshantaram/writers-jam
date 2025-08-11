import type { RenderErrorOpts } from "../error.ts";

// Rate limiting errors
export const RateLimited: [RenderErrorOpts, number] = [
    {
        code: "Ratelimited",
        name: "Too Many Requests",
        title: "Please Slow Down",
        details: "You're making requests too quickly. Please wait a moment before trying again. This helps keep Writers Jam running smoothly for everyone.",
    },
    429
];

// Validation errors (can be reused across different contexts)
export const ValidationError = (details: string): [RenderErrorOpts, number] => [
    {
        code: "ValidationError",
        title: "Invalid Input",
        name: "Validation error",
        details,
    },
    400
];
