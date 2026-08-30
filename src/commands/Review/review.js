import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ChannelType
} from 'discord.js';

import { getColor } from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Request a customer review for Garage Customs.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option =>
            option
                .setName('customer')
                .setDescription('Customer who will submit the review.')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option
                .setName('review_channel')
                .setDescription('Review channel. Leave empty for #customer-reviews.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    category: 'Review',

    async execute(interaction) {
        try {
            const customer = interaction.options.getUser('customer');

            let reviewChannel = interaction.options.getChannel('review_channel');

            // Automatically find #customer-reviews
            if (!reviewChannel) {
                reviewChannel = interaction.guild.channels.cache.find(
                    channel =>
                        channel.type === ChannelType.GuildText &&
                        ['customer-reviews', 'customer-review', 'reviews'].includes(
                            channel.name.toLowerCase()
                        )
                );
            }

            if (!reviewChannel) {
                return await interaction.reply({
                    content: '❌ I could not find `#customer-reviews`.\n\nPlease create a channel named `customer-reviews`.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (customer.bot) {
                return await interaction.reply({
                    content: '❌ Bots cannot submit reviews.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const customerId = customer.id;
            const reviewChannelId = reviewChannel.id;
            const ticketChannelId = interaction.channel.id;

            const embed = new EmbedBuilder()
                .setTitle('⭐ GARAGE CUSTOMS CUSTOMER REVIEW')
                .setDescription(
                    `${customer}, thank you for choosing **Garage Customs**!\n\n` +
                    'We would appreciate your feedback about your experience.\n\n' +
                    '**Please select your rating:**\n\n' +
                    '⭐ **1 Star**\n' +
                    '⭐⭐ **2 Stars**\n' +
                    '⭐⭐⭐ **3 Stars**\n' +
                    '⭐⭐⭐⭐ **4 Stars**\n' +
                    '⭐⭐⭐⭐⭐ **5 Stars**\n\n' +
                    'After selecting a rating, you will be asked to provide your feedback.'
                )
                .setColor(getColor('primary') || '#00FF00') // fallback color
                .setFooter({ text: 'Garage Customs • Customer Review' })
                .setTimestamp();

            // Initial row (will be replaced with updated IDs)
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('temp_1')
                        .setLabel('1')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('temp_2')
                        .setLabel('2')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('temp_3')
                        .setLabel('3')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('temp_4')
                        .setLabel('4')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('temp_5')
                        .setLabel('5')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Success)
                );

            // Send the panel first
            const sentMessage = await interaction.channel.send({
                content: `${customer}`,
                embeds: [embed],
                components: [row]
            });

            // Now update the buttons with the correct custom IDs including the message ID
            const updatedRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`garage_review:${customerId}:${reviewChannelId}:${ticketChannelId}:1:${sentMessage.id}`)
                        .setLabel('1')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`garage_review:${customerId}:${reviewChannelId}:${ticketChannelId}:2:${sentMessage.id}`)
                        .setLabel('2')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`garage_review:${customerId}:${reviewChannelId}:${ticketChannelId}:3:${sentMessage.id}`)
                        .setLabel('3')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`garage_review:${customerId}:${reviewChannelId}:${ticketChannelId}:4:${sentMessage.id}`)
                        .setLabel('4')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`garage_review:${customerId}:${reviewChannelId}:${ticketChannelId}:5:${sentMessage.id}`)
                        .setLabel('5')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Success)
                );

            await sentMessage.edit({ components: [updatedRow] });

            await interaction.reply({
                content: `✅ Review request sent to ${customer}.\nReviews will be posted in ${reviewChannel}.`,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Review command error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Something went wrong while creating the review request.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};
