import { Config, LoungeQueue, Rooms, Subs } from "../types/db"
import { QueuePlayer } from "../types/player"
import { dbConnect } from "./db/connect"

export async function fetchQueueFromDb(messageId: string) {
    return await dbConnect(async db => {
        return await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = ?", [messageId])
    })
}

export async function markQueueMadeRooms(messageId: string) {
    return await dbConnect(async db => {
        return await db.execute("UPDATE loungeQueue SET madeRooms = 1 WHERE messageId = ?", [messageId])
    })
}

export async function getPlayersInRoom(roomChannelId: string) {
    return await dbConnect(async db => {
        return await db.fetchAll<QueuePlayer>("SELECT * FROM players WHERE roomChannelId = ?", [roomChannelId])
    })
}

export async function getActiveQueuesInChannel(channelId: string) {
    return await dbConnect(async db => {
        return await db.fetchAll<LoungeQueue>("SELECT * FROM loungeQueue WHERE channelId = ? AND active = 1", [channelId])
    })
}

export async function getLatestQueueInChannel(channelId: string) {
    return await dbConnect(async db => {
        return await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE id = (SELECT MAX(id) FROM loungeQueue WHERE channelId = ?)", [channelId])
    })
}

export async function getConfig(guildId: string) {
    return await dbConnect(async db => {
        return await db.fetchOne<Config>("SELECT * FROM config WHERE guildId = ?", [guildId])
    })
}

export async function getRoom(roomChannelId: string) {
    return await dbConnect(async db => {
        return await db.fetchOne<Rooms>(`SELECT * FROM rooms WHERE roomChannelId = ?`, [roomChannelId])
    })
}

export async function getSubRowFromDb(rowId: number) {
    return await dbConnect(async db => {
        return await db.fetchOne<Subs>(`SELECT * FROM subs WHERE id = ?`, [rowId])
    })
}

export async function removeSubRowFromDb(rowId: number) {
    return await dbConnect(async db => {
        return await db.execute(`DELETE FROM subs WHERE id = ?`, [rowId])
    })
}

export async function queueRoomCount(queueId: number) {
    return await dbConnect(async db => {
        const countData = await db.fetchOne<{count: number}>(`SELECT COUNT(*) AS count FROM rooms WHERE queue = ?`, [queueId])
        if (!countData) {
            console.error(`dbHelpers.ts queueRoomCount() countData is undefined: ${countData}`)
            return 0
        }
        return countData.count
    })
}
