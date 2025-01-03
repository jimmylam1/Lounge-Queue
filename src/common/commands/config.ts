import { dbConnect } from "../db/connect"
import { Config, StaffRoles } from "../../types/db";

export async function listConfig(guildId: string) {
    let res = await dbConnect(async db => {
        const config = await db.fetchOne<Config>("SELECT * FROM config WHERE guildId = ?", [guildId])
        const staffRoles = await db.fetchAll<StaffRoles>("SELECT * FROM staffRoles WHERE guildId = ?", [guildId])
        return { config, staffRoleIds: staffRoles.map(r => r.roleDiscordId) }
    }).catch(e => console.error(`config.ts list() ${e}`))

    if (!res)
        return 'There was a problem listing the server configuration'
    
    let text = "`Server configuration`\n"
             + `min-full-rooms: ${res.config.minFullRooms}\n`
             + `room-size: ${res.config.roomSize}\n`
             + `queue-staff: ${res.staffRoleIds.map(r => `<@&${r}>`).join(", ") || "None"}\n`
    return text
}