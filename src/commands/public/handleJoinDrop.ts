import { ButtonInteraction, GuildMember, Message } from "discord.js"
import { buttonEvent } from "../../common/discordEvents"
import { addPlayer, removePlayer } from "../../common/core"
import { guildConfig } from "../../common/data/guildConfig"
import { replyButton } from "../../common/util"
import { Player } from "../../types/player"
import { updateLoungeQueueMessage } from "../../common/messageHelpers"

buttonEvent.on('handleJoinDrop', async (interaction) => {
    const args = interaction.customId.split("|")
    if (args[1] === 'join')
        handleJoin(interaction).catch(e => console.error(`handleJoinDrop.ts handleJoin()`, e))
    else if (args[1] === 'drop')
        handleDrop(interaction).catch(e => console.error(`handleJoinDrop.ts handleDrop()`, e))
})

async function handleJoin(interaction: ButtonInteraction) {
    if (!(interaction.member instanceof GuildMember))
        return
    
    await interaction.deferUpdate()

    const mmr = await guildConfig[interaction.guild!.id].getMmr(interaction.member.displayName)
    if (!mmr)
        return replyButton(interaction, {content: "Unable to join the queue because your MMR couldn't be found", ephemeral: true})

    const player: Player = {
        discordId: interaction.user.id, 
        name: interaction.member.displayName, 
        mmr
    }
    const res = await addPlayer(player, interaction.message.id)
    if (res.success && interaction.message instanceof Message)
        await updateLoungeQueueMessage(interaction.message, true)
    else
        await replyButton(interaction, {content: res.message, ephemeral: true})
}

async function handleDrop(interaction: ButtonInteraction) {
    if (!(interaction.member instanceof GuildMember))
        return

    await interaction.deferUpdate()
    
    const res = await removePlayer(interaction.user.id, interaction.message.id)
    if (res.success && interaction.message instanceof Message)
        await updateLoungeQueueMessage(interaction.message, true)
    else
        await replyButton(interaction, {content: res.message, ephemeral: true})
}