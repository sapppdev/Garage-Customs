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
        .setDescription('Mag-upload ng car showcase sa showroom')
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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const currentChannel = interaction.channel;

        // ✅ Suriin kung ang channel ay Forum Channel
        console.log('📌 Channel Type:', currentChannel.type);
        console.log('📌 Channel Name:', currentChannel.name);
        console.log('📌 Channel ID:', currentChannel.id);

        if (currentChannel.type !== ChannelType.GuildForum) {
            // Ipakita kung anong uri ng channel ito
            const channelTypeNames = {
                [ChannelType.GuildText]: 'Text Channel',
                [ChannelType.GuildVoice]: 'Voice Channel',
                [ChannelType.GuildCategory]: 'Category',
                [ChannelType.GuildAnnouncement]: 'Announcement Channel',
                [ChannelType.GuildForum]: 'Forum Channel',
                [ChannelType.GuildMedia]: 'Media Channel'
            };
            const typeName = channelTypeNames[currentChannel.type] || `Unknown (${currentChannel.type})`;

            return await interaction.editReply({
                content: `❌ **Mali ang channel!**\n\n` +
                         `Kasalukuyang channel: **#${currentChannel.name}** (${typeName})\n` +
                         `Kailangan: **Forum Channel**\n\n` +
                         `📌 Pumunta ka sa **#car-showcase** at subukan muli.`
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
            // --- I-download ang unang larawan ---
            const response1 = await fetch(image1.url, {
                headers: { Authorization: `Bot ${interaction.client.token}` }
            });
            if (!response1.ok) throw new Error(`Failed to download image: ${response1.status}`);
            const buffer1 = await response1.arrayBuffer();
            const attachment1 = {
                attachment: Buffer.from(buffer1),
                name: image1.name || 'car-image1.png'
            };

            // --- Gumawa ng bagong thread ---
            const thread = await currentChannel.threads.create({
                name: title,
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                message: {
                    content: `🚗 **${title}**\n\n${description}`,
                    files: [attachment1]
                }
            });

            // I-confirm
            await interaction.editReply({
                content: `✅ **Thread created!**\n📌 ${thread.url}\n\n` +
                         `📸 Puwede kang mag-upload ng hanggang **3 additional images**.\n` +
                         `Mag-attach lang ng larawan sa **channel na ito** (hindi sa thread).\n` +
                         `⏳ Maghihintay ako ng 2 minuto per image.\n` +
                         `I-type ang **"done"** para tapusin agad.`
            });

            // --- Maghintay ng additional images ---
            const maxAdditional = 3;
            let uploadedCount = 0;

            while (uploadedCount < maxAdditional) {
                try {
                    const collected = await currentChannel.awaitMessages({
                        filter: msg =>
                            msg.author.id === interaction.user.id &&
                            msg.attachments.size > 0 &&
                            !msg.content.toLowerCase().includes('done'),
                        max: 1,
                        time: 120000,
                        errors: ['time']
                    });

                    const msg = collected.first();
                    const attachment = msg.attachments.first();

                    if (!attachment || !attachment.contentType || !attachment.contentType.startsWith('image/')) {
                        await msg.delete().catch(() => {});
                        await interaction.editReply({
                            content: `⚠️ Hindi image ang na-upload. Mag-upload ng image file.`
                        });
                        continue;
                    }

                    const response = await fetch(attachment.url, {
                        headers: { Authorization: `Bot ${interaction.client.token}` }
                    });
                    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
                    const buffer = await response.arrayBuffer();
                    const fileAttachment = {
                        attachment: Buffer.from(buffer),
                        name: attachment.name || `car-image${uploadedCount + 2}.png`
                    };

                    await thread.send({
                        content: `📸 Additional image ${uploadedCount + 1}`,
                        files: [fileAttachment]
                    });

                    uploadedCount++;
                    await msg.delete().catch(() => {});

                    if (uploadedCount < maxAdditional) {
                        await interaction.editReply({
                            content: `✅ **${uploadedCount}/${maxAdditional}** additional images uploaded.\n` +
                                     `📸 Puwede ka pang mag-upload ng **${maxAdditional - uploadedCount}** image(s).\n` +
                                     `I-type ang **"done"** para tapusin agad.`
                        });
                    }

                } catch (error) {
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

            await interaction.editReply({
                content: `✅ **Car showcase completed!**\n` +
                         `📌 Thread: ${thread.url}\n` +
                         `📸 Total images: **${uploadedCount + 1}** (1 initial + ${uploadedCount} additional)`
            });

        } catch (error) {
            console.error('Showcase error:', error);
            await interaction.editReply({
                content: `❌ Nagka-error: ${error.message}`
            }).catch(() => {});
        }
    }
};
