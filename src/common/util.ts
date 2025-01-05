import { ButtonInteraction, CommandInteraction, InteractionEditReplyOptions, InteractionReplyOptions, Message } from "discord.js";
import { ReplyOptions } from "../types/util";
import { promisify } from "util";
import { QueuePlayer } from "../types/player";

export const sleep = promisify(setTimeout);

export function currentFullRoomsCount(playerCount: number, roomSize: number) {
    return Math.floor(playerCount / roomSize);
}

export function playersNeededForFullRooms(playerCount: number, roomSize: number) {
    if (playerCount > 0 && playerCount % roomSize === 0)
        return 0
    return roomSize - (playerCount % roomSize);
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

async function interactionRespond(interaction: CommandInteraction | ButtonInteraction, interactionOptions: string | InteractionEditReplyOptions | InteractionReplyOptions, options?: ReplyOptions) {
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
export async function slashReply(interaction: CommandInteraction, interactionOptions: string | InteractionEditReplyOptions | InteractionReplyOptions, options?: ReplyOptions) {
    await interactionRespond(interaction, interactionOptions, options).catch(e => {
        let text = `slashReply() failed: ${e}\n`
                 + `Command: ${interaction.commandName}\n`
        if (interaction.guild)
            text += `Guild name: ${interaction.guild.name}`
        console.error(text)
    })
}
export async function editButtonMessage(interaction: ButtonInteraction, interactionOptions: string | InteractionEditReplyOptions | InteractionReplyOptions, options?: ReplyOptions) {
    await interactionRespond(interaction, interactionOptions, options).catch(e => {
        let text = `editButtonMessage() failed: ${e}\n`
        if (interaction.guild)
            text += `Guild name: ${interaction.guild.name}`
        console.error(text)
    })
}
export async function replyButton(interaction: ButtonInteraction, interactionOptions: string | InteractionEditReplyOptions | InteractionReplyOptions, options?: ReplyOptions) {
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