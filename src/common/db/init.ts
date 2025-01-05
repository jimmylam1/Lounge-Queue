import { dbConnect } from "./connect";
import { indexes } from "./indexes";
import { tables } from "./tables";

export default async function initDb() {
    await dbConnect(async (db) => {
        for (let table of tables) {
            await db.execute(table).catch(e => e && console.error(`${table}\n${e}`))
        }
        for (let index of indexes) {
            await db.execute(index).catch(e => e && console.error(`${index}\n${e}`))
        }
    }).catch(e => console.error(`db init failed: ${e}`))
}
