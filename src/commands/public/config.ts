import { ApplicationCommandData, ApplicationCommandOptionChoiceData, CommandInteraction, Constants, TextChannel } from "discord.js";
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
            description: "View server configuration settings",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
        },
        {
            name: "queue-staff",
            description: "Add or remove Lounge Queue staff roles",
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
        {
            name: "join-channel",
            description: "Set the channel to be used by /schedule",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
            options: [
                {
                    name: "channel",
                    description: "The join channel",
                    required: true,
                    type: Constants.ApplicationCommandOptionTypes.CHANNEL
                },
            ],
        },
        {
            name: "sub",
            description: "Configure the /sub command used to find room subs",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
            options: [
                {
                    name: "channel",
                    description: "The channel to send the looking for sub messages to",
                    required: true,
                    type: Constants.ApplicationCommandOptionTypes.CHANNEL
                },
                {
                    name: "role-to-ping",
                    description: "The role to ping along with each sub message. Ex: @tags",
                    required: true,
                    type: Constants.ApplicationCommandOptionTypes.ROLE
                },
                {
                    name: "max-mmr-diff",
                    description: "The maximum MMR difference allowed. Ex: 500",
                    required: true,
                    type: Constants.ApplicationCommandOptionTypes.INTEGER,
                },
                {
                    name: "max-minutes",
                    description: "The maximum minutes to look for sub. Ex: 10",
                    required: true,
                    type: Constants.ApplicationCommandOptionTypes.INTEGER
                },
                {
                    name: "permission",
                    description: "Who can use the /sub command",
                    required: true,
                    type: Constants.ApplicationCommandOptionTypes.STRING,
                    choices: [
                        {name: 'LQ Staff Only', value: 'LQ Staff Only'},
                        {name: 'Everyone', value: 'Everyone'}
                    ]
                },
            ],
        },
        {
            name: "sub-remove",
            description: "Remove the /sub command configurations to disable it",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
        },
        {
            name: "add-extension",
            description: "Allow the bot to wait a few more minutes before making rooms if +1",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
            options: [
                {
                    name: "max-minutes",
                    description: "The maximum extension time if nobody joins or drops. Ex: 2",
                    required: true,
                    type: Constants.ApplicationCommandOptionTypes.INTEGER,
                    choices: getMaxMinutesChoices()
                },
                {
                    name: "role-to-ping",
                    description: "The role to ping along with the +1 message. Ex: @tags",
                    required: true,
                    type: Constants.ApplicationCommandOptionTypes.ROLE
                },
            ]
        },
        {
            name: "remove-extension",
            description: "Remove extension settings to disable queue extensions",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
        },
    ]
}

function getMaxMinutesChoices() {
    const res: ApplicationCommandOptionChoiceData[] = []
    for (let i = 0; i < 5; i++) {
        res.push({name: `${i+1}`, value: i+1})
    }
    return res
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
    else if (interaction.options.getSubcommand() == "join-channel")
        handleAddJoinChannel(interaction).catch(e => console.error(`config.ts handleAddJoinChannel()`, e))
    else if (interaction.options.getSubcommand() == "sub")
        handleSubConfig(interaction).catch(e => console.error(`config.ts handleSubConfig()`, e))
    else if (interaction.options.getSubcommand() == "sub-remove")
        handleSubRemove(interaction).catch(e => console.error(`config.ts handleSubRemove()`, e))
    else if (interaction.options.getSubcommand() == "add-extension")
        handleAddExtension(interaction).catch(e => console.error(`config.ts handleAddExtension()`, e))
    else if (interaction.options.getSubcommand() == "remove-extension")
        handleRemoveExtension(interaction).catch(e => console.error(`config.ts handleRemoveExtension()`, e))
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
        return await db.execute(`DELETE FROM staffRoles WHERE roleDiscordId = ? AND guildId = ?`, [role?.id, guildId])
    }).catch(e => console.error(`config.ts handleRemoveStaff() ${e}`))

    if (res?.changes)
        await reply(interaction, `Successfully removed the role ${role}`)
    else
        await reply(interaction, "Something went wrong removing the role")
}

async function handleAddJoinChannel(interaction: CommandInteraction) {
    if (!interaction.guild)
        return
    await interaction.deferReply()

    const channel = interaction.options.getChannel("channel")
    if (!(channel instanceof TextChannel))
        return await reply(interaction, `The channel needs to be a text channel, and it cannot be a thread channel`)

    const query = `INSERT INTO config (guildId, joinChannelId) 
        VALUES (?, ?) 
        ON CONFLICT (guildId) DO 
        UPDATE SET joinChannelId = excluded.joinChannelId`
    const res = await dbConnect(async db => {
        return await db.execute(query, [interaction.guild!.id, channel.id])
    }).catch(e => console.error(`config.ts handleAddJoinChannel() ${e}`))

    if (res?.changes)
        await reply(interaction, `Successfully updated the join channel to ${channel}`)
    else
        await reply(interaction, "Something went wrong updating the channel")
}

async function handleSubConfig(interaction: CommandInteraction) {
    const channel = interaction.options.getChannel("channel")
    const role = interaction.options.getRole("role-to-ping")
    const maxMmrDiff = interaction.options.getInteger("max-mmr-diff")
    const maxMinutes = interaction.options.getInteger("max-minutes")
    const permission = interaction.options.getString("permission")

    if (channel === null || role === null || maxMmrDiff === null || maxMinutes === null || permission === null) {
        console.error(`config.ts handleSubConfig() an option is null`)
        return reply(interaction, `There was a problem reading the command arguments`)
    }

    await interaction.deferReply()

    if (maxMmrDiff <= 0)
        return reply(interaction, `Error: max-mmr-diff needs to be greater than 0`)
    if (maxMinutes <= 0)
        return reply(interaction, `Error: max-minutes needs to be greater than 0`)

    const query = `INSERT INTO config 
        (guildId, subChannelId, subPingRoleId, subMmrDiff, subMinutes, subStaffOnly) 
        VALUES (?, ?, ?, ?, ?, ?) 
        ON CONFLICT (guildId) DO 
        UPDATE SET 
        subChannelId = excluded.subChannelId, 
        subPingRoleId = excluded.subPingRoleId, 
        subMmrDiff = excluded.subMmrDiff, 
        subMinutes = excluded.subMinutes, 
        subStaffOnly = excluded.subStaffOnly
        `
    const staffOnly = permission === 'LQ Staff Only'
    const res = await dbConnect(async db => {
        return await db.execute(query, [interaction.guild!.id, channel.id, role.id, maxMmrDiff, maxMinutes, staffOnly])
    }).catch(e => console.error(`config.ts handleSubConfig() ${e}`))

    if (res?.changes)
        await reply(interaction, `Successfully updated the /sub configuration`)
    else
        await reply(interaction, "Something went wrong updating the /sub configuration")
}

async function handleSubRemove(interaction: CommandInteraction) {
    const query = `UPDATE config SET
        subChannelId = null, 
        subPingRoleId = null, 
        subMmrDiff = null, 
        subMinutes = null, 
        subStaffOnly = null
        WHERE guildId = ?`

    const res = await dbConnect(async db => {
        return await db.execute(query, [interaction.guild!.id])
    }).catch(e => console.error(`config.ts handleSubRemove() ${e}`))

    if (res?.changes)
        await reply(interaction, `Successfully removed the /sub configuration`)
    else
        await reply(interaction, "Something went wrong removing the /sub configuration")
}

async function handleAddExtension(interaction: CommandInteraction) {
    const minutes = interaction.options.getInteger("max-minutes")
    const role = interaction.options.getRole("role-to-ping")

    if (minutes === null || role === null) {
        console.error(`config.ts handleAddExtension() an option is null`)
        return reply(interaction, `There was a problem reading the command arguments`)
    }

    await interaction.deferReply()

    const query = `INSERT INTO config 
        (guildId, queuePlusOneExtensionMinutes, queuePlusOnePingRoleId) 
        VALUES (?, ?, ?) 
        ON CONFLICT (guildId) DO 
        UPDATE SET 
        queuePlusOneExtensionMinutes = excluded.queuePlusOneExtensionMinutes, 
        queuePlusOnePingRoleId = excluded.queuePlusOnePingRoleId
        `
    const res = await dbConnect(async db => {
        return await db.execute(query, [interaction.guild!.id, minutes, role.id])
    }).catch(e => console.error(`config.ts handleAddExtension() ${e}`))

    if (res?.changes)
        await reply(interaction, `Successfully updated the queue extension configuration`)
    else
        await reply(interaction, "Something went wrong updating the queue extension configuration")
}

async function handleRemoveExtension(interaction: CommandInteraction) {
    const query = `UPDATE config SET
        queuePlusOneExtensionMinutes = null, 
        queuePlusOnePingRoleId = null 
        WHERE guildId = ?`

    const res = await dbConnect(async db => {
        return await db.execute(query, [interaction.guild!.id])
    }).catch(e => console.error(`config.ts handleRemoveExtension() ${e}`))

    if (res?.changes)
        await reply(interaction, `Successfully removed the queue extension configuration`)
    else
        await reply(interaction, "Something went wrong removing the queue extension configuration")
}