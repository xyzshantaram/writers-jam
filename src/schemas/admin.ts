import { z } from "zod/v4";

export const signupSchema = z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
    password: z.string().min(8),
    signupCode: z.string().length(8),
});

export const signinSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
