import cors from "cors";
import rateLimit from "express-rate-limit";
import express from "express";
import { renderError } from "../error.ts";
import { getClientIP } from "./mod.ts";

export const makeCors = () =>
    cors({
        origin: "https://theattentionbutton.in",
        optionsSuccessStatus: 200,
    });

export const makeLimiter = (reqs: number, duration: number) =>
    rateLimit({
        keyGenerator: (req: express.Request) => {
            const firstPart = (s: string, sep: string, n = 0) => s.split(sep).at(n)?.trim()!;
            const clientIP = getClientIP(req);
            const path = firstPart(req.originalUrl, "?");
            return `${clientIP}-${path}`;
        },
        handler: (_, res) => {
            return renderError(res, {
                code: 429,
                name: "Too Many Requests",
                title: "Please Slow Down",
                details:
                    "You're making requests too quickly. Please wait a moment before trying again. This helps keep Writers Jam running smoothly for everyone.",
            }, 429);
        },
        windowMs: duration,
        limit: reqs,
    });
