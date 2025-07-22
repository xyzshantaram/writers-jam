import { hash } from "@bronti/argon2";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("writers-jam.db");
const fetchPasswordsQuery = db.prepare(`select id, password from post order by id`);

const results = fetchPasswordsQuery.all() as { id: string, password: string }[];

const updatePasswordQuery = db.prepare('update post set password = :password where id = :id');
for (const result of results) {
    if (result.password.length) {
        updatePasswordQuery.run({
            password: hash(result.password),
            id: result.id
        });
        console.log(`done with ${result.id}`)
    }
}