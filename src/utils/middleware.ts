import cors from "cors";
import rateLimit from "express-rate-limit";
import { NextFunction, Request, Response } from "express";
import { errors } from "../error.ts";
import { RateLimited } from "../errors/general.ts";
import { extractTokenFromHeader, getClientIP, verifyToken } from "./mod.ts";
import { InvalidToken, MissingToken } from "../errors/admin.ts";
import { timeMs } from "./time.ts";

export const makeCors = () =>
    cors({
        origin: "https://theattentionbutton.in",
        optionsSuccessStatus: 200,
    });

interface LimiterOpts {
    n: number;
    period: Parameters<typeof timeMs>[0];
    json?: boolean;
}

export const makeLimiter = (opts: LimiterOpts) => {
    const { json = false, n, period } = opts;
    const periodMs = timeMs(period);
    return rateLimit({
        keyGenerator: (req: Request) => {
            const firstPart = (s: string, sep: string, n = 0) => s.split(sep).at(n)?.trim()!;
            const clientIP = getClientIP(req);
            const path = firstPart(req.originalUrl, "?");
            return `${clientIP}-${path}`;
        },
        handler: (_, res) => {
            res.set("Retry-After", String(Math.ceil(periodMs / 1000)));
            const err = json ? errors.json : errors.render;
            return err(res, ...RateLimited);
        },
        windowMs: periodMs,
        limit: n,
    });
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    if (!token) return errors.json(res, ...MissingToken);

    try {
        const payload = verifyToken(token);
        (req as any).username = payload.username;
        next();
    } catch (_) {
        return errors.json(res, ...InvalidToken);
    }
};
