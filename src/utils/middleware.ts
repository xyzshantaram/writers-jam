import cors from "cors";
import rateLimit from "express-rate-limit";
import { NextFunction, Request, Response } from "express";
import { errors } from "../error.ts";
import { RateLimited } from "../errors/general.ts";
import { extractTokenFromHeader, getClientIP, verifyToken } from "./mod.ts";
import { InvalidToken, MissingToken } from "../errors/admin.ts";

export const makeCors = () =>
    cors({
        origin: "https://theattentionbutton.in",
        optionsSuccessStatus: 200,
    });

export const makeLimiter = (reqs: number, duration: number) =>
    rateLimit({
        keyGenerator: (req: Request) => {
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

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    if (!token) return errors.json(res, ...MissingToken);

    try {
        verifyToken(token);
        next();
    } catch (_) {
        return errors.json(res, ...InvalidToken);
    }
};
