import {
    EmbedBuilder,
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

            // Make sure only the selected customer can submit
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
             * Acknowledge modal immediately.
             */
            const deferred =
                await InteractionHelper.safeDefer(
                    interaction,
                    {
                        flags:
                            MessageFlags.Ephemeral
                    }
                );

            if (!deferred) {
                return;
            }

            const feedback =
                interaction.fields
                    .getTextInputValue(
                        'review_feedback'
                    )
                    .trim();

            // Optional image
            const image =
                interaction.fields
                    .getTextInputValue(
                        'review_image'
                    )
                    .trim();

            if (!feedback) {
                return await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '❌ Please provide your feedback.'
                    }
                );
            }

            const guild =
                interaction.guild;

            const reviewChannel =
                guild.channels.cache.get(
                    reviewChannelId
                ) ||
                await guild.channels
                    .fetch(
                        reviewChannelId
                    )
                    .catch(() => null);

            if (!reviewChannel) {
                return await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '❌ The customer review channel could not be found.'
                    }
                );
            }

            if (
                !reviewChannel.isTextBased()
            ) {
                return await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '❌ The review channel is not a text channel.'
                    }
                );
            }

            /*
             * ONLY stars are displayed.
             *
             * Example:
             * ⭐⭐⭐⭐⭐
             *
             * No 5/5
             * No "Excellent"
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
             * Add picture only if customer
             * provided an image URL.
             */
            if (image) {
                try {
                    const parsedUrl =
                        new URL(image);

                    if (
                        parsedUrl.protocol ===
                            'http:' ||
                        parsedUrl.protocol ===
                            'https:'
                    ) {
                        reviewEmbed.setImage(
                            image
                        );
                    }
                } catch {
                    // Invalid image URL:
                    // simply ignore it.
                }
            }

            // Send review to #customer-reviews
            await reviewChannel.send({
                embeds: [
                    reviewEmbed
                ]
            });

            /*
             * Confirm inside ticket.
             */
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
                ticketChannel &&
                ticketChannel.isTextBased()
            ) {
                await ticketChannel.send({
                    content:
                        `✅ ${interaction.user}, thank you for your **${stars}** review!`
                }).catch(() => {});
            }

            // Confirm to customer
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    content:
                        `✅ Thank you for your review! Your ${stars} feedback has been submitted.`
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
