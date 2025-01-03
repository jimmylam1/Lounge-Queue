import { Config, LoungeQueue } from "../types/db";
import { SuccessStatus, RoomInfo } from "../types/loungeQueue";
import { Player, QueuePlayer } from "../types/player";
import { dbConnect } from "./db/connect";
import { currentFullRoomsCount, playersNeededForFullRooms } from "./util";

export async function addPlayer(player: Player, messageId: string): Promise<SuccessStatus> {
    const res = await dbConnect(async db => {
        const queue = await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = ?", [messageId]).catch(e => console.error(`core.ts addPlayer select queue failed ${e}`))
        if (!queue)
            return {success: false, message: 'Unable to find the associated Lounge Queue'}
        if (!queue.active)
            return {success: false, message: 'Unable to join the queue because it is closed'}

        try {
            await db.execute("INSERT INTO players(queue, discordId, name, mmr) VALUES (?, ?, ?, ?)", [queue.id, player.discordId, player.name, player.mmr])
            return {success: true, message: `Successfully joined the queue`}
        }
        catch(e) {
            if (`${e}`.includes('UNIQUE constraint failed'))
                return {success: false, message: 'You are already in the queue'}
            console.error(`core.ts addPlayer insert failed ${e}`)
            return {success: false, message: 'There was a problem joining the queue'}
        }
    })

    return res
}

export async function removePlayer(player: Player, messageId: string): Promise<SuccessStatus> {
    const res = await dbConnect(async db => {
        const queue = await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = ?", [messageId]).catch(e => console.error(`core.ts removePlayer select queue failed ${e}`))
        if (!queue)
            return {success: false, message: 'Unable to find the associated Lounge Queue'}
        if (!queue.active)
            return {success: false, message: 'Unable to drop from the queue because it is closed'}

        try {
            var { changes } = await db.execute("DELETE FROM players WHERE discordId = ? AND queue = ?", [player.discordId, queue.id])
        }
        catch(e) {
            console.error(`core.ts removePlayer delete failed ${e}`)
            return {success: false, message: 'There was a problem dropping from the queue'}
        }

        if (changes === 1)
            return {success: true, message: `Successfully dropped from the queue`}
        return {success: false, message: 'You are not in the queue'}
    })

    return res
}

export async function list(messageId: string): Promise<string> {
    const res = await dbConnect(async db => {
        try {
            var queue = await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = ?", [messageId])
            var players = await db.fetchAll<QueuePlayer>("SELECT * FROM players WHERE queue = ? ORDER BY id ASC", [queue.id])
            var config = await db.fetchOne<Config>("SELECT * FROM config WHERE guildId = ?", [queue.guildId])
        }
        catch(e) {
            console.error(`core.ts list() ${e}`)
            return 'There was a problem listing the players in the queue'
        }

        let text = "`Queue List`\n\n";
        for (let i = 0; i < players.length; i++) {
            text += `${i+1}. ${players[i].name} (${players[i].mmr} MMR)\n`;
        }

        if (players.length % config.roomSize !== 0 || players.length === 0) {
            if (players.length)
                text += "\n"
            text += `(+${playersNeededForFullRooms(players.length, config.roomSize)} players for ${currentFullRoomsCount(players.length, config.roomSize) + 1} full rooms)`;
        }
        return text;
    })

    return res
}

export async function getRooms(messageId: string): Promise<RoomInfo> {
    const res = await dbConnect(async db => {
        try {
            var queue = await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = ?", [messageId])
            var list = await db.fetchAll<QueuePlayer>("SELECT * FROM players WHERE queue = ? ORDER BY id ASC", [queue.id])
            var config = await db.fetchOne<Config>("SELECT * FROM config WHERE guildId = ?", [queue.guildId])

        }
        catch(e) {
            return {rooms: [], latePlayers: []}
        }

        const eligiblePlayers = list.slice(0, currentFullRoomsCount(list.length, config.roomSize)*config.roomSize)
        eligiblePlayers.sort((a, b) => b.mmr - a.mmr)
        const rooms = []
        const latePlayers = list.slice(currentFullRoomsCount(list.length, config.roomSize)*config.roomSize, list.length);
        
        for (let i = 0; i < eligiblePlayers.length; i += config.roomSize) {
            const room = eligiblePlayers.slice(i, i+config.roomSize);
            rooms.push(room)
        }

        return {
            rooms,
            latePlayers
        }
    })

    return res
}

export async function openQueue(messageId: string) {
    const success = await dbConnect(async db => {
        const res = await db.execute("UPDATE loungeQueue SET active = 1 WHERE messageId = ?", [messageId])
        return res.changes === 1
    })
    return success
}

export async function closeQueue(messageId: string) {
    const success = await dbConnect(async db => {
        const res = await db.execute("UPDATE loungeQueue SET active = 0 WHERE messageId = ?", [messageId])
        return res.changes === 1
    })
    return success
}
