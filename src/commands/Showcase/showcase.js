import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    ThreadAutoArchiveDuration,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('showcase')
        .setDescription('Mag-upload ng car showcase (4 na images + modal description)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option
                .setName('title')
                .setDescription('Pamagat ng sasakyan (e.g., Honda Civic FD2 Type R)')
                .setRequired(true)
                .setMaxLength(100)
        )
        .addAttachmentOption(option =>
            option
                .setName('image1')
                .setDescription('📸 Unang larawan (required)')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option
                .setName('image2')
                .setDescription('📸 Pangalawang larawan (optional)')
                .setRequired(false)
        )
        .addAttachmentOption(option =>
            option
                .setName('image3')
                .setDescription('📸 Pangatlong larawan (optional)')
                .setRequired(false)
        )
        .addAttachmentOption(option =>
            option
                .setName('image4')
                .setDescription('📸 Pang-apat na larawan (optional)')
                .setRequired(false)
        ),

    category: 'Showroom',

    async execute(interaction) {
        const title = interaction.options.getString('title').trim();
        const image1 = interaction.options.getAttachment('image1');
        const image2 = interaction.options.getAttachment('image2');
        const image3 = interaction.options.getAttachment('image3');
        const image4 = interaction.options.getAttachment('image4');

        const images = [image1, image2, image3, image4].filter(img => img !== null);
        for (const img of images) {
            if (!img.contentType || !img.contentType.startsWith('image/')) {
                return await interaction.reply({
                    content: `❌ Ang file na **${img.name}** ay hindi image.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // Gumawa ng Modal
        const modal = new ModalBuilder()
            .setCustomId(`showcase_modal_${interaction.id}`)
            .setTitle('Car Showcase Description');

        const descriptionInput = new TextInputBuilder()
            .setCustomId('showcase_description')
            .setLabel('📝 Detalye ng sasakyan')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('🔧 4 Spoiler\n🔧 2 Front Bumper\n🔧 1 Exhaust\n\nWheels\n🛞 RAYS Volk Racing TE37')
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1900);

        modal.addComponents(new ActionRowBuilder().addComponents(descriptionInput));

        // Ipakita ang modal
        await interaction.showModal(modal);

        const filter = (i) =>
            i.customId === `showcase_modal_${interaction.id}` &&
            i.user.id === interaction.user.id;

        try {
            const modalInteraction = await interaction.awaitModalSubmit({
                filter,
                time: 300000
            });

            await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

            const description = modalInteraction.fields.getTextInputValue('showcase_description').trim();

            if (!description) {
                return await modalInteraction.editReply({
                    content: '❌ Hindi pwedeng walang laman ang description.'
                });
            }

            const currentChannel = interaction.channel;
            const isForum = currentChannel.type === ChannelType.GuildForum;

            try {
                // I-download ang mga images
                const attachments = [];
                for (let i = 0; i < images.length; i++) {
                    const img = images[i];
                    const response = await fetch(img.url, {
                        headers: { Authorization: `Bot ${interaction.client.token}` }
                    });
                    if (!response.ok) throw new Error(`Failed to download image ${i + 1}`);
                    const buffer = await response.arrayBuffer();
                    attachments.push({
                        attachment: Buffer.from(buffer),
                        name: img.name || `car-image${i + 1}.png`
                    });
                }

                // ✅ HIWALAY: Unahin ang images, tapos ang description
                if (isForum) {
                    // Unang mensahe: title + images ONLY
                    const thread = await currentChannel.threads.create({
                        name: title,
                        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                        message: {
                            content: `🚗 **${title}**\n\n📸 **${attachments.length} images uploaded**`,
                            files: attachments
                        }
                    });

                    // Pangalawang mensahe: description
                    await thread.send({
                        content: `📝 **Description**\n\n${description}`
                    });

                    await modalInteraction.editReply({
                        content: `✅ **Car showcase posted!**\n📌 ${thread.url}\n📸 ${attachments.length} images uploaded.`
                    });
                } else {
                    // Sa text channel: send images first, then description
                    const msg = await currentChannel.send({
                        content: `🚗 **${title}**\n\n📸 **${attachments.length} images uploaded**`,
                        files: attachments
                    });

                    await currentChannel.send({
                        content: `📝 **Description**\n\n${description}`
                    });

                    await modalInteraction.editReply({
                        content: `✅ **Car showcase posted!**\n📌 <#${currentChannel.id}>\n📸 ${attachments.length} images uploaded.`
                    });
                }

            } catch (error) {
                console.error('Showcase error:', error);
                await modalInteraction.editReply({
                    content: `❌ Nagka-error: ${error.message}`
                }).catch(() => {});
            }

        } catch (error) {
            if (error.code === 'time') {
                await interaction.reply({
                    content: '⏳ Timeout: Hindi mo na-submit ang description sa loob ng 5 minuto.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            } else {
                console.error('Modal error:', error);
            }
        }
    }
};
