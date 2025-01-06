import dotenv from "dotenv";
import { Client } from "discord.js";
import { autocompleteEvent, buttonEvent, slashCommandEvent } from "./src/common/discordEvents";
import { guildConfig } from "./src/common/data/guildConfig";
import { replyToButton, reply } from "./src/common/util";
import './src/managers/publicCommands';
import initDb from "./src/common/db/init";
import { runInterval } from "./src/managers/interval";
dotenv.config();
initDb()

const client = new Client({
    intents: ["GUILDS", "GUILD_MESSAGES"],
});

client.login(process.env.TOKEN)

client.once('ready', (client) => {
    console.log(`Logged in as ${client.user.tag}!`)
    runInterval(client)
})

client.on('interactionCreate', (interaction) => {
    if (!interaction.guild)
        return

    if (interaction.isCommand()) {
        if (!guildConfig[interaction.guild.id]) 
            return reply(interaction, {content: `This server is not set up to use this bot. Contact jimmy5440 for more info.`, ephemeral: true})
        slashCommandEvent.emit(interaction.commandName, interaction)
    }

    else if (interaction.isButton()) {
        if (!guildConfig[interaction.guild.id]) 
            return replyToButton(interaction, {content: `This server is not set up to use this bot. Contact jimmy5440 for more info.`, ephemeral: true})
        buttonEvent.emit(interaction.customId.split("|")[0], interaction)
    }
    else if (interaction.isAutocomplete()) {
        if (!guildConfig[interaction.guild.id]) 
            return interaction.respond([]).catch(e => console.error(`loungeQueue.ts autocomplete !guildConfig[interaction.guild.id] failed ${e}`))
        autocompleteEvent.emit(interaction.commandName, interaction)
    }
})
