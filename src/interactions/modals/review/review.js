import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} from 'discord.js';

import {
    InteractionHelper
} from '../../../utils/interactionHelper.js';

import {
    logger
} from '../../../utils/logger.js';

import {
    getColor
} from '../../../config/bot.js';

export default {
    name: 'garage_review_modal',

    async execute(
        interaction,
        client,
        args
    ) {
        try {
            const [
                customerId,
                reviewChannelId,
                ticketChannelId,
                ratingString
            ] = args;

            if (
                !customerId ||
                !reviewChannelId ||
                !ticketChannelId ||
                !ratingString
            ) {
                return await InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ Invalid review submission.',
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            // Only selected customer
            if (
                interaction.user.id !==
                customerId
            ) {
                return await InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ You are not allowed to submit this review.',
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            const rating =
                Number(ratingString);

            if (
                !Number.isInteger(rating) ||
                rating < 1 ||
                rating > 5
            ) {
                return await InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ Invalid review rating.',
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            /*
             * Get feedback from modal.
             */
            const feedback =
                interaction.fields
                    .getTextInputValue(
                        'review_feedback'
                    )
                    .trim();

            if (!feedback) {
                return await InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ Please provide your feedback.',
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            /*
             * Acknowledge modal immediately.
             */
            await InteractionHelper.safeDefer(
                interaction,
                {
                    flags:
                        MessageFlags.Ephemeral
                }
            );

            /*
             * Get the ticket channel.
             */
            const guild =
                interaction.guild;

            const ticketChannel =
                guild.channels.cache.get(
                    ticketChannelId
                ) ||
                await guild.channels
                    .fetch(
                        ticketChannelId
                    )
                    .catch(() => null);

            if (
                !ticketChannel ||
                !ticketChannel.isTextBased()
            ) {
                return await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '❌ Ticket channel could not be found.'
                    }
                );
            }

            /*
             * Tell customer to upload a picture.
             *
             * They can:
             * - Attach an image
             * - Or click Skip
             */
            const photoMessage =
                await ticketChannel.send({
                    content:
                        `${interaction.user}\n\n` +
                        `⭐ Your rating: ${'⭐'.repeat(rating)}\n\n` +
                        '**Optional Picture**\n' +
                        'You can attach a picture directly from your PC/phone below.\n' +
                        'If you do not want to add a picture, click **Skip Picture**.',
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(
                                        `garage_review_skip:${customerId}:${reviewChannelId}:${ticketChannelId}:${rating}`
                                    )
                                    .setLabel(
                                        'Skip Picture'
                                    )
                                    .setStyle(
                                        ButtonStyle.Secondary
                                    )
                            )
                    ]
                });

            /*
             * Tell the customer that the modal
             * was successfully received.
             */
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    content:
                        '✅ Your feedback was received.\n\n' +
                        '📸 You may now attach an optional picture directly in this ticket.\n' +
                        'The review will be posted automatically after your picture is sent, or when you click **Skip Picture**.'
                }
            );

            /*
             * Wait for customer's next message
             * OR the Skip Picture button.
             */
            const messagePromise =
                ticketChannel.awaitMessages({
                    filter: message =>
                        message.author.id ===
                        customerId,
                    max: 1,
                    time: 120000
                });

            const buttonPromise =
                ticketChannel.awaitMessageComponent({
                    filter: buttonInteraction =>
                        buttonInteraction.user.id ===
                            customerId &&
                        buttonInteraction.customId ===
                            `garage_review_skip:${customerId}:${reviewChannelId}:${ticketChannelId}:${rating}`,
                    time: 120000
                });

            const result =
                await Promise.race([
                    messagePromise.then(
                        collection => ({
                            type: 'message',
                            message:
                                collection.first()
                        })
                    ),

                    buttonPromise.then(
                        buttonInteraction => ({
                            type: 'skip',
                            interaction:
                                buttonInteraction
                        })
                    )
                ]).catch(() => null);

            let imageUrl = null;

            /*
             * Customer uploaded a message.
             */
            if (
                result &&
                result.type === 'message' &&
                result.message
            ) {
                const message =
                    result.message;

                /*
                 * Find first image attachment.
                 */
                const image =
                    message.attachments.find(
                        attachment =>
                            attachment.contentType &&
                            attachment.contentType.startsWith(
                                'image/'
                            )
                    );

                if (image) {
                    imageUrl =
                        image.url;
                }

                /*
                 * Delete customer's upload
                 * so the ticket stays clean.
                 */
                await message.delete()
                    .catch(() => {});
            }

            /*
             * Customer clicked Skip.
             */
            if (
                result &&
                result.type === 'skip' &&
                result.interaction
            ) {
                await result.interaction
                    .deferUpdate()
                    .catch(() => {});
            }

            /*
             * If nothing happened within 2 minutes.
             */
            if (!result) {
                await photoMessage.delete()
                    .catch(() => {});

                return await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '⌛ Review timed out because no picture was uploaded and Skip Picture was not selected.'
                    }
                );
            }

            /*
             * Find review channel.
             */
            const reviewChannel =
                guild.channels.cache.get(
                    reviewChannelId
                ) ||
                await guild.channels
                    .fetch(
                        reviewChannelId
                    )
                    .catch(() => null);

            if (
                !reviewChannel ||
                !reviewChannel.isTextBased()
            ) {
                return await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '❌ Customer review channel could not be found.'
                    }
                );
            }

            /*
             * ONLY stars.
             *
             * Example:
             * ⭐⭐⭐⭐⭐
             *
             * No 5/5
             * No Excellent
             */
            const stars =
                '⭐'.repeat(rating);

            const reviewEmbed =
                new EmbedBuilder()
                    .setTitle(
                        '⭐ Customer Review'
                    )
                    .setDescription(
                        `**Customer**\n` +
                        `${interaction.user}\n\n` +

                        `**Rating**\n` +
                        `${stars}\n\n` +

                        `**💬 Feedback**\n` +
                        `${feedback}`
                    )
                    .setColor(
                        getColor('primary')
                    )
                    .setThumbnail(
                        interaction.user
                            .displayAvatarURL({
                                size: 256
                            })
                    )
                    .setFooter({
                        text:
                            'Garage Customs • Customer Review'
                    })
                    .setTimestamp();

            /*
             * Add uploaded picture.
             */
            if (imageUrl) {
                reviewEmbed.setImage(
                    imageUrl
                );
            }

            /*
             * Send final review.
             */
            await reviewChannel.send({
                embeds: [
                    reviewEmbed
                ]
            });

            /*
             * DELETE the original
             * review rating panel.
             */
            await interaction.message
                .delete()
                .catch(() => {});

            /*
             * Delete the temporary
             * picture prompt.
             */
            await photoMessage.delete()
                .catch(() => {});

            /*
             * Confirmation inside ticket.
             */
            await ticketChannel.send({
                content:
                    `✅ ${interaction.user}, thank you for your ${stars} review!`
            }).catch(() => {});

            /*
             * Confirmation to customer.
             */
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    content:
                        `✅ Your ${stars} review has been submitted to <#${reviewChannelId}>. Thank you for supporting **Garage Customs**!`
                }
            );

            logger.info(
                'Garage Customs customer review submitted',
                {
                    guildId:
                        interaction.guildId,
                    userId:
                        interaction.user.id,
                    rating,
                    hasImage:
                        Boolean(imageUrl),
                    ticketChannelId,
                    reviewChannelId
                }
            );

        } catch (error) {
            logger.error(
                'Garage review modal error:',
                error
            );

            if (
                interaction.deferred ||
                interaction.replied
            ) {
                await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '❌ Something went wrong while submitting your review.'
                    }
                ).catch(() => {});
            } else {
                await InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ Something went wrong while submitting your review.',
                        flags:
                            MessageFlags.Ephemeral
                    }
                ).catch(() => {});
            }
        }
    }
};
