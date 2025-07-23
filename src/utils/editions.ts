import { getAllEditions, Edition } from "../db.ts";

const rawEditions = getAllEditions();
const noEdition = rawEditions.at(-1);
export const weeklyEditions = rawEditions.slice(0, -1); // shallow copy of all but last
export const editions = [noEdition, ...weeklyEditions].filter(Boolean) as Edition[];

export const parseEdition = (rawEdition: any): {
    zero?: boolean,
    noEdition?: boolean,
    number: number
} => {
    const parsed = Number(rawEdition);
    if (parsed === 0 && typeof rawEdition === 'string' && rawEdition.length == 0) {
        return { noEdition: true, number: -1 };
    }
    if (isNaN(parsed)) return { noEdition: true, number: -1 };
    if (parsed === 0) return { zero: true, number: 0 };
    return { number: parsed };
}