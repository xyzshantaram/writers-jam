import cors from "cors";
import rateLimit from "express-rate-limit";
import express from "express";
import { errors } from "../error.ts";
import { RateLimited } from "../errors/general.ts";
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
            res.set("Retry-After", String(Math.ceil(duration / 1000)));
            return errors.render(res, ...RateLimited);
        },
        windowMs: duration,
        limit: reqs,
    });
