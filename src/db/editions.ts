import { db } from "./db.ts";

export type Edition = {
    id: number;
    name: string;
    deleted: boolean;
};

const stmt = db.prepare(`
SELECT 
    id, name, deleted
FROM 
    editions
ORDER BY 
    id DESC
`);

export const getAllEditions = (): Edition[] => {
    return stmt.all() as unknown as Edition[];
};

export const createEdition = (name: string): Edition => {
    const insertStmt = db.prepare(`
    INSERT INTO 
        editions (name)
        VALUES (?) 
    returning
        name, id, deleted
  `);

    const edition = insertStmt.get(name)!;
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

export const adminCreateEdition = (name: string): Edition => {
    return createEdition(name);
};

export const adminDeleteEdition = (id: number): void => {
    deleteEdition(id);
};
