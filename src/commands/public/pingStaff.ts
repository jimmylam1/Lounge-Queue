import { ApplicationCommandData, CommandInteraction, GuildMember, ThreadChannel } from "discord.js";
import { slashCommandEvent } from "../../common/discordEvents";
import { reply } from "../../common/util";
import { dbConnect } from "../../common/db/connect";
import { StaffRoles } from "../../types/db";

export const data: ApplicationCommandData = {
    name: "ping-staff",
    description: "Ping staff if you need their assistance",
}

slashCommandEvent.on(data.name, async (interaction) => {
    handlePing(interaction).catch(e => console.error(`pingStaff.ts handlePing()`, e))
})

async function handlePing(interaction: CommandInteraction) {
    if (!(interaction.member instanceof GuildMember))
        return
    if (!(interaction.channel instanceof ThreadChannel))
        return reply(interaction, {content: "This command is only available inside a thread channel", ephemeral: true})

    await interaction.deferReply()

    const roles = await dbConnect(async db => {
        return await db.fetchAll<StaffRoles>(`SELECT * FROM staffRoles WHERE guildId = ?`, [interaction.guild!.id])
    }).catch(e => console.error(`pingStaff.ts fetch roles ${e}`)) || []
    const pings = roles.map(r => `<@&${r.roleDiscordId}>`).join(" ")
    const roleIds = roles.map(r => r.roleDiscordId)
    
    if (!roles.length)
        return reply(interaction, 'There is no staff to ping')
    return reply(interaction, {content: pings, allowedMentions: {roles: roleIds}})
}
