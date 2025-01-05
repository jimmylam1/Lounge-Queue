import { GuildMember } from "discord.js"
import { dbConnect } from "./db/connect"
import { StaffRoles } from "../types/db"

export async function canManageLoungeQueue(member: GuildMember, guildId: string) {
    const roles = await dbConnect(async db => {
        return await db.fetchAll<StaffRoles>(`SELECT * FROM staffRoles WHERE guildId = ?`, [guildId])
    }).catch(e => console.error(`helper.ts canManageLoungeQueue() ${e}`)) || []
    
    const roleIds = new Set(roles.map(r => r.roleDiscordId))
    if (member.roles.cache.some(role => roleIds.has(role.id)))
        return true
    return false
}