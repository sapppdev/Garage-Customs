import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Send the Garage Customs customer review panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel where reviews will be posted.')
                .setRequired(true)
        ),

    category: 'review',

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');

        const embed = new EmbedBuilder()
            .setTitle('⭐ CUSTOMER REVIEW')
            .setDescription(
                '**How would you rate your experience with Garage Customs?**\n\n' +
                '⭐ **1 Star** — Very Bad\n' +
                '⭐⭐ **2 Stars** — Bad\n' +
                '⭐⭐⭐ **3 Stars** — Average\n' +
                '⭐⭐⭐⭐ **4 Stars** — Good\n' +
                '⭐⭐⭐⭐⭐ **5 Stars** — Excellent\n\n' +
                '**💬 Feedback**\n' +
                'Please tell us about your experience with Garage Customs.\n' +
                'Your feedback helps us improve our service.'
            )
            .setColor('#E10600')
            .setFooter({
                text: 'Garage Customs • Customer Reviews'
            });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('review_1')
                    .setLabel('1')
                    .setEmoji('⭐')
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId('review_2')
                    .setLabel('2')
                    .setEmoji('⭐')
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId('review_3')
                    .setLabel('3')
                    .setEmoji('⭐')
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId('review_4')
                    .setLabel('4')
                    .setEmoji('⭐')
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId('review_5')
                    .setLabel('5')
                    .setEmoji('⭐')
                    .setStyle(ButtonStyle.Success)
            );

        await channel.send({
            embeds: [embed],
            components: [buttons]
        });

        await interaction.reply({
            content: `✅ Review panel sent to ${channel}.`,
            flags: MessageFlags.Ephemeral
        });
    }
};
