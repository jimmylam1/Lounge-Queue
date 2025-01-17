import { ButtonInteraction, CommandInteraction, InteractionEditReplyOptions, InteractionReplyOptions, Message } from "discord.js";
import { ReplyOptions } from "../types/util";
import { promisify } from "util";
import { QueuePlayer } from "../types/player";
import { FormatOption } from "../types/guildConfig";

export const sleep = promisify(setTimeout);

export function currentFullRoomsCount(playerCount: number, roomSize: number) {
    return Math.floor(playerCount / roomSize);
}

export function playersNeededForFullRooms(playerCount: number, roomSize: number) {
    if (playerCount > 0 && playerCount % roomSize === 0)
        return 0
    return roomSize - (playerCount % roomSize);
}

export function isFormatOption(format: string): format is FormatOption {
    const formats = ['FFA', '2v2', '3v3', '4v4', '5v5', '6v6']
    return formats.includes(format)
}

/**
 * Uses the Fisher-Yates Shuffle Algorithm to randomly shuffle the array
 */
export function shuffleArray<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [arr[i], arr[j]] = [arr[j], arr[i]]; 
    } 
    return arr;
}

export function findRoomMmr(teams: QueuePlayer[][]) {
    let totalMmr = 0
    let count = 0
    for (let team of teams) {
        for (let player of team) {
            totalMmr += player.mmr
            count++
        }
    }
    return Math.round(totalMmr / count)
}

export function findTeamMmr(team: QueuePlayer[]) {
    let totalMmr = 0
    let count = 0
    for (let player of team) {
        totalMmr += player.mmr
        count++
    }
    return Math.round(totalMmr / count)
}

/**
 * Finds the next hour. For example, if the current time is 9:41:31, this will return 10:00:00
 */
export function findNextHour() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
}

/**
 * Finds the next 10 seconds. For example, if the current time is 9:12:31, this will return 9:12:40
 */
export function findNext10Seconds() {
    const now = new Date();
    const count = Math.floor(now.getSeconds() / 10)
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 10*(count+1));
}

/**
 * Reply to an interaction, whether a slash command or a button press. If button, will update message if function called interaction.deferUpdate()
 */
export async function reply(interaction: CommandInteraction | ButtonInteraction, interactionOptions: string | InteractionEditReplyOptions | InteractionReplyOptions, options?: ReplyOptions) {
    try {
        if (interaction.deferred) 
            await interaction.editReply(interactionOptions)
        else
            await interaction.reply(interactionOptions)
    
        if (options?.deleteTime && options.deleteTime > 0 && !interaction.ephemeral) {
            setTimeout(() => {
                interaction.deleteReply().catch(e => console.error(`interactionRespond() delete failed: ${e}`))
            }, options.deleteTime)
        }
    }
    catch(e) {
        let text = `util.ts reply() failed: ${e}\n`
        if (interaction instanceof CommandInteraction)
            text += `Command: ${interaction.commandName}\n`
        else
            text += `Button: ${interaction.customId}\n`
        if (interaction.guild)
            text += `Guild name: ${interaction.guild.name}`
        console.error(text)
    }
}

/**
 * Reply to the pressed button. Use this instead of reply() if you intend on first using deferUpdate(),
 * like to not send a response by default, but then need to reply back to the user. 
 */
export async function replyToButton(interaction: ButtonInteraction, interactionOptions: string | InteractionEditReplyOptions | InteractionReplyOptions, options?: ReplyOptions) {
    try {
        const message = await interaction.followUp(interactionOptions)
        if (options?.deleteTime && options.deleteTime > 0 && !interaction.ephemeral && message instanceof Message) {
            setTimeout(() => {
                message.delete().catch(e => console.error(`replyButton() delete failed: ${e}`))
            }, options.deleteTime)
        }
    }
    catch(e) {
        let text = `replyButton() failed: ${e}\n`
        if (interaction.guild)
            text += `Guild name: ${interaction.guild.name}`
        console.error(text)
    }
}