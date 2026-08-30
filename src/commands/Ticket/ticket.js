import { getColor } from '../../config/bot.js';
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';

import {
    createEmbed,
    successEmbed,
} from '../../utils/embeds.js';

import {
    getGuildConfig,
    setGuildConfig,
} from '../../services/config/guildConfig.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

import {
    handleInteractionError,
    replyUserError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription("Manages the server's ticket system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

        // =========================
        // /ticket setup
        // =========================
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription(
                    'Sets up the Garage Customs ticket creation panel.'
                )

                .addChannelOption((option) =>
                    option
                        .setName('panel_channel')
                        .setDescription(
                            'The channel where the ticket panel will be sent.'
                        )
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('panel_message')
                        .setDescription(
                            'The main message/description for the ticket panel.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('button_label')
                        .setDescription(
                            'Legacy option. The Garage Customs panel uses 3 category buttons.'
                        )
                        .setRequired(false)
                )

                .addChannelOption((option) =>
                    option
                        .setName('category')
                        .setDescription(
                            'The category where new tickets will be created.'
                        )
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false)
                )

                .addChannelOption((option) =>
                    option
                        .setName('closed_category')
                        .setDescription(
                            'The category where closed tickets will be moved.'
                        )
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false)
                )

                .addRoleOption((option) =>
                    option
                        .setName('staff_role')
                        .setDescription(
                            'The role that can access and manage tickets.'
                        )
                        .setRequired(false)
                )

                .addIntegerOption((option) =>
                    option
                        .setName('max_tickets_per_user')
                        .setDescription(
                            'Maximum number of tickets a user can create.'
                        )
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false)
                )

                .addBooleanOption((option) =>
                    option
                        .setName('dm_on_close')
                        .setDescription(
                            'Send a DM to the user when their ticket is closed.'
                        )
                        .setRequired(false)
                )
        )

        // =========================
        // /ticket dashboard
        // =========================
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription(
                    'Open the interactive ticket system dashboard.'
                )
        ),

    category: 'ticket',

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(
            interaction,
            { flags: MessageFlags.Ephemeral }
        );

        if (!deferred) {
            return;
        }

        // Permission check
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.ManageChannels
            )
        ) {
            logger.warn('Ticket command permission denied', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ticket',
            });

            return await replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message:
                    'You need the `Manage Channels` permission for this action.',
            });
        }

        const subcommand = interaction.options.getSubcommand();

        // =========================
        // DASHBOARD
        // =========================
        if (subcommand === 'dashboard') {
            return ticketConfig.execute(
                interaction,
                config,
                client
            );
        }

        // =========================
        // SETUP
        // =========================
        if (subcommand === 'setup') {
            const existingConfig = await getGuildConfig(
                client,
                interaction.guildId
            );

            if (existingConfig?.ticketPanelChannelId) {
                return await replyUserError(interaction, {
                    type: ErrorTypes.UNKNOWN,
                    message:
                        `This server already has a ticket system set up ` +
                        `(panel in <#${existingConfig.ticketPanelChannelId}>).\n\n` +
                        `Use \`/ticket dashboard\` and select **Delete System** ` +
                        `before creating a new panel.`,
                });
            }

            const panelChannel =
                interaction.options.getChannel('panel_channel');

            const categoryChannel =
                interaction.options.getChannel('category');

            const closedCategoryChannel =
                interaction.options.getChannel('closed_category');

            const staffRole =
                interaction.options.getRole('staff_role');

            const panelMessage =
                interaction.options.getString('panel_message') ||
                'Please select the correct category to contact our team.';

            const maxTicketsPerUser =
                interaction.options.getInteger(
                    'max_tickets_per_user'
                ) || 3;

            const dmOnClose =
                interaction.options.getBoolean('dm_on_close') !== false;

            // =========================
            // GARAGE CUSTOMS EMBED
            // =========================
            const setupEmbed = createEmbed({
                title: '🎫 GARAGE CUSTOMS SUPPORT',
                description: panelMessage,
                color: getColor('info'),
            });

            // =========================
            // THREE TICKET BUTTONS
            // =========================
            const ticketButtons =
                new ActionRowBuilder().addComponents(

                    // BUY
                    new ButtonBuilder()
                        .setCustomId('ticket_buy')
                        .setLabel('Buy / Trade')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🛒'),

                    // SUPPORT
                    new ButtonBuilder()
                        .setCustomId('ticket_support')
                        .setLabel('Support')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🔧'),

                    // PARTNERSHIP
                    new ButtonBuilder()
                        .setCustomId('ticket_partnership')
                        .setLabel('Partnership')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🤝')
                );

            try {
                const sentPanel = await panelChannel.send({
                    embeds: [setupEmbed],
                    components: [ticketButtons],
                });

                // =========================
                // SAVE CONFIGURATION
                // =========================
                if (client.db && interaction.guildId) {
                    const currentConfig = existingConfig;

                    currentConfig.ticketCategoryId =
                        categoryChannel
                            ? categoryChannel.id
                            : null;

                    currentConfig.ticketClosedCategoryId =
                        closedCategoryChannel
                            ? closedCategoryChannel.id
                            : null;

                    currentConfig.ticketStaffRoleId =
                        staffRole
                            ? staffRole.id
                            : null;

                    currentConfig.ticketPanelChannelId =
                        panelChannel.id;

                    currentConfig.ticketPanelMessageId =
                        sentPanel?.id || null;

                    currentConfig.ticketPanelMessage =
                        panelMessage;

                    // Keep this for compatibility with TitanBot
                    currentConfig.ticketButtonLabel =
                        'Buy / Support / Partnership';

                    currentConfig.maxTicketsPerUser =
                        maxTicketsPerUser;

                    currentConfig.dmOnClose =
                        dmOnClose;

                    await setGuildConfig(
                        client,
                        interaction.guildId,
                        currentConfig
                    );

                    logger.info(
                        'Garage Customs ticket configuration saved',
                        {
                            guildId: interaction.guildId,
                            categoryId: categoryChannel?.id,
                            closedCategoryId:
                                closedCategoryChannel?.id,
                            staffRoleId: staffRole?.id,
                            maxTickets: maxTicketsPerUser,
                            dmOnClose,
                        }
                    );
                } else {
                    logger.error(
                        'Ticket setup: database unavailable'
                    );
                }

                // =========================
                // SUCCESS MESSAGE
                // =========================
                let successMessage =
                    `The Garage Customs ticket panel has been sent to ${panelChannel}.`;

                if (categoryChannel) {
                    successMessage +=
                        `\nNew tickets will be created in **${categoryChannel.name}**.`;
                } else {
                    successMessage +=
                        '\nNew tickets will use the default Tickets category.';
                }

                if (closedCategoryChannel) {
                    successMessage +=
                        `\nClosed tickets will be moved to **${closedCategoryChannel.name}**.`;
                }

                if (staffRole) {
                    successMessage +=
                        `\n**${staffRole.name}** will have access to tickets.`;
                }

                successMessage +=
                    `\n\n**Max Tickets Per User:** ${maxTicketsPerUser}`;

                successMessage +=
                    `\n**DM on Close:** ${
                        dmOnClose
                            ? 'Enabled'
                            : 'Disabled'
                    }`;

                await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                '🎫 Ticket Panel Set Up',
                                successMessage
                            ),
                        ],
                    }
                );

                logger.info(
                    'Garage Customs ticket panel setup completed',
                    {
                        userId: interaction.user.id,
                        userTag: interaction.user.tag,
                        guildId: interaction.guildId,
                        panelChannelId:
                            panelChannel.id,
                        categoryId:
                            categoryChannel?.id,
                        closedCategoryId:
                            closedCategoryChannel?.id,
                        staffRoleId:
                            staffRole?.id,
                        maxTickets:
                            maxTicketsPerUser,
                        dmOnClose,
                    }
                );
            } catch (error) {
                logger.error(
                    'Ticket setup error',
                    {
                        error: error.message,
                        stack: error.stack,
                        userId: interaction.user.id,
                        guildId: interaction.guildId,
                    }
                );

                if (
                    interaction.deferred ||
                    interaction.replied
                ) {
                    await replyUserError(
                        interaction,
                        {
                            type: ErrorTypes.UNKNOWN,
                            message:
                                `Could not send the ticket panel or save configuration.\n\n` +
                                `Check the bot's permissions and database connection.`,
                        }
                    ).catch(() => {});
                } else {
                    await handleInteractionError(
                        interaction,
                        error,
                        {
                            commandName: 'ticket_setup',
                            source: 'ticket_setup_command',
                        }
                    );
                }
            }
        }
    },
};
