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

const RATING_LABELS = {
    1: 'Very Bad',
    2: 'Bad',
    3: 'Average',
    4: 'Good',
    5: 'Excellent'
};

export default {
    name: 'garage_review_modal',

    async execute(
        interaction,
        client,
        args
    ) {
        /*
         * args:
         * 0 = customerId
         * 1 = reviewChannelId
         * 2 = ticketChannelId
         * 3 = rating
         */

        const [
            customerId,
            reviewChannelId,
            ticketChannelId,
            ratingString
        ] = args;

        try {
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
             * Acknowledge the modal ASAP
             * so Discord won't show
             * "didn't respond in time".
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

            if (!feedback) {
                return await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '❌ Please provide feedback.'
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
                    .fetch(reviewChannelId)
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

            if (!reviewChannel.isTextBased()) {
                return await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        content:
                            '❌ The configured review channel is not a text channel.'
                    }
                );
            }

            const stars =
                '⭐'.repeat(rating);

            const ratingLabel =
                RATING_LABELS[rating];

            const reviewEmbed =
                new EmbedBuilder()
                    .setTitle(
                        `${stars} Customer Review`
                    )
                    .setDescription(
                        `**Customer**\n` +
                        `${interaction.user}\n\n` +

                        `**Rating**\n` +
                        `${stars} **${rating}/5 — ${ratingLabel}**\n\n` +

                        `**💬 Feedback**\n` +
                        `${feedback}`
                    )
                    .setColor(
                        getColor(
                            rating >= 4
                                ? 'success'
                                : rating === 3
                                    ? 'warning'
                                    : 'error'
                        )
                    )
                    .setThumbnail(
                        interaction.user
                            .displayAvatarURL({
                                size: 256
                            })
                    )
                    .setFooter({
                        text:
                            'Garage Customs • Verified Customer Review'
                    })
                    .setTimestamp();

            await reviewChannel.send({
                embeds: [reviewEmbed]
            });

            /*
             * Optional confirmation
             * inside the ticket.
             */
            const ticketChannel =
                guild.channels.cache.get(
                    ticketChannelId
                ) ||
                await guild.channels
                    .fetch(ticketChannelId)
                    .catch(() => null);

            if (
                ticketChannel &&
                ticketChannel.isTextBased()
            ) {
                await ticketChannel.send({
                    content:
                        `✅ ${interaction.user}, thank you for your **${rating}/5** review!`
                }).catch(() => {});
            }

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    content:
                        `✅ Thank you! Your ${stars} review has been submitted to ${reviewChannel}.`
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
