import { dbConnect } from "../common/db/connect";
import { Rooms } from "../types/db";

export async function findPollsToClose() {
    const now = Date.now()
    return await dbConnect(async db => {
        return await db.fetchAll<Rooms>("SELECT * FROM rooms WHERE createdAt < ? AND scoreboard IS NULL", [now - 120000])
    })
}

// todo: maybe create indices