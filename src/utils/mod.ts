import { Request } from "express";

export const die = (code: number, ...args: any[]): never => {
    if (code !== 0) console.error(...args);
    else console.info(...args);
    Deno.exit(code);
};

export const fatal = (...args: any[]) => die(1, "fatal:", ...args);

export const choose = <T>(arr: T[], count = 1): T[] => {
    if (count === undefined) {
        return [arr[Math.floor(Math.random() * arr.length)]];
    }

    if (count >= arr.length) {
        return [...arr];
    }

    const copy = [...arr];
    const result: T[] = [];

    for (let i = 0; i < count; i++) {
        const index = Math.floor(Math.random() * copy.length);
        result.push(copy.splice(index, 1)[0]);
    }

    return result;
};

export const clamp = (val: number, min: number, max: number) =>
    val > max ? max : (val < min ? min : val);

export const getClientIP = (req: Request): string | undefined => {
    const firstPart = (s: string, sep: string, n = 0) => s.split(sep).at(n)?.trim();

    const xff = req.header("X-Forwarded-For");
    const realIP = req.header("X-Real-IP");

    // Use last IP in XFF if available, else fallback to X-Real-IP
    return xff ? firstPart(xff, ",", -1) : realIP ?? undefined;
};

export function hashPostId(n: number) {
    if (n < 0 || n > 0xFFFFFFFF) {
        throw new Error("Input out of 32-bit unsigned range");
    }
    const result = (BigInt(n) * 387420489n) % 4000000000n;
    return result.toString(16).padStart(8, "0");
}

export function unhashPostId(h: string) {
    const result = (BigInt("0x" + h) * 3513180409n) % 4000000000n;
    return Number(result);
}

export const makeQueryLinkHelper = (query: Record<string, any>) => {
    return function addQueryParamsObject(
        newParams?: Record<string, string | undefined>,
    ) {
        const merged = { ...query, ...newParams };

        const cleaned = Object.fromEntries(
            Object.entries(merged).filter(([_, v]) => v != null),
        );

        const searchParams = new URLSearchParams(cleaned);
        return `?${searchParams.toString()}`;
    };
};

export const getPostTagString = (
    val: Record<string, any>,
    old?: Record<string, any>,
) => {
    return JSON.stringify({ ...old, ...val });
};

export const cache = <T>(fn: (...args: any[]) => T, waitMs: number): (...args: any[]) => T => {
    const lastCalled = new Map<string, {
        time: number;
        result: T;
    }>();

    return (...args) => {
        const key = JSON.stringify(args);
        const now = Date.now();

        const entry = lastCalled.get(key);

        if (!entry || (now - entry.time) > waitMs) {
            const result = fn(...args);
            lastCalled.set(key, { time: now, result });
            return result;
        }

        return entry.result;
    };
};
