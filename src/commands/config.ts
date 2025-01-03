import Discord from "discord.js";
import { slashCommandEvent } from "../common/discordEvents";
import { listConfig } from "../common/commands/config";
import { slashReply } from "../common/util";
import { dbConnect } from "../common/db/connect";

export const data: Discord.ApplicationCommandData = {
    name: "config",
    description: "View or edit server configuration. Requires MANAGE_ROLES permission",
    options: [
        {
            name: "list",
            description: "View server configuration settings. Requires MANAGE_ROLES permission",
            type: Discord.Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
        },
        {
            name: "queue-staff",
            description: "Add or remove Lounge Queue staff roles. Requires MANAGE_ROLES permission",
            type: Discord.Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
            options: [
                {
                    name: "add-role",
                    description: "Add a role",
                    type: Discord.Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                    options: [
                        {
                            name: "role",
                            description: "The role to add",
                            required: true,
                            type: Discord.Constants.ApplicationCommandOptionTypes.ROLE
                        },
                    ],
                },
                {
                    name: "remove-role",
                    description: "remove a role",
                    type: Discord.Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                    options: [
                        {
                            name: "role",
                            description: "The role to remove",
                            required: true,
                            type: Discord.Constants.ApplicationCommandOptionTypes.ROLE
                        },
                    ],
                },
            ]
        },
        {
            name: "min-full-rooms",
            description: "Change the minimum full rooms required to create rooms. Requires MANAGE_ROLES permission",
            type: Discord.Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
            options: [
                {
                    name: "rooms",
                    description: "The minimum number of full rooms",
                    required: true,
                    type: Discord.Constants.ApplicationCommandOptionTypes.INTEGER,
                },
            ]
        },
        {
            name: "room-size",
            description: "Change the number of players needed for a full room. Requires MANAGE_ROLES permission",
            type: Discord.Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
            options: [
                {
                    name: "size",
                    description: "The minimum number of players for a full room",
                    required: true,
                    type: Discord.Constants.ApplicationCommandOptionTypes.INTEGER,
                },
            ]
        }
    ]
}

slashCommandEvent.on(data.name, async (interaction) => {
    if (interaction.options.getSubcommand() == "list")
        handleList(interaction).catch(e => console.error(`config.ts handleList() ${e}`))
    else if (interaction.options.getSubcommand() == "add-role")
        handleAddStaff(interaction).catch(e => console.error(`config.ts handleAddStaff() ${e}`))
    else if (interaction.options.getSubcommand() == "remove-role")
        handleRemoveStaff(interaction).catch(e => console.error(`config.ts handleRemoveStaff() ${e}`))
    else if (interaction.options.getSubcommand() == "min-full-rooms")
        handleMinFullRooms(interaction).catch(e => console.error(`config.ts handleMinFullRooms() ${e}`))
    else if (interaction.options.getSubcommand() == "room-size")
        handleRoomSize(interaction).catch(e => console.error(`config.ts handleRoomSize() ${e}`))
})

async function handleList(interaction: Discord.CommandInteraction) {
    if (!interaction.guild)
        return
    await interaction.deferReply()

    let text = await listConfig(interaction.guild.id)
    await slashReply(interaction, text)
}

async function handleAddStaff(interaction: Discord.CommandInteraction) {
    if (!interaction.guild)
        return
    await interaction.deferReply()

    const role = interaction.options.getRole("role")
    const guildId = interaction.guild.id
    
    const res = await dbConnect(async db => {
        return await db.execute(`INSERT INTO staffRoles (roleDiscordId, guildId) VALUES (?, ?)`, [role?.id, guildId])
    }).catch(e => console.error(`config.ts handleAddStaff() ${e}`))

    if (res?.changes)
        await slashReply(interaction, `Successfully added the role ${role}`)
    else
        await slashReply(interaction, "Something went wrong adding the role")
}

async function handleRemoveStaff(interaction: Discord.CommandInteraction) {
    if (!interaction.guild)
        return
    await interaction.deferReply()

    const role = interaction.options.getRole("role")
    const guildId = interaction.guild.id
    
    const res = await dbConnect(async db => {
        return await db.execute(`DELETE FROM staffRoles WHERE roleDiscordId ? AND guildId = ?`, [role?.id, guildId])
    }).catch(e => console.error(`config.ts handleRemoveStaff() ${e}`))

    if (res?.changes)
        await slashReply(interaction, `Successfully removed the role ${role}`)
    else
        await slashReply(interaction, "Something went wrong removing the role")
}

async function handleMinFullRooms(interaction: Discord.CommandInteraction) {
    if (!interaction.guild)
        return
    await interaction.deferReply()

    const rooms = interaction.options.getInteger("rooms")
    const guildId = interaction.guild.id

    if ((rooms || 0) < 1)
        return slashReply(interaction, `rooms must be at least 1`)

    const res = await dbConnect(async db => {
        return await db.execute("UPDATE config SET minFullRooms = ? WHERE guildId = ?", [rooms, guildId])
    }).catch(e => console.error(`config.ts handleMinFullRooms() ${e}`))

    if (res?.changes)
        await slashReply(interaction, `Successfully set min-full-rooms to ${rooms}`)
    else
        await slashReply(interaction, "Something went wrong setting min-full-rooms")
}

async function handleRoomSize(interaction: Discord.CommandInteraction) {
    if (!interaction.guild)
        return
    await interaction.deferReply()

    const size = interaction.options.getInteger("size")
    const guildId = interaction.guild.id

    if ((size || 0) < 8)
        return slashReply(interaction, `size needs to be at least 8`)

    const res = await dbConnect(async db => {
        return await db.execute("UPDATE config SET roomSize = ? WHERE guildId = ?", [size, guildId])
    }).catch(e => console.error(`config.ts handleRoomSize() ${e}`))

    if (res?.changes)
        await slashReply(interaction, `Successfully set room-size to ${size}`)
    else
        await slashReply(interaction, "Something went wrong setting room-size")
}
