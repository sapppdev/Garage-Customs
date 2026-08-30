import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} from 'discord.js';

export default {
    name: 'reviewButtons',

    async execute(interaction) {
        if (!interaction.isButton()) return;

        if (!interaction.customId.startsWith('review_')) {
            return;
        }

        const rating = interaction.customId.replace(
            'review_',
            ''
        );

        const stars = '⭐'.repeat(Number(rating));

        const modal = new ModalBuilder()
            .setCustomId(`review_modal_${rating}`)
            .setTitle(`${stars} Your Review`);

        const feedback = new TextInputBuilder()
            .setCustomId('review_feedback')
            .setLabel('Your Feedback')
            .setPlaceholder(
                'Tell us about your experience with Garage Customs...'
            )
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(5)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder().addComponents(feedback)
        );

        await interaction.showModal(modal);
    }
};
