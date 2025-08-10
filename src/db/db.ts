import { DatabaseSync } from "node:sqlite";

export const db = new DatabaseSync("./writers-jam.db", {
    enableForeignKeyConstraints: true,
    readOnly: false,
});
