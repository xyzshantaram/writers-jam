import { Request } from "express";

export const die = (code: number, ...args: any[]): never => {
  console.log(...args);
  Deno.exit(code);
};

export const fatal = (...args: any[]) => die(1, "fatal:", ...args);

export const choose = (arr: any[]) => {
  return arr[Math.floor(Math.random() * arr.length)];
};

export const getClientIP = (req: Request): string | undefined => {
  const firstPart = (s: string, sep: string, n = 0) =>
    s.split(sep).at(n)?.trim();

  const xff = req.header("X-Forwarded-For");
  const realIP = req.header("X-Real-IP");

  // Use last IP in XFF if available, else fallback to X-Real-IP
  return xff ? firstPart(xff, ",", -1) : realIP ?? undefined;
};
