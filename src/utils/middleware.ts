import cors from "cors";
import rateLimit from "express-rate-limit";
import express from "express";
import { renderError } from "./mod.ts";
import { timeMs } from "./time.ts";

export const makeCors = () =>
  cors({
    origin: "https://theattentionbutton.in",
    optionsSuccessStatus: 200,
  });

export const makeLimiter = (rpm: number) =>
  rateLimit({
    keyGenerator: (req: express.Request) => {
      const firstPart = (s: string, sep: string, n = 0) =>
        s.split(sep).at(n)?.trim()!;
      const xff = req.header("X-Forwarded-For");
      const realIP = req.header("X-Real-IP");
      // Use first IP in XFF or fallback to X-Real-IP
      const clientIP = xff ? firstPart(xff, ",", -1) : realIP;
      const path = firstPart(req.originalUrl, "?");
      return `${clientIP}-${path}`;
    },
    handler: (_, res) => {
      return renderError(res, {
        code: 429,
        name: "Too Many Requests",
        details:
          "You have made too many requests to the specified resource. Please try again in some time.",
      }, 429);
    },
    windowMs: timeMs({ m: 1 }),
    limit: rpm,
  });
