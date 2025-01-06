import { ApplicationCommandData, CommandInteraction, Constants } from "discord.js";
import { slashCommandEvent } from "../../common/discordEvents";
import { reply } from "../../common/util";
import { dbConnect } from "../../common/db/connect";
import { listConfig } from "../../common/textFormatters";

export const data: ApplicationCommandData = {
    name: "config",
    description: "View or edit server configuration. Requires Manage Roles permission",
    options: [
        {
            name: "list",
            description: "View server configuration settings. Requires Manage Roles permission",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
        },
        {
            name: "queue-staff",
            description: "Add or remove Lounge Queue staff roles. Requires Manage Roles permission",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
            options: [
                {
                    name: "add-role",
                    description: "Add a role",
                    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                    options: [
                        {
                            name: "role",
                            description: "The role to add",
                            required: true,
                            type: Constants.ApplicationCommandOptionTypes.ROLE
                        },
                    ],
                },
                {
                    name: "remove-role",
                    description: "remove a role",
                    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                    options: [
                        {
                            name: "role",
                            description: "The role to remove",
                            required: true,
                            type: Constants.ApplicationCommandOptionTypes.ROLE
                        },
                    ],
                },
            ]
        },
    ]
}

slashCommandEvent.on(data.name, async (interaction) => {
    if (!interaction.memberPermissions?.has('MANAGE_ROLES'))
        return reply(interaction, {content: 'You need to have Manage Roles permission to use this command', ephemeral: true})
            .catch(e => console.error(`config.ts MANAGE_ROLES reply`, e))
    if (interaction.options.getSubcommand() == "list")
        handleList(interaction).catch(e => console.error(`config.ts handleList()`, e))
    else if (interaction.options.getSubcommand() == "add-role")
        handleAddStaff(interaction).catch(e => console.error(`config.ts handleAddStaff()`, e))
    else if (interaction.options.getSubcommand() == "remove-role")
        handleRemoveStaff(interaction).catch(e => console.error(`config.ts handleRemoveStaff()`, e))
})

async function handleList(interaction: CommandInteraction) {
    await interaction.deferReply()

    let text = await listConfig(interaction.guild!.id)
    await reply(interaction, text)
}

async function handleAddStaff(interaction: CommandInteraction) {
    await interaction.deferReply()

    const role = interaction.options.getRole("role")
    const guildId = interaction.guild!.id
    
    const res = await dbConnect(async db => {
        return await db.execute(`INSERT INTO staffRoles (roleDiscordId, guildId) VALUES (?, ?)`, [role?.id, guildId])
    }).catch(e => console.error(`config.ts handleAddStaff() ${e}`))

    if (res?.changes)
        await reply(interaction, `Successfully added the role ${role}`)
    else
        await reply(interaction, "Something went wrong adding the role")
}

async function handleRemoveStaff(interaction: CommandInteraction) {
    if (!interaction.guild)
        return
    await interaction.deferReply()

    const role = interaction.options.getRole("role")
    const guildId = interaction.guild.id
    
    const res = await dbConnect(async db => {
        return await db.execute(`DELETE FROM staffRoles WHERE roleDiscordId ? AND guildId = ?`, [role?.id, guildId])
    }).catch(e => console.error(`config.ts handleRemoveStaff() ${e}`))

    if (res?.changes)
        await reply(interaction, `Successfully removed the role ${role}`)
    else
        await reply(interaction, "Something went wrong removing the role")
}
