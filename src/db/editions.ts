import { db } from "./db.ts";

export type Edition = {
    id: number;
    name: string;
    description?: string;
    deleted: boolean;
};

const allEditionsStmt = db.prepare(`
SELECT 
    id, name, description, deleted
FROM 
    editions
ORDER BY 
    id DESC
`);

export const getAllEditions = (): Edition[] => {
    return allEditionsStmt.all() as unknown as Edition[];
};

export const createEdition = (name: string, description: string = ""): Edition => {
    const insertStmt = db.prepare(`
    INSERT INTO 
        editions (name, description)
        VALUES (?, ?) 
    returning
        name, description, id, deleted
  `);

    const edition = insertStmt.get(name, description)!;
    return edition as unknown as Edition;
};

export const updateEditionDescription = (id: number, description: string): Edition => {
    const stmt = db.prepare(`
    UPDATE editions
    SET description = ?
    WHERE id = ?
    returning
        name, description, id, deleted
  `);
    const edition = stmt.get(description, id)!;
    return edition as unknown as Edition;
};

export const deleteEdition = (id: number): void => {
    const stmt = db.prepare(`
    UPDATE editions
    SET deleted = 1
    WHERE id = ?
  `);
    stmt.run(id);
};

export const adminCreateEdition = (name: string, description?: string): Edition => {
    return createEdition(name, description);
};

export const adminUpdateEdition = (
    id: number,
    description: string,
): Edition => {
    return updateEditionDescription(id, description);
};

export const adminDeleteEdition = (id: number): void => {
    deleteEdition(id);
};
