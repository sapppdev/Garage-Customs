import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags
} from 'discord.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

export default {
    name: 'garage_review',

    async execute(interaction, client, args) {
        try {
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
                rating
            ] = args;

            if (
                !customerId ||
                !reviewChannelId ||
                !ticketChannelId ||
                !rating
            ) {
                return await InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ Invalid review button.',
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            // Customer only.
            if (
                interaction.user.id !==
                customerId
            ) {
                return await InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ This review request is not for you.',
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            const ratingNumber =
                Number(rating);

            if (
                ratingNumber < 1 ||
                ratingNumber > 5
            ) {
                return await InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ Invalid star rating.',
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            const stars =
                '⭐'.repeat(ratingNumber);

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `garage_review_modal:${customerId}:${reviewChannelId}:${ticketChannelId}:${rating}`
                    )
                    .setTitle(
                        `${rating} Star Review`
                    );

            const feedback =
                new TextInputBuilder()
                    .setCustomId(
                        'review_feedback'
                    )
                    .setLabel(
                        'Tell us about your experience'
                    )
                    .setPlaceholder(
                        'Write your feedback about Garage Customs...'
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(true)
                    .setMinLength(5)
                    .setMaxLength(1000);

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        feedback
                    )
            );

            // This acknowledges the button interaction
            // immediately by opening the modal.
            await interaction.showModal(
                modal
            );

            logger.info(
                'Garage Customs review modal opened',
                {
                    customerId,
                    rating,
                    ticketChannelId,
                    reviewChannelId
                }
            );

        } catch (error) {
            logger.error(
                'Garage review button error:',
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ Could not open the review form.',
                        flags:
                            MessageFlags.Ephemeral
                    }
                ).catch(() => {});
            }
        }
    }
};
