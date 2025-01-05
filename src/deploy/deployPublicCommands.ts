import dotenv from "dotenv";
import { REST } from '@discordjs/rest';
import { Routes } from "discord-api-types/v10";
import { commandData } from "../managers/publicCommands";
dotenv.config();

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);
const commandNames = commandData.map(i => "    /" + i.name)
commandNames.sort()

rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: commandData })
    .then(() => {
        console.log(`Successfully registered ${commandData.length} application commands globally:\n${commandNames.join("\n")}\n\nIf commands are missing, add them in the managers folder`)
    })
    .catch(console.error);

