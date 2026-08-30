import {
    EmbedBuilder,
    MessageFlags
} from 'discord.js';

export default {
    name: 'reviewModal',

    async execute(interaction) {
        if (!interaction.isModalSubmit()) return;

        if (!interaction.customId.startsWith('review_modal_')) {
            return;
        }

        const rating = interaction.customId.replace(
            'review_modal_',
            ''
        );

        const stars = '⭐'.repeat(Number(rating));

        const feedback =
            interaction.fields.getTextInputValue(
                'review_feedback'
            );

        const reviewChannel =
            interaction.guild.channels.cache.find(
                channel =>
                    channel.name === 'customer-reviews'
            );

        if (!reviewChannel) {
            return interaction.reply({
                content:
                    '❌ I could not find the `#customer-reviews` channel.',
                flags: MessageFlags.Ephemeral
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${stars} Customer Review`)
            .setDescription(
                `**Customer**\n` +
                `${interaction.user}\n\n` +

                `**Rating**\n` +
                `${stars}\n\n` +

                `**💬 Feedback**\n` +
                `${feedback}`
            )
            .setColor('#E10600')
            .setThumbnail(
                interaction.user.displayAvatarURL({
                    size: 256
                })
            )
            .setFooter({
                text: 'Garage Customs • Customer Review'
            })
            .setTimestamp();

        await reviewChannel.send({
            embeds: [embed]
        });

        await interaction.reply({
            content:
                '✅ Thank you for your review! Your feedback has been submitted.',
            flags: MessageFlags.Ephemeral
        });
    }
};
