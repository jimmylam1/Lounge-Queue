import { Client } from "discord.js"
import { guildConfig } from "../common/data/guildConfig"
import { dbConnect } from "../common/db/connect"
import { LoungeQueue, Rooms, RoomsWithGuildId } from "../types/db"

export async function deleteOldRowsAndRooms(client: Client) {
    // delete rows after 25 hours. Originally 24, but add 1 hour to take into account that rooms are around 45m behind
    const threshold = Date.now() - 90000000

    const queues = await dbConnect(async db => {
        return await db.fetchAll<LoungeQueue>("SELECT * FROM loungeQueue WHERE startTime < ? AND active = 0", [threshold])
    })

    if (queues.length) {
        const queueIds = queues.map(q => q.id)
        const queueWhereClauses = queues.map(q => "queue = ?")
        const queueIdWhereClauses = queues.map(q => "id = ?")

        const rooms = await dbConnect(async db => {
            return await db.fetchAll<Rooms>(`SELECT * FROM rooms WHERE ${queueWhereClauses.join(" OR ")}`, queueIds)
        })
        const roomIds = rooms.map(r => r.roomChannelId)
        const roomWhereClauses = rooms.map(r => "roomChannelId = ?")

        await deleteRoomsManager(client, threshold).catch(e => console.error(`deleteRowsAndRooms.ts deleteRoomsManager() failed ${e}`))

        let last = 0
        await dbConnect(async db => {
            // order is important due to foreign key constraints
            await db.execute(`DELETE FROM players WHERE ${queueWhereClauses.join(" OR ")}`, queueIds)
            last = 1
            if (roomIds.length) {
                await db.execute(`DELETE FROM votes WHERE ${roomWhereClauses.join(" OR ")}`, roomIds)
                await db.execute(`DELETE FROM rooms WHERE ${roomWhereClauses.join(" OR ")}`, roomIds)
            }
            last = 2
            await db.execute(`DELETE FROM loungeQueue WHERE ${queueIdWhereClauses.join(" OR ")}`, queueIds)
        }).catch(e => console.error(`deleteRowsAndRooms.ts main delete failed at last=${last}`, e))
    }
}

async function deleteRoomsManager(client: Client, threshold: number) {
    const guildIds = getGuildIdsToCheck()
    const roomsToDelete = await queryRoomsToDelete(guildIds, threshold)
    for (let guildid of guildIds) {
        await deleteRooms(client, guildid, roomsToDelete).catch(e => console.error(`deleteRowsAndRooms.ts deleteRoomsManager() failed ${e}`))
    }
}

function getGuildIdsToCheck() {
    const guildIds: string[] = []
    for (let guildId in guildConfig) {
        if (guildConfig[guildId].deleteOldRooms)
            guildIds.push(guildId)
    }
    return guildIds
}

async function queryRoomsToDelete(guildIds: string[], threshold: number) {
    const query = `SELECT r.roomChannelId, r.queue, r.createdAt, r.pollMessageId, r.scoreboard, q.guildId FROM rooms r
        JOIN loungeQueue q ON r.queue = q.id WHERE r.createdAt < ? AND `
    const whereClause = guildIds.map(i => "q.guildId = ?")
    
    const res = await dbConnect(async db => {
        return await db.fetchAll<RoomsWithGuildId>(`${query} (${whereClause.join(" OR ")})`, [threshold, ...guildIds])
    })
    return res
}

async function deleteRooms(client: Client, guildId: string, roomsToDelete: RoomsWithGuildId[]) {
    const rooms = roomsToDelete.filter(r => r.guildId === guildId)
    const guild = await client.guilds.fetch(guildId)
    for (let room of rooms) {
        await guild.channels.delete(room.roomChannelId).catch(e => console.error(`deleteRowsAndRooms.ts deleteRooms() channel delete failed ${e}`))
    }
}