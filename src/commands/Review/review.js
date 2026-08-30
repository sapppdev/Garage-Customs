import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ChannelType
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Manage the Garage Customs customer review system.')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription(
                    'Send the customer review panel.'
                )

                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription(
                            'Channel where customer reviews will be posted.'
                        )
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(true)
                )
        ),

    category: 'review',

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand !== 'setup') {
            return;
        }

        const channel =
            interaction.options.getChannel('channel');

        const embed =
            new EmbedBuilder()
                .setTitle(
                    '⭐ CUSTOMER REVIEW'
                )
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
                    text:
                        'Garage Customs • Customer Reviews'
                });

        const buttons =
            new ActionRowBuilder()
                .addComponents(

                    new ButtonBuilder()
                        .setCustomId(
                            'review_1'
                        )
                        .setLabel('1')
                        .setEmoji('⭐')
                        .setStyle(
                            ButtonStyle.Secondary
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            'review_2'
                        )
                        .setLabel('2')
                        .setEmoji('⭐')
                        .setStyle(
                            ButtonStyle.Secondary
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            'review_3'
                        )
                        .setLabel('3')
                        .setEmoji('⭐')
                        .setStyle(
                            ButtonStyle.Secondary
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            'review_4'
                        )
                        .setLabel('4')
                        .setEmoji('⭐')
                        .setStyle(
                            ButtonStyle.Primary
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            'review_5'
                        )
                        .setLabel('5')
                        .setEmoji('⭐')
                        .setStyle(
                            ButtonStyle.Success
                        )
                );

        try {

            await channel.send({
                embeds: [embed],
                components: [buttons]
            });

            await interaction.reply({
                content:
                    `✅ Customer review panel sent to ${channel}.`,
                flags:
                    MessageFlags.Ephemeral
            });

        } catch (error) {

            console.error(
                'Review setup error:',
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        '❌ Failed to send the review panel.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }
        }
    }
};
