import { dbConnect } from "./connect";
import { tables } from "./tables";

export default async function initDb() {
    await dbConnect(async (db) => {
        for (let table of tables) {
            await db.execute(table).catch(e => e && console.log(`${table}\n${e}`))
        }
    }).catch(e => console.error(`db init failed: ${e}`))
}
