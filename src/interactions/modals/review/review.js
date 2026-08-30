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

    async execute(interaction, client, args) {
        try {
            const [
                customerId,
                reviewChannelId,
                ticketChannelId,
                ratingString,
                panelMessageId
            ] = args;

            // ==========================================
            // VALIDATION
            // ==========================================

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

            // ==========================================
            // GET FEEDBACK
            // ==========================================

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

            // ==========================================
            // ACKNOWLEDGE MODAL
            // ==========================================

            await InteractionHelper.safeDefer(
                interaction,
                {
                    flags:
                        MessageFlags.Ephemeral
                }
            );

            const guild =
                interaction.guild;

            // ==========================================
            // GET TICKET CHANNEL
            // ==========================================

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

            // ==========================================
            // STARS
            // ==========================================

            const stars =
                '⭐'.repeat(rating);

            // ==========================================
            // PICTURE PROMPT
            // ==========================================

            const photoMessage =
                await ticketChannel.send({
                    content:
                        `${interaction.user}\n\n` +
                        `⭐ **Your rating:** ${stars}\n\n` +
                        '**📸 Optional Picture**\n' +
                        'You can attach a picture directly from your PC/phone.\n\n' +
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

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    content:
                        '✅ Your feedback was received.\n\n' +
                        '📸 You may now attach an optional picture directly in this ticket.\n\n' +
                        'Send an image file here or click **Skip Picture**.'
                }
            );

            // ==========================================
            // WAIT FOR IMAGE OR SKIP
            // ==========================================

            const messagePromise =
                ticketChannel.awaitMessages({
                    filter: message => {
                        // Only customer
                        if (
                            message.author.id !==
                            customerId
                        ) {
                            return false;
                        }

                        // MUST contain attachment
                        if (
                            message.attachments.size ===
                            0
                        ) {
                            return false;
                        }

                        // Find image
                        const image =
                            message.attachments.find(
                                attachment => {
                                    const type =
                                        attachment.contentType ||
                                        '';

                                    return type.startsWith(
                                        'image/'
                                    );
                                }
                            );

                        return Boolean(image);
                    },

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

            // ==========================================
            // GET IMAGE
            // ==========================================

            let imageAttachment =
                null;

            if (
                result &&
                result.type === 'message' &&
                result.message
            ) {
                const message =
                    result.message;

                imageAttachment =
                    message.attachments.find(
                        attachment => {
                            const type =
                                attachment.contentType ||
                                '';

                            return type.startsWith(
                                'image/'
                            );
                        }
                    );

                // Delete uploaded message
                await message.delete()
                    .catch(() => {});
            }

            // ==========================================
            // SKIP
            // ==========================================

            if (
                result &&
                result.type === 'skip' &&
                result.interaction
            ) {
                await result.interaction
                    .deferUpdate()
                    .catch(() => {});
            }

            // ==========================================
            // TIMEOUT
            // ==========================================

            if (!result) {
                await photoMessage
                    .delete()
                    .catch(() => {});

                return await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '⌛ Review timed out.'
                    }
                );
            }

            // ==========================================
            // GET REVIEW CHANNEL
            // ==========================================

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

            // ==========================================
            // CREATE REVIEW EMBED
            // ==========================================

            const reviewEmbed =
                new EmbedBuilder()
                    .setTitle(
                        '⭐ CUSTOMER REVIEW'
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

            // ==========================================
            // SEND REVIEW
            // ==========================================

            let sentReview;

            if (imageAttachment) {

                /*
                 * IMPORTANT:
                 *
                 * We use the Discord attachment URL
                 * as the file source.
                 *
                 * Then we set the same attachment
                 * as the embed image.
                 */

                sentReview =
                    await reviewChannel.send({
                        embeds: [
                            reviewEmbed
                        ],

                        files: [
                            {
                                attachment:
                                    imageAttachment.url,

                                name:
                                    imageAttachment.name ||
                                    'customer-review-image'
                            }
                        ]
                    });

                /*
                 * Get the newly uploaded attachment
                 * from the review message.
                 */
                const uploadedImage =
                    sentReview.attachments.first();

                if (uploadedImage) {

                    const finalEmbed =
                        EmbedBuilder.from(
                            reviewEmbed
                        ).setImage(
                            uploadedImage.url
                        );

                    await sentReview.edit({
                        embeds: [
                            finalEmbed
                        ]
                    });
                }

            } else {

                /*
                 * No picture.
                 * Send review normally.
                 */

                sentReview =
                    await reviewChannel.send({
                        embeds: [
                            reviewEmbed
                        ]
                    });
            }

            // ==========================================
            // DELETE ORIGINAL REVIEW PANEL
            // ==========================================

            if (panelMessageId) {

                const panelMessage =
                    await ticketChannel.messages
                        .fetch(
                            panelMessageId
                        )
                        .catch(() => null);

                if (panelMessage) {
                    await panelMessage
                        .delete()
                        .catch(() => {});
                }

            } else {

                /*
                 * Fallback:
                 * If panelMessageId wasn't passed,
                 * try deleting the message that
                 * contains the buttons.
                 */

                if (
                    interaction.message &&
                    interaction.message.components
                        ?.length > 0
                ) {
                    await interaction.message
                        .delete()
                        .catch(() => {});
                }
            }

            // ==========================================
            // DELETE PHOTO PROMPT
            // ==========================================

            await photoMessage
                .delete()
                .catch(() => {});

            // ==========================================
            // CONFIRMATION IN TICKET
            // ==========================================

            await ticketChannel.send({
                content:
                    `✅ ${interaction.user}, thank you for your ${stars} review!`
            }).catch(() => {});

            // ==========================================
            // CONFIRMATION TO CUSTOMER
            // ==========================================

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    content:
                        `✅ Your ${stars} review has been submitted to <#${reviewChannelId}>.\n\n` +
                        `Thank you for supporting **Garage Customs**!`
                }
            );

            // ==========================================
            // LOG
            // ==========================================

            logger.info(
                'Garage Customs customer review submitted',
                {
                    guildId:
                        interaction.guildId,

                    userId:
                        interaction.user.id,

                    rating,

                    hasImage:
                        Boolean(
                            imageAttachment
                        ),

                    imageName:
                        imageAttachment?.name ||
                        null,

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
                await InteractionHelper
                    .safeEditReply(
                        interaction,
                        {
                            content:
                                '❌ Something went wrong while submitting your review.'
                        }
                    )
                    .catch(() => {});

            } else {

                await InteractionHelper
                    .safeReply(
                        interaction,
                        {
                            content:
                                '❌ Something went wrong while submitting your review.',
                            flags:
                                MessageFlags.Ephemeral
                        }
                    )
                    .catch(() => {});
            }
        }
    }
};
