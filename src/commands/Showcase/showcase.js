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
        .setDescription('Mag-upload ng car showcase (modal muna, then images)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    category: 'Showroom',

    async execute(interaction) {
        // --- STEP 1: Gumawa ng Modal para sa Title at Description ---
        const modal = new ModalBuilder()
            .setCustomId(`showcase_modal_${interaction.id}`)
            .setTitle('Car Showcase');

        // Title input
        const titleInput = new TextInputBuilder()
            .setCustomId('showcase_title')
            .setLabel('🚗 Pamagat ng Sasakyan')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., Honda Civic FD2 Type R')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(100);

        // Description input
        const descInput = new TextInputBuilder()
            .setCustomId('showcase_description')
            .setLabel('📝 Detalye ng Sasakyan')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
                '🔧 4 Spoiler\n' +
                '🔧 2 Front Bumper\n' +
                '🔧 1 Exhaust\n' +
                '🔧 1 Grill\n\n' +
                'Wheels\n' +
                '🛞 RAYS Volk Racing TE37'
            )
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1900);

        // Add components to modal
        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput)
        );

        // Ipakita ang modal
        await interaction.showModal(modal);

        // --- STEP 2: Hintayin ang modal submission ---
        const filter = (i) =>
            i.customId === `showcase_modal_${interaction.id}` &&
            i.user.id === interaction.user.id;

        try {
            const modalInteraction = await interaction.awaitModalSubmit({
                filter,
                time: 300000 // 5 minutes
            });

            // I-defer agad para hindi mag-timeout
            await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

            // Kunin ang title at description
            const title = modalInteraction.fields.getTextInputValue('showcase_title').trim();
            const description = modalInteraction.fields.getTextInputValue('showcase_description').trim();

            if (!title || !description) {
                return await modalInteraction.editReply({
                    content: '❌ Hindi pwedeng walang laman ang title o description.'
                });
            }

            // --- STEP 3: Maghintay ng mga larawan (hanggang 4) ---
            const currentChannel = interaction.channel;

            await modalInteraction.editReply({
                content: `📸 **Mag-upload ng hanggang 4 na larawan** sa channel na ito.\n\n` +
                         `Title: **${title}**\n\n` +
                         `⏳ Maghihintay ako ng mga larawan (max 4).\n` +
                         `I-type ang **"done"** para tapusin agad.\n` +
                         `⏱️ Mag-e-expire sa 5 minuto.`
            });

            // Kolektahin ang mga larawan
            const collectedImages = [];
            const maxImages = 4;

            while (collectedImages.length < maxImages) {
                try {
                    const collected = await currentChannel.awaitMessages({
                        filter: msg =>
                            msg.author.id === interaction.user.id &&
                            msg.attachments.size > 0 &&
                            !msg.content.toLowerCase().includes('done'),
                        max: 1,
                        time: 300000, // 5 minutes total
                        errors: ['time']
                    });

                    const msg = collected.first();
                    const attachment = msg.attachments.first();

                    if (!attachment || !attachment.contentType || !attachment.contentType.startsWith('image/')) {
                        await msg.delete().catch(() => {});
                        await modalInteraction.editReply({
                            content: `⚠️ Hindi image ang na-upload. Mag-upload ng image file.`
                        });
                        continue;
                    }

                    // I-download ang larawan gamit ang bot token
                    const response = await fetch(attachment.url, {
                        headers: { Authorization: `Bot ${interaction.client.token}` }
                    });
                    if (!response.ok) throw new Error(`Failed to download image`);
                    const buffer = await response.arrayBuffer();
                    collectedImages.push({
                        attachment: Buffer.from(buffer),
                        name: attachment.name || `car-image-${collectedImages.length + 1}.png`
                    });

                    // I-delete ang mensahe ng user para malinis
                    await msg.delete().catch(() => {});

                    // Update status
                    const remaining = maxImages - collectedImages.length;
                    if (remaining > 0) {
                        await modalInteraction.editReply({
                            content: `✅ **${collectedImages.length}/${maxImages}** images uploaded.\n` +
                                     `📸 Puwede ka pang mag-upload ng **${remaining}** image(s).\n` +
                                     `I-type ang **"done"** para tapusin agad.`
                        });
                    }

                } catch (error) {
                    if (error.code === 'time') {
                        await modalInteraction.editReply({
                            content: `⏳ No more images received. Proceeding with ${collectedImages.length} images.`
                        });
                        break;
                    } else {
                        throw error;
                    }
                }
            }

            // --- STEP 4: I-post ang showcase ---
            if (collectedImages.length === 0) {
                return await modalInteraction.editReply({
                    content: '❌ Walang nai-upload na larawan. Cancelled.'
                });
            }

            const isForum = currentChannel.type === ChannelType.GuildForum;

            // Build content
            const content = `🚗 **${title}**\n\n${description}\n\n📸 **${collectedImages.length} images uploaded**`;

            try {
                if (isForum) {
                    // Forum Channel: gumawa ng thread
                    const thread = await currentChannel.threads.create({
                        name: title,
                        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                        message: {
                            content: content,
                            files: collectedImages
                        }
                    });

                    await modalInteraction.editReply({
                        content: `✅ **Car showcase posted!**\n📌 ${thread.url}\n📸 ${collectedImages.length} images uploaded.`
                    });
                } else {
                    // Text Channel: send normal message
                    await currentChannel.send({
                        content: content,
                        files: collectedImages
                    });

                    await modalInteraction.editReply({
                        content: `✅ **Car showcase posted!**\n📌 <#${currentChannel.id}>\n📸 ${collectedImages.length} images uploaded.`
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
                    content: '⏳ Timeout: Hindi mo na-submit ang modal sa loob ng 5 minuto.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            } else {
                console.error('Modal error:', error);
            }
        }
    }
};
