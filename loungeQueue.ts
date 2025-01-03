import dotenv from "dotenv";
import Discord from "discord.js";
import { buttonEvent, slashCommandEvent } from "./src/common/discordEvents";
dotenv.config();

const client = new Discord.Client({
    intents: ["GUILDS", "GUILD_MESSAGES"],
});

client.login(process.env.TOKEN)

client.once('ready', (client) => {
    console.log(`Logged in as ${client.user.tag}!`)
})

client.on('interactionCreate', (interaction) => {
    // todo: create a file to get mmr for a guild, slashreply if guild not implemented
    if (!interaction.guild)
        return
    if (interaction.isCommand()) {
        slashCommandEvent.emit(interaction.commandName, interaction)
    }
    else if (interaction.isButton()) {
        buttonEvent.emit(interaction.customId.split("|")[0], interaction)
    }
})
