import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { Player, QueuePlayer } from "../src/types/player";
import { dbConnect } from "../src/common/db/connect";
import { addPlayer, closeQueue, getRooms, list, openQueue, removePlayer } from "../src/common/core";
import initDb from "../src/common/db/init";
import { LoungeQueue } from '../src/types/db';
import { spyOn } from 'jest-mock';

const RESPONSES = {
    missingLQ: {success: false, message: 'Unable to find the associated Lounge Queue'},
    joinClosed: {success: false, message: 'Unable to join the queue because it is closed'},//
    joinSuccess: {success: true, message: `Successfully joined the queue`},//
    alreadyInQueue: {success: false, message: 'You are already in the queue'},//
    joinError: {success: false, message: 'There was a problem joining the queue'},
    dropClosed: {success: false, message: 'Unable to drop from the queue because it is closed'},//
    dropError: {success: false, message: 'There was a problem dropping from the queue'},
    dropSuccess: {success: true, message: `Successfully dropped from the queue`},//
    notInQueue: {success: false, message: 'You are not in the queue'},//
}
const GUILD_ID = '0'

function initPlayers(count: number) {
    const players: Player[] = []
    for (let i = 0; i < count; i++) {
        players.push({discordId: i.toString(), name: `Player ${i+1}`, mmr: 750 + 250*i})
    }
    return players
}

async function queueSize() {
    return await dbConnect(async db => {
        const queue = await db.fetchOne<LoungeQueue>("SELECT id FROM loungeQueue WHERE messageId = 0")
        if (!queue)
            return -1
        const players = await db.fetchAll<QueuePlayer>("SELECT * FROM players WHERE queue = ?", [queue.id])
        return players.length
    })
}

describe('loungeQueueTests', () => {
    beforeAll(async () => {
        await initDb()
        await dbConnect(async db => {
            await db.execute(`INSERT INTO loungeQueue (guildId, channelId, messageId, startTime, active)
                VALUES (?, ?, ?, ?, ?)`, [GUILD_ID, "0", "0", 0, 1])
            await db.execute(`INSERT INTO loungeQueue (guildId, channelId, messageId, startTime, active)
                VALUES (?, ?, ?, ?, ?)`, [GUILD_ID, "0", "1", 0, 1])
        })
    })
    
    afterAll(async () => {
        await dbConnect(async db => {
            const queue0 = await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = 0")
            const queue1 = await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = 1")
            if (queue0 && queue1)
                await db.execute("DELETE FROM players WHERE queue = ? OR queue = ?", [queue0.id, queue1.id])
            await db.execute("DELETE FROM loungeQueue WHERE messageId = 0 OR messageId = 1")
        })
    })

    const players = initPlayers(20)

    test('Test LoungeQueue add/remove 1 player', async () => {
        await expect(addPlayer(players[0], "0")).resolves.toStrictEqual(RESPONSES.joinSuccess)
        await expect(addPlayer(players[0], "0")).resolves.toStrictEqual(RESPONSES.alreadyInQueue)
        await expect(queueSize()).resolves.toEqual(1)
    
        await expect(removePlayer(players[0].discordId, "0")).resolves.toStrictEqual(RESPONSES.dropSuccess)
        await expect(removePlayer(players[0].discordId, "0")).resolves.toStrictEqual(RESPONSES.notInQueue)
        await expect(queueSize()).resolves.toEqual(0)
    })

    test('Test LoungeQueue add/remove 1 player with active flag change', async () => {
        await closeQueue('0')
        await expect(addPlayer(players[0], "0")).resolves.toStrictEqual(RESPONSES.joinClosed)
        await openQueue('0')
        await expect(addPlayer(players[0], "0")).resolves.toStrictEqual(RESPONSES.joinSuccess)
        await expect(queueSize()).resolves.toEqual(1)

        await closeQueue('0')
        await expect(removePlayer(players[0].discordId, "0")).resolves.toStrictEqual(RESPONSES.dropClosed)
        await expect(queueSize()).resolves.toEqual(1)
        await openQueue('0')
        await expect(removePlayer(players[0].discordId, "0")).resolves.toStrictEqual(RESPONSES.dropSuccess)
        await expect(queueSize()).resolves.toEqual(0)
    })

    test('Test LoungeQueue add/remove 20 players', async () => {
        for (let i = 0; i < players.length; i++) {
            await expect(addPlayer(players[i], '0')).resolves.toStrictEqual(RESPONSES.joinSuccess)
        }
        await expect(queueSize()).resolves.toEqual(20)
        for (let i = 0; i < players.length; i++) {
            await expect(addPlayer(players[0], '0')).resolves.toStrictEqual(RESPONSES.alreadyInQueue)
        }
        await expect(queueSize()).resolves.toEqual(20)
        
        for (let i = 0; i < players.length; i++) {
            await expect(removePlayer(players[i].discordId, '0')).resolves.toStrictEqual(RESPONSES.dropSuccess)
        }
        await expect(queueSize()).resolves.toEqual(0)
        for (let i = 0; i < players.length; i++) {
            await expect(removePlayer(players[i].discordId, '0')).resolves.toStrictEqual(RESPONSES.notInQueue)
        }
        await expect(queueSize()).resolves.toEqual(0)
    })

    test('Test LoungeQueue add/remove 10 players with active flag change', async () => {
        for (let i = 0; i < 10; i++) {
            await expect(addPlayer(players[i], '0')).resolves.toStrictEqual(RESPONSES.joinSuccess)
        }
        await expect(queueSize()).resolves.toEqual(10)

        await closeQueue('0')
        for (let i = 10; i < players.length; i++) {
            await expect(addPlayer(players[i], '0')).resolves.toStrictEqual(RESPONSES.joinClosed)
        }
        await expect(queueSize()).resolves.toEqual(10)
        
        for (let i = 0; i < 10; i++) {
            await expect(removePlayer(players[i].discordId, '0')).resolves.toStrictEqual(RESPONSES.dropClosed)
        }
        await expect(queueSize()).resolves.toEqual(10)

        await openQueue('0')
        for (let i = 0; i < 10; i++) {
            await expect(removePlayer(players[i].discordId, '0')).resolves.toStrictEqual(RESPONSES.dropSuccess)
        }
        await expect(queueSize()).resolves.toEqual(0)
    })

    test('Test LoungeQueue list players', async () => {
        // incorrect queue, supress console error
        const spy = spyOn(console, 'error').mockImplementation(() => {})
        await expect(list('2')).resolves.toHaveProperty('message', 'There was a problem listing the players in the queue')
        spy.mockRestore()

        // 0 players
        let expected = "`Queue List`\n"
                     + "\n"
                     + "(+8 players for 1 full rooms)"
        await expect(list('0')).resolves.toHaveProperty('message', expected)

        // 1 player
        await addPlayer(players[0], '0')
        expected = "`Queue List`\n"
        + "\n"
        + "1. Player 1 (750 MMR)\n"
        + "\n"
        + "(+7 players for 1 full rooms)"
        await expect(list('0')).resolves.toHaveProperty('message', expected)

        // 7 players
        for (let i = 1; i < 7; i++) {
            await addPlayer(players[i], '0')
        }
        expected = "`Queue List`\n"
        + "\n"
        + "1. Player 1 (750 MMR)\n"
        + "2. Player 2 (1000 MMR)\n"
        + "3. Player 3 (1250 MMR)\n"
        + "4. Player 4 (1500 MMR)\n"
        + "5. Player 5 (1750 MMR)\n"
        + "6. Player 6 (2000 MMR)\n"
        + "7. Player 7 (2250 MMR)\n"
        + "\n"
        + "(+1 players for 1 full rooms)"
        await expect(list('0')).resolves.toHaveProperty('message', expected)

        // 8 players
        await addPlayer(players[7], '0')
        expected = "`Queue List`\n"
        + "\n"
        + "1. Player 1 (750 MMR)\n"
        + "2. Player 2 (1000 MMR)\n"
        + "3. Player 3 (1250 MMR)\n"
        + "4. Player 4 (1500 MMR)\n"
        + "5. Player 5 (1750 MMR)\n"
        + "6. Player 6 (2000 MMR)\n"
        + "7. Player 7 (2250 MMR)\n"
        + "8. Player 8 (2500 MMR)\n"
        await expect(list('0')).resolves.toHaveProperty('message', expected)

        // 9 players
        await addPlayer(players[8], '0')
        expected = "`Queue List`\n"
        + "\n"
        + "1. Player 1 (750 MMR)\n"
        + "2. Player 2 (1000 MMR)\n"
        + "3. Player 3 (1250 MMR)\n"
        + "4. Player 4 (1500 MMR)\n"
        + "5. Player 5 (1750 MMR)\n"
        + "6. Player 6 (2000 MMR)\n"
        + "7. Player 7 (2250 MMR)\n"
        + "8. Player 8 (2500 MMR)\n"
        + "9. Player 9 (2750 MMR)\n"
        + "\n"
        + "(+7 players for 2 full rooms)"
        await expect(list('0')).resolves.toHaveProperty('message', expected)

        // player 7 drops
        await removePlayer(players[6].discordId, '0')
        expected = "`Queue List`\n"
        + "\n"
        + "1. Player 1 (750 MMR)\n"
        + "2. Player 2 (1000 MMR)\n"
        + "3. Player 3 (1250 MMR)\n"
        + "4. Player 4 (1500 MMR)\n"
        + "5. Player 5 (1750 MMR)\n"
        + "6. Player 6 (2000 MMR)\n"
        + "7. Player 8 (2500 MMR)\n"
        + "8. Player 9 (2750 MMR)\n"
        await expect(list('0')).resolves.toHaveProperty('message', expected)
    })

    function queuePlayersToPlayer(queuePlayers: QueuePlayer[]): Player[] {
        return queuePlayers.map(p => ({discordId: p.discordId, name: p.name, mmr: p.mmr}))
    }

    function reversePlayerArray(arr: Player[]) {
        let ret = []
        for (let i = arr.length - 1; i >= 0; i--) {
            ret.push(arr[i])
        }
        return ret
    }

    test("Test LoungeQueue getRooms()", async () => {
        await dbConnect(async db => {
            const queue = await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = 0")
            if (queue)
                await db.execute("DELETE FROM players WHERE queue = ?", [queue.id])
        })

        let rooms: Player[][] = []
        let latePlayers: Player[] = []

        // 0 players
        let res = await getRooms('0')
        expect(res.rooms.length).toEqual(0)
        expect(queuePlayersToPlayer(res.latePlayers)).toEqual(latePlayers)

        // 1 player
        await addPlayer(players[0], '0')
        latePlayers.push(players[0])
        res = await getRooms('0')
        expect(res.rooms.length).toEqual(0)
        expect(queuePlayersToPlayer(res.latePlayers)).toEqual(latePlayers)

        // 7 players
        for (let i = 1; i < 7; i++) {
            await addPlayer(players[i], '0')
            latePlayers.push(players[i])
        }
        res = await getRooms('0')
        expect(res.rooms.length).toEqual(0)
        expect(queuePlayersToPlayer(res.latePlayers)).toEqual(latePlayers)

        // 8 players
        await addPlayer(players[7], '0')
        latePlayers.push(players[7])
        rooms.push(latePlayers)
        latePlayers = []
        res = await getRooms('0')
        expect(queuePlayersToPlayer(res.latePlayers)).toEqual(latePlayers)

        // 9 players
        await addPlayer(players[8], '0')
        latePlayers.push(players[8])
        res = await getRooms('0')
        expect(queuePlayersToPlayer(res.rooms[0])).toEqual(reversePlayerArray(rooms[0]))
        expect(queuePlayersToPlayer(res.latePlayers)).toEqual(latePlayers)

        // 16 players
        for (let i = 9; i < 16; i++) {
            await addPlayer(players[i], '0')
            latePlayers.push(players[i])
        }
        rooms.push(latePlayers)
        latePlayers = []
        res = await getRooms('0')
        expect(queuePlayersToPlayer(res.rooms[1])).toEqual(reversePlayerArray(rooms[0]))
        expect(queuePlayersToPlayer(res.rooms[0])).toEqual(reversePlayerArray(rooms[1]))
        expect(queuePlayersToPlayer(res.latePlayers)).toEqual(latePlayers)

        // player 7 drops, down to 15 players
        const removedPlayer = await removePlayer(players[6].discordId, '0')
        expect(removedPlayer.success).toEqual(true)
        rooms[0] = rooms[0].filter(p => p.discordId !== '6')
        const removed = rooms[1].shift()
        if (removed)
            rooms[0].push(removed)

        latePlayers = rooms.pop() || []
        res = await getRooms('0')
        expect(queuePlayersToPlayer(res.rooms[0])).toEqual(reversePlayerArray(rooms[0]))
        expect(queuePlayersToPlayer(res.latePlayers)).toEqual(latePlayers)
    })

    test("Test LoungeQueue 2 simultaneous queues", async () => {
        await dbConnect(async db => {
            const queue = await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = 0")
            if (queue)
                await db.execute("DELETE FROM players WHERE queue = ?", [queue.id])
        })

        let room0: Player[] = []
        let room1: Player[] = []

        for (let i = 0; i < 16; i++) {
            if (i % 2 === 0) {
                await addPlayer(players[i], '0')
                room0.unshift(players[i])
            }
            else {
                await addPlayer(players[i], '1')
                room1.unshift(players[i])
            }
        }

        const res0 = await getRooms('0')
        const res1 = await getRooms('1')

        expect(queuePlayersToPlayer(res0.rooms[0])).toEqual(room0)
        expect(queuePlayersToPlayer(res1.rooms[0])).toEqual(room1)
    })
})
