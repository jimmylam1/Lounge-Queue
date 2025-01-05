import { ApplicationCommandData, CommandInteraction, GuildMember } from "discord.js";
import { slashCommandEvent } from "../../common/discordEvents";
import { slashReply } from "../../common/util";
import { dbConnect } from "../../common/db/connect";
import { Rooms } from "../../types/db";

export const data: ApplicationCommandData = {
    name: "scoreboard",
    description: "Get the scoreboard for the lounge queue channel",
}

slashCommandEvent.on(data.name, async (interaction) => {
    handleScoreboard(interaction).catch(e => console.error(`scoreboard.ts handleScoreboard()`, e))
})

async function handleScoreboard(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const res = await dbConnect(async db => {
        return await db.fetchOne<Rooms>("SELECT * FROM rooms WHERE roomChannelId = ?", [interaction.channel!.id])
    })

    if (!res?.scoreboard)
        await slashReply(interaction, `There is no scoreboard available for this channel`, {deleteTime: 5000})
    else 
        await slashReply(interaction, res.scoreboard)
}
