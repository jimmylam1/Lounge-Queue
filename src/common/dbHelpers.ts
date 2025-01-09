import { LoungeQueue } from "../types/db"
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
