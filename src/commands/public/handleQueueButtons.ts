import { ButtonInteraction, GuildMember, Message } from "discord.js"
import { buttonEvent } from "../../common/discordEvents"
import { addPlayer, getRooms, removePlayer } from "../../common/core"
import { guildConfig } from "../../common/data/guildConfig"
import { replyToButton, reply } from "../../common/util"
import { Player } from "../../types/player"
import { updateLoungeQueueMessage } from "../../common/messageHelpers"
import { Cooldown } from "../../common/cooldown"

const buttonCooldown = new Cooldown(15)
buttonEvent.on('handleQueueButtons', async (interaction) => {
    if (buttonCooldown.onCooldown(interaction.user.id))
        return reply(interaction, {content: 'You are on a 15 second cooldown.', ephemeral: true})
            .catch(e => console.error(`handleQueueButtons.ts cooldown reply failed ${e}`))

    const args = interaction.customId.split("|")
    if (args[1] === 'join')
        handleJoin(interaction).catch(e => console.error(`handleQueueButtons.ts handleJoin()`, e))
    else if (args[1] === 'drop')
        handleDrop(interaction).catch(e => console.error(`handleQueueButtons.ts handleDrop()`, e))
    else if (args[1] === 'preview')
        handlePreview(interaction).catch(e => console.error(`handleQueueButtons.ts handlePreview()`, e))
})

async function handleJoin(interaction: ButtonInteraction) {
    if (!(interaction.member instanceof GuildMember))
        return
    
    await interaction.deferUpdate()

    const mmr = await guildConfig[interaction.guild!.id].getMmr(interaction.member.displayName)
    if (mmr === null)
        return replyToButton(interaction, {content: "Unable to join the queue because your MMR couldn't be found", ephemeral: true})

    const player: Player = {
        discordId: interaction.user.id, 
        name: interaction.member.displayName, 
        mmr
    }
    const res = await addPlayer(player, interaction.message.id)
    if (res.success && interaction.message instanceof Message)
        await updateLoungeQueueMessage(interaction.message, true)
    else {
        if (res.message === 'Unable to find the associated Lounge Queue' && interaction.message instanceof Message)
            await removeButtonsFromMessage(interaction.message).catch(e => console.error(`handleQueueButtons.ts handleJoin disableButtons ${e}`))
        await replyToButton(interaction, {content: res.message, ephemeral: true})
    }
}

async function handleDrop(interaction: ButtonInteraction) {
    if (!(interaction.member instanceof GuildMember))
        return

    await interaction.deferUpdate()
    
    const res = await removePlayer(interaction.user.id, interaction.message.id)
    if (res.success && interaction.message instanceof Message)
        await updateLoungeQueueMessage(interaction.message, true)
    else {
        if (res.message === 'Unable to find the associated Lounge Queue' && interaction.message instanceof Message)
            await removeButtonsFromMessage(interaction.message).catch(e => console.error(`handleQueueButtons.ts handleDrop disableButtons ${e}`))
        await replyToButton(interaction, {content: res.message, ephemeral: true})
    }
}

async function handlePreview(interaction: ButtonInteraction) {
    if (!(interaction.member instanceof GuildMember) || !interaction.guild)
        return

    await interaction.deferReply({ephemeral: true})

    const roomInfo = await getRooms(interaction.message.id)
    if (!roomInfo.queue && interaction.message instanceof Message)
        await removeButtonsFromMessage(interaction.message).catch(e => console.error(`handleQueueButtons.ts handlePreview disableButtons ${e}`))
    let text = ''
    for (let i = 0; i < roomInfo.rooms.length; i++) {
        const room = roomInfo.rooms[i]
        text += `**Room ${i+1}**\n`
        for (let j = 0; j < room.length; j++) {
            text += `${j+1}. ${room[j].name} (${room[j].mmr} MMR)\n`
        }
    }
    if (roomInfo.latePlayers.length) {
        const players = roomInfo.latePlayers
        text += `**Late Players**\n`
        for (let j = 0; j < players.length; j++) {
            text += `${j+1}. ${players[j].name} (${players[j].mmr} MMR)\n`
        }
    }

    if (!text)
        text = 'There are no players in the queue\n'
    
    const count = guildConfig[interaction.guild.id].minFullRooms
    if (roomInfo.rooms.length < count) {
        text += `\n-# **The queue will be cancelled if there is less than ${count} ${count>1 ? 'rooms' : 'room'}.**`
    }

    await reply(interaction, text)
}

async function removeButtonsFromMessage(message: Message) {
    const embed = message.embeds[0]
    embed.color = null
    await message.edit({embeds: [embed], components: []})
}