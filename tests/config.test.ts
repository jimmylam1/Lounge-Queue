import { afterAll, describe, expect, test } from "@jest/globals"
import { dbConnect } from "../src/common/db/connect"
import { listConfig } from "../src/common/commands/config"

const GUILD_ID = '1'

describe('config tests', () => {
    afterAll(async () => {
        await dbConnect(async db => {
            await db.execute(`DELETE FROM config WHERE guildId = ${GUILD_ID}`)
            await db.execute(`DELETE FROM staffRoles WHERE guildId = ${GUILD_ID}`)
        })
    })
    
    test('Test listing config', async () => {
        await dbConnect(async db => {
            await db.execute(`INSERT OR IGNORE INTO config (guildId, minFullRooms, roomSize) VALUES (?, ?, ?)`, [GUILD_ID, 1, 8])
        })
    
        // base case
        let expected = "`Server configuration`\n"
                     + `min-full-rooms: 1\n`
                     + `room-size: 8\n`
                     + `queue-staff: None\n`
        await expect(listConfig(GUILD_ID)).resolves.toEqual(expected)
    
        // change config table
        await dbConnect(async db => {
            await db.execute(`UPDATE config SET minFullRooms = ?, roomSize = ? WHERE guildId = ?`, [2, 12, GUILD_ID])
        })
        expected = "`Server configuration`\n"
                 + `min-full-rooms: 2\n`
                 + `room-size: 12\n`
                 + `queue-staff: None\n`
        await expect(listConfig(GUILD_ID)).resolves.toEqual(expected)
    
        // add 1 staff role
        await dbConnect(async db => {
            await db.execute(`INSERT INTO staffRoles (roleDiscordId, guildId) VALUES (?, ?)`, ['11111', GUILD_ID])
        })
        expected = "`Server configuration`\n"
                 + `min-full-rooms: 2\n`
                 + `room-size: 12\n`
                 + `queue-staff: <@&11111>\n`
        await expect(listConfig(GUILD_ID)).resolves.toEqual(expected)
    
        // add another staff role
        await dbConnect(async db => {
            await db.execute(`INSERT INTO staffRoles (roleDiscordId, guildId) VALUES (?, ?)`, ['22222', GUILD_ID])
        })
        expected = "`Server configuration`\n"
                    + `min-full-rooms: 2\n`
                    + `room-size: 12\n`
                    + `queue-staff: <@&11111>, <@&22222>\n`
        await expect(listConfig(GUILD_ID)).resolves.toEqual(expected)
    
        // cleanup
    })
})
