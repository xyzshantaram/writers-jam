import { z } from "zod/v4";
import { Edition, getAllEditions } from "../db.ts";

const rawEditions = getAllEditions();
const noEdition = rawEditions.at(-1);
export const weeklyEditions = rawEditions.slice(0, -1); // shallow copy of all but last
export const editions = [noEdition, ...weeklyEditions].filter(
  Boolean,
) as Edition[];

export const parseEdition = (rawEdition: any): {
  zero?: boolean;
  noEdition?: boolean;
  number: number;
} => {
  const parsed = Number(rawEdition);
  if (
    parsed === 0 && typeof rawEdition === "string" && rawEdition.length == 0
  ) {
    return { noEdition: true, number: -1 };
  }
  if (isNaN(parsed)) return { noEdition: true, number: -1 };
  if (parsed === 0) return { zero: true, number: 0 };
  return { number: parsed };
};

export const editionSchema = z.preprocess((val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val))) {
    return Number(val);
  }
  return val; // triggers error if not number or number-like string
}, z.number());
