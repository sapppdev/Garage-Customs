import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    ThreadAutoArchiveDuration
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('uploadcar')
        .setDescription('Mag-upload ng larawan ng sasakyan sa Showroom (Forum Channel)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addAttachmentOption(option =>
            option
                .setName('image')
                .setDescription('Piliin ang larawan ng sasakyan')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('caption')
                .setDescription('Caption para sa larawan')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('title')
                .setDescription('Pamagat ng forum post (default: pangalan ng file)')
                .setRequired(false)
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Showroom channel (Forum Channel)')
                .addChannelTypes(ChannelType.GuildForum)  // <-- Eto ang tamang channel type
                .setRequired(false)
        ),

    category: 'Utility',

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const image = interaction.options.getAttachment('image');
        const caption = interaction.options.getString('caption') || '';
        let title = interaction.options.getString('title') || image.name || 'Car Showcase';
        let targetChannel = interaction.options.getChannel('channel');

        // Default channel: hanapin ang unang Forum Channel na may "showroom" sa pangalan
        if (!targetChannel) {
            targetChannel = interaction.guild.channels.cache.find(
                ch => ch.type === ChannelType.GuildForum &&
                      ['showroom', 'car-showroom', 'car-showcase', 'showcase'].some(
                          keyword => ch.name.toLowerCase().includes(keyword)
                      )
            );
        }

        if (!targetChannel) {
            return await interaction.editReply({
                content: '❌ Walang makitang Showroom (Forum Channel). Pakispecify ang channel gamit ang option.'
            });
        }

        // I-validate kung attachment ay image
        if (!image.contentType || !image.contentType.startsWith('image/')) {
            return await interaction.editReply({
                content: '❌ Dapat image file ang i-upload (jpeg, png, gif, etc.)'
            });
        }

        try {
            // I-download ang image gamit ang bot token
            const response = await fetch(image.url, {
                headers: {
                    Authorization: `Bot ${interaction.client.token}`
                }
            });
            const buffer = await response.arrayBuffer();
            const attachment = {
                attachment: Buffer.from(buffer),
                name: image.name || 'car-image.png'
            };

            // ✨ IMPORTANTE: Gumawa ng bagong thread (post) sa Forum Channel
            const thread = await targetChannel.threads.create({
                name: title,                          // Pamagat ng post
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek, // Mag-e-expire after 1 week
                message: {                           // Unang mensahe sa thread
                    content: caption || '📸 New car upload!',
                    files: [attachment]
                },
                // Optional: Puwede kang magdagdag ng tags (kung may tags ang forum niyo)
                // appliedTags: ['tag-id-1', 'tag-id-2']
            });

            await interaction.editReply({
                content: `✅ Larawan na-upload sa Showroom!\n📌 Post: ${thread.url}`
            });

        } catch (error) {
            console.error('Upload error:', error);
            await interaction.editReply({
                content: `❌ Nagka-error sa pag-upload: ${error.message}`
            });
        }
    }
};
