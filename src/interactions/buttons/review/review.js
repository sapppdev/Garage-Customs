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
            // Now includes panelMessageId as the 6th argument
            const [
                customerId,
                reviewChannelId,
                ticketChannelId,
                rating,
                panelMessageId
            ] = args;

            if (!customerId || !reviewChannelId || !ticketChannelId || !rating) {
                return await InteractionHelper.safeReply(interaction, {
                    content: '❌ Invalid review button.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Only the customer selected by /review can use the review.
            if (interaction.user.id !== customerId) {
                return await InteractionHelper.safeReply(interaction, {
                    content: '❌ This review request is not for you.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const ratingNumber = Number(rating);
            if (!Number.isInteger(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
                return await InteractionHelper.safeReply(interaction, {
                    content: '❌ Invalid star rating.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const stars = '⭐'.repeat(ratingNumber);

            const modal = new ModalBuilder()
                .setCustomId(`garage_review_modal:${customerId}:${reviewChannelId}:${ticketChannelId}:${ratingNumber}:${panelMessageId}`)
                .setTitle(`${stars} Your Review`);

            const feedback = new TextInputBuilder()
                .setCustomId('review_feedback')
                .setLabel('Your Feedback')
                .setPlaceholder('Tell us about your experience with Garage Customs...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(5)
                .setMaxLength(1000);

            modal.addComponents(
                new ActionRowBuilder().addComponents(feedback)
            );

            await interaction.showModal(modal);

            logger.info('Garage Customs review modal opened', {
                customerId,
                rating: ratingNumber,
                ticketChannelId,
                reviewChannelId,
                panelMessageId
            });

        } catch (error) {
            logger.error('Garage review button error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await InteractionHelper.safeReply(interaction, {
                    content: '❌ Could not open the review form.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }
};
