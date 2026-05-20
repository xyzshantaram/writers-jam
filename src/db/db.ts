import { DatabaseSync } from "node:sqlite";

export const db = new DatabaseSync("./data/writers-jam.db", {
    enableForeignKeyConstraints: true,
    readOnly: false,
});
