import Discord from "discord.js";
import { SlashReplyOptions } from "../types/util";

export function currentFullRoomsCount(playerCount: number, roomSize: number) {
    return Math.floor(playerCount / roomSize);
}

export function playersNeededForFullRooms(playerCount: number, roomSize: number) {
    if (playerCount > 0 && playerCount % roomSize === 0)
        return 0
    return roomSize - (playerCount % roomSize);
}

export async function slashReply(interaction: Discord.CommandInteraction, interactionOptions: string | Discord.InteractionEditReplyOptions | Discord.InteractionReplyOptions, options?: SlashReplyOptions) {
    try {
        if (interaction.deferred) 
            await interaction.editReply(interactionOptions)
        else
            await interaction.reply(interactionOptions)

        if (options?.deleteTime && options.deleteTime > 0) {
            setTimeout(() => {
                interaction.deleteReply().catch(e => console.error(`slashReply delete failed: ${e}`))
            }, options.deleteTime)
        }
    }
    catch(e) {
        let text = `slashReply() failed: ${e}\n`
                 + `Command: ${interaction.commandName}\n`
        if (interaction.guild)
            text += `Guild name: ${interaction.guild.name}`
        console.error(text)
    }
}