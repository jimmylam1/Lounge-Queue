import { afterAll, describe, expect, test } from "@jest/globals"
import { dbConnect } from "../src/common/db/connect"
import { listConfig } from "../src/common/textFormatters"

const GUILD_ID = '0'

describe('config tests', () => {
    afterAll(async () => {
        await dbConnect(async db => {
            await db.execute(`DELETE FROM staffRoles WHERE guildId = ${GUILD_ID}`)
        })
    })
    
    test('Test listing config', async () => {
        // base case
        let expected = "`Server configuration`\n"
                     + `queue-staff: None\n`
                     + `join-channel: None\n`
                     + '\n'
                     + 'The config options below can only be set by the bot developer\n'
                     + `min-full-rooms: 1\n`
                     + `room-size: 8\n`
                     + `formats: FFA, 2v2, 4v4\n`
        await expect(listConfig(GUILD_ID)).resolves.toEqual(expected)
    
        // add 1 staff role
        await dbConnect(async db => {
            await db.execute(`INSERT INTO staffRoles (roleDiscordId, guildId) VALUES (?, ?)`, ['11111', GUILD_ID])
        })
        expected = "`Server configuration`\n"
                 + `queue-staff: <@&11111>\n`
                 + `join-channel: None\n`
                 + '\n'
                 + 'The config options below can only be set by the bot developer\n'
                 + `min-full-rooms: 1\n`
                 + `room-size: 8\n`
                 + `formats: FFA, 2v2, 4v4\n`
        await expect(listConfig(GUILD_ID)).resolves.toEqual(expected)
    
        // add another staff role
        await dbConnect(async db => {
            await db.execute(`INSERT INTO staffRoles (roleDiscordId, guildId) VALUES (?, ?)`, ['22222', GUILD_ID])
        })
        expected = "`Server configuration`\n"
                 + `queue-staff: <@&11111>, <@&22222>\n`
                 + `join-channel: None\n`
                 + '\n'
                 + 'The config options below can only be set by the bot developer\n'
                 + `min-full-rooms: 1\n`
                 + `room-size: 8\n`
                 + `formats: FFA, 2v2, 4v4\n`
        await expect(listConfig(GUILD_ID)).resolves.toEqual(expected)
    })
})
