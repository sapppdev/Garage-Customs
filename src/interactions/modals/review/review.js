import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} from 'discord.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import { getColor } from '../../../config/bot.js';

export default {
    name: 'garage_review_modal',

    async execute(interaction, client, args) {
        try {
            const [
                customerId,
                reviewChannelId,
                ticketChannelId,
                ratingString,
                panelMessageId
            ] = args;

            if (!customerId || !reviewChannelId || !ticketChannelId || !ratingString) {
                return await InteractionHelper.safeReply(interaction, {
                    content: '❌ Invalid review submission.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (interaction.user.id !== customerId) {
                return await InteractionHelper.safeReply(interaction, {
                    content: '❌ You are not allowed to submit this review.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const rating = Number(ratingString);
            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                return await InteractionHelper.safeReply(interaction, {
                    content: '❌ Invalid review rating.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const feedback = interaction.fields.getTextInputValue('review_feedback').trim();
            if (!feedback) {
                return await InteractionHelper.safeReply(interaction, {
                    content: '❌ Please provide your feedback.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Acknowledge modal
            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

            const guild = interaction.guild;

            // Get ticket channel
            const ticketChannel = guild.channels.cache.get(ticketChannelId) ||
                                  await guild.channels.fetch(ticketChannelId).catch(() => null);
            if (!ticketChannel || !ticketChannel.isTextBased()) {
                return await InteractionHelper.safeEditReply(interaction, {
                    content: '❌ Ticket channel could not be found.'
                });
            }

            const stars = '⭐'.repeat(rating);

            // Send picture prompt
            const photoMessage = await ticketChannel.send({
                content: `${interaction.user}\n\n` +
                         `⭐ Your rating: ${stars}\n\n` +
                         '**Optional Picture**\n' +
                         'You can attach a picture directly from your PC/phone below.\n' +
                         'If you do not want to add a picture, click **Skip Picture**.',
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`garage_review_skip:${customerId}:${reviewChannelId}:${ticketChannelId}:${rating}`)
                                .setLabel('Skip Picture')
                                .setStyle(ButtonStyle.Secondary)
                        )
                ]
            });

            await InteractionHelper.safeEditReply(interaction, {
                content: '✅ Your feedback was received.\n\n' +
                         '📸 You may now attach an optional picture directly in this ticket.\n' +
                         'The review will be posted automatically after your picture is sent, or when you click **Skip Picture**.'
            });

            // Wait for picture or skip
            const messagePromise = ticketChannel.awaitMessages({
                filter: msg => msg.author.id === customerId,
                max: 1,
                time: 120000
            });

            const buttonPromise = ticketChannel.awaitMessageComponent({
                filter: btn => btn.user.id === customerId &&
                               btn.customId === `garage_review_skip:${customerId}:${reviewChannelId}:${ticketChannelId}:${rating}`,
                time: 120000
            });

            const result = await Promise.race([
                messagePromise.then(col => ({ type: 'message', message: col.first() })),
                buttonPromise.then(btn => ({ type: 'skip', interaction: btn }))
            ]).catch(() => null);

            let imageUrl = null;

            if (result && result.type === 'message' && result.message) {
                const msg = result.message;
                const image = msg.attachments.find(att => att.contentType && att.contentType.startsWith('image/'));
                if (image) imageUrl = image.url;
                await msg.delete().catch(() => {});
            }

            if (result && result.type === 'skip' && result.interaction) {
                await result.interaction.deferUpdate().catch(() => {});
            }

            if (!result) {
                await photoMessage.delete().catch(() => {});
                return await InteractionHelper.safeEditReply(interaction, {
                    content: '⌛ Review timed out because no picture was uploaded and Skip Picture was not selected.'
                });
            }

            // Find review channel
            const reviewChannel = guild.channels.cache.get(reviewChannelId) ||
                                  await guild.channels.fetch(reviewChannelId).catch(() => null);
            if (!reviewChannel || !reviewChannel.isTextBased()) {
                return await InteractionHelper.safeEditReply(interaction, {
                    content: '❌ Customer review channel could not be found.'
                });
            }

            // --- Send review as plain text (no embed) ---
            let reviewContent = `**Customer Review**\n\n` +
                                `**Customer:** ${interaction.user}\n` +
                                `**Rating:** ${stars}\n\n` +
                                `**💬 Feedback:**\n${feedback}`;

            // ✅ FIX: Idagdag ang image URL sa content para mag-render bilang larawan
            if (imageUrl) {
                reviewContent += `\n\n${imageUrl}`;
            }

            await reviewChannel.send({
                content: reviewContent
            });

            // Delete the original rating panel using the saved message ID
            if (panelMessageId) {
                const panelMessage = await ticketChannel.messages.fetch(panelMessageId).catch(() => null);
                if (panelMessage) await panelMessage.delete().catch(() => {});
            }

            // Delete the picture prompt
            await photoMessage.delete().catch(() => {});

            // Confirmation in ticket
            await ticketChannel.send({
                content: `✅ ${interaction.user}, thank you for your ${stars} review!`
            }).catch(() => {});

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ Your ${stars} review has been submitted to <#${reviewChannelId}>. Thank you for supporting **Garage Customs**!`
            });

            logger.info('Garage Customs customer review submitted', {
                guildId: interaction.guildId,
                userId: interaction.user.id,
                rating,
                hasImage: Boolean(imageUrl),
                ticketChannelId,
                reviewChannelId
            });

        } catch (error) {
            logger.error('Garage review modal error:', error);
            if (interaction.deferred || interaction.replied) {
                await InteractionHelper.safeEditReply(interaction, {
                    content: '❌ Something went wrong while submitting your review.'
                }).catch(() => {});
            } else {
                await InteractionHelper.safeReply(interaction, {
                    content: '❌ Something went wrong while submitting your review.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }
};
