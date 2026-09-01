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
        .setDescription('Mag-upload ng car showcase (modal + lahat ng images sa isang send)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    category: 'Showroom',

    async execute(interaction) {
        // --- STEP 1: Modal para sa Title at Description ---
        const modal = new ModalBuilder()
            .setCustomId(`showcase_modal_${interaction.id}`)
            .setTitle('Car Showcase');

        const titleInput = new TextInputBuilder()
            .setCustomId('showcase_title')
            .setLabel('🚗 Pamagat ng Sasakyan')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., Honda Civic FD2 Type R')
            .setRequired(false)
            .setMinLength(3)
            .setMaxLength(100);

        const descInput = new TextInputBuilder()
            .setCustomId('showcase_description')
            .setLabel('📝 Detalye ng Sasakyan')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
                '🔧 4 Spoiler\n' +
                '🔧 2 Front Bumper\n' +
                '🔧 1 Exhaust\n\n' +
                'Wheels\n' +
                '🛞 RAYS Volk Racing TE37'
            )
            .setRequired(false)
            .setMinLength(10)
            .setMaxLength(1900);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput)
        );

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

            const title = modalInteraction.fields.getTextInputValue('showcase_title').trim();
            const description = modalInteraction.fields.getTextInputValue('showcase_description').trim();

            if (!title || !description) {
                return await modalInteraction.editReply({
                    content: '❌ Hindi pwedeng walang laman ang title o description.'
                });
            }

            // --- STEP 2: Maghintay ng ISANG mensahe na may mga larawan ---
            const currentChannel = interaction.channel;

            await modalInteraction.editReply({
                content: `📸 **Mag-upload ng hanggang 4 na larawan** sa isang mensahe.\n\n` +
                         `Title: **${title}**\n\n` +
                         `📎 Pumili ng **1 hanggang 4 na larawan** at i-send sa channel na ito.\n` +
                         `⏳ Maghihintay ako ng 5 minuto.\n` +
                         `I-type ang **"done"** para magpatuloy (kung walang images, cancel).`
            });

            // Hintayin ang isang mensahe
            const collected = await currentChannel.awaitMessages({
                filter: msg =>
                    msg.author.id === interaction.user.id,
                max: 1,
                time: 300000,
                errors: ['time']
            });

            const msg = collected.first();
            const content = msg.content.toLowerCase().trim();

            // --- STEP 3: Suriin kung "done" o may mga attachments ---
            if (content === 'done') {
                await msg.delete().catch(() => {});
                return await modalInteraction.editReply({
                    content: '⏹️ Cancelled: Walang nai-upload na larawan.'
                });
            }

            // Kunin ang lahat ng attachments
            const attachments = msg.attachments;
            if (attachments.size === 0) {
                await msg.delete().catch(() => {});
                return await modalInteraction.editReply({
                    content: '❌ Walang nakitang larawan sa mensahe. Pakisama ang mga larawan sa attachment.'
                });
            }

            // I-filter ang mga image attachments (hanggang 4)
            const imageAttachments = attachments.filter(att =>
                att.contentType && att.contentType.startsWith('image/')
            );

            if (imageAttachments.size === 0) {
                await msg.delete().catch(() => {});
                return await modalInteraction.editReply({
                    content: '❌ Walang image file na nakitang attachments.'
                });
            }

            // Limitahan sa 4 na images
            const maxImages = 4;
            const selectedImages = Array.from(imageAttachments.values()).slice(0, maxImages);

            // I-download ang mga images
            const downloadedImages = [];
            for (const att of selectedImages) {
                const response = await fetch(att.url, {
                    headers: { Authorization: `Bot ${interaction.client.token}` }
                });
                if (!response.ok) throw new Error(`Failed to download: ${att.name}`);
                const buffer = await response.arrayBuffer();
                downloadedImages.push({
                    attachment: Buffer.from(buffer),
                    name: att.name || `car-image-${downloadedImages.length + 1}.png`
                });
            }

            // I-delete ang mensahe ng user para malinis
            await msg.delete().catch(() => {});

            // --- STEP 4: I-post ang showcase ---
            // ✅ BINAGO: Wala nang 🚗 at 📸 4 images uploaded
            const contentMessage = `${title}\n\n${description}`;

            const isForum = currentChannel.type === ChannelType.GuildForum;

            if (isForum) {
                const thread = await currentChannel.threads.create({
                    name: title,
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                    message: {
                        content: contentMessage,
                        files: downloadedImages
                    }
                });

                await modalInteraction.editReply({
                    content: `✅ **Car showcase posted!**\n📌 ${thread.url}\n📸 ${downloadedImages.length} images uploaded.`
                });
            } else {
                await currentChannel.send({
                    content: contentMessage,
                    files: downloadedImages
                });

                await modalInteraction.editReply({
                    content: `✅ **Car showcase posted!**\n📌 <#${currentChannel.id}>\n📸 ${downloadedImages.length} images uploaded.`
                });
            }

        } catch (error) {
            if (error.code === 'time') {
                await interaction.reply({
                    content: '⏳ Timeout: Hindi mo na-submit ang modal o hindi ka nag-upload ng images sa loob ng 5 minuto.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            } else {
                console.error('Showcase error:', error);
                await interaction.reply({
                    content: `❌ Nagka-error: ${error.message}`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }
};
