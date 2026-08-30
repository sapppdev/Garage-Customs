import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    ThreadAutoArchiveDuration
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('showcase')
        .setDescription('Mag-upload ng car showcase sa showroom (forum channel)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option
                .setName('title')
                .setDescription('Pamagat ng sasakyan (e.g., Honda Civic FD2 Type R)')
                .setRequired(true)
                .setMaxLength(100)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('Detalye ng sasakyan (parts, modifications, etc.)')
                .setRequired(true)
                .setMaxLength(2000)
        )
        .addAttachmentOption(option =>
            option
                .setName('image1')
                .setDescription('Unang larawan ng sasakyan')
                .setRequired(true)
        ),

    category: 'Showroom',

    async execute(interaction) {
        // I-defer agad para hindi mag-timeout
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const currentChannel = interaction.channel;

        // ✅ Suriin kung ang kasalukuyang channel ay isang Forum Channel
        if (currentChannel.type !== ChannelType.GuildForum) {
            return await interaction.editReply({
                content: '❌ Ang command na ito ay **dapat gamitin sa isang Forum Channel** (e.g., Showroom).'
            });
        }

        // Kunin ang mga input
        const title = interaction.options.getString('title').trim();
        const description = interaction.options.getString('description').trim();
        const image1 = interaction.options.getAttachment('image1');

        // I-validate kung ang attachment ay isang image
        if (!image1.contentType || !image1.contentType.startsWith('image/')) {
            return await interaction.editReply({
                content: '❌ Dapat image file ang i-upload (jpeg, png, gif, webp, etc.)'
            });
        }

        try {
            // --- I-download ang unang larawan gamit ang bot token ---
            const response1 = await fetch(image1.url, {
                headers: { Authorization: `Bot ${interaction.client.token}` }
            });
            if (!response1.ok) throw new Error(`Failed to download image: ${response1.status}`);
            const buffer1 = await response1.arrayBuffer();
            const attachment1 = {
                attachment: Buffer.from(buffer1),
                name: image1.name || 'car-image1.png'
            };

            // --- Gumawa ng bagong thread (post) sa Forum Channel ---
            const thread = await currentChannel.threads.create({
                name: title,
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                message: {
                    content: `🚗 **${title}**\n\n${description}`,
                    files: [attachment1]
                }
                // Kung may tags, idagdag ang appliedTags array dito
                // appliedTags: ['tag-id-1', 'tag-id-2']
            });

            // I-confirm sa user
            await interaction.editReply({
                content: `✅ **Thread created!**\n📌 ${thread.url}\n\n` +
                         `📸 **Puwede ka pang mag-upload ng hanggang 3 additional images** sa thread na ito.\n` +
                         `Mag-attach lang ng larawan sa **kasalukuyang channel** (hindi sa thread).\n` +
                         `⏳ Maghihintay ako ng hanggang 2 minuto per image.\n` +
                         `I-type ang **"done"** (sa channel) para tapusin agad.`
            });

            // --- Maghintay ng additional images (max 3) ---
            const maxAdditional = 3;
            let uploadedCount = 0;

            while (uploadedCount < maxAdditional) {
                try {
                    const collected = await currentChannel.awaitMessages({
                        filter: msg =>
                            msg.author.id === interaction.user.id &&
                            msg.attachments.size > 0 &&
                            // Puwede ring i-detect ang "done"
                            !msg.content.toLowerCase().includes('done'),
                        max: 1,
                        time: 120000, // 2 minuto
                        errors: ['time']
                    });

                    const msg = collected.first();
                    // Kunin ang unang attachment
                    const attachment = msg.attachments.first();
                    if (!attachment || !attachment.contentType || !attachment.contentType.startsWith('image/')) {
                        // Kung hindi image, i-skip at i-delete ang mensahe
                        await msg.delete().catch(() => {});
                        await interaction.editReply({
                            content: `⚠️ Hindi image ang na-upload. Mag-upload ng image file.`
                        });
                        continue;
                    }

                    // I-download ang larawan gamit ang bot token
                    const response = await fetch(attachment.url, {
                        headers: { Authorization: `Bot ${interaction.client.token}` }
                    });
                    if (!response.ok) throw new Error(`Failed to download additional image: ${response.status}`);
                    const buffer = await response.arrayBuffer();
                    const fileAttachment = {
                        attachment: Buffer.from(buffer),
                        name: attachment.name || `car-image${uploadedCount + 2}.png`
                    };

                    // I-send sa thread
                    await thread.send({
                        content: `📸 Additional image ${uploadedCount + 1}`,
                        files: [fileAttachment]
                    });

                    uploadedCount++;

                    // I-delete ang mensahe ng user para malinis
                    await msg.delete().catch(() => {});

                    // Update status
                    if (uploadedCount < maxAdditional) {
                        await interaction.editReply({
                            content: `✅ **${uploadedCount}/${maxAdditional}** additional images uploaded.\n` +
                                     `📸 Puwede ka pang mag-upload ng **${maxAdditional - uploadedCount}** image(s).\n` +
                                     `I-type ang **"done"** (sa channel) para tapusin agad.`
                        });
                    }

                } catch (error) {
                    // Timeout – walang na-upload sa loob ng 2 minuto
                    if (error.code === 'time') {
                        await interaction.editReply({
                            content: `⏳ No more images received. Proceeding with ${uploadedCount} additional images.`
                        });
                        break;
                    } else {
                        throw error;
                    }
                }
            }

            // --- Final confirmation ---
            await interaction.editReply({
                content: `✅ **Car showcase completed!**\n` +
                         `📌 Thread: ${thread.url}\n` +
                         `📸 Total images: **${uploadedCount + 1}** (1 initial + ${uploadedCount} additional)`
            });

        } catch (error) {
            console.error('Showcase error:', error);
            await interaction.editReply({
                content: `❌ Nagka-error sa pag-upload: ${error.message}`
            }).catch(() => {});
        }
    }
};
