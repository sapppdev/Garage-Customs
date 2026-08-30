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
        .setDescription('Mag-upload ng car showcase (title + 4 images, then description separately)')
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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const title = interaction.options.getString('title').trim();
        const image1 = interaction.options.getAttachment('image1');
        const image2 = interaction.options.getAttachment('image2');
        const image3 = interaction.options.getAttachment('image3');
        const image4 = interaction.options.getAttachment('image4');

        const images = [image1, image2, image3, image4].filter(img => img !== null);
        for (const img of images) {
            if (!img.contentType || !img.contentType.startsWith('image/')) {
                return await interaction.editReply({
                    content: `❌ Ang file na **${img.name}** ay hindi image.`
                });
            }
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

            // Unang mensahe: title + images + placeholder para sa description
            const initialContent = `🚗 **${title}**\n\n📸 **${attachments.length} images uploaded**\n\n✏️ **Mag-type ng description sa thread na ito.**`;

            let thread;
            let initialMessage;

            if (isForum) {
                // Gumawa ng thread sa Forum Channel
                thread = await currentChannel.threads.create({
                    name: title,
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                    message: {
                        content: initialContent,
                        files: attachments
                    }
                });
                initialMessage = thread;
            } else {
                // Sa Text Channel: mag-send ng normal na mensahe
                initialMessage = await currentChannel.send({
                    content: initialContent,
                    files: attachments
                });
                thread = currentChannel; // gagamitin natin ang channel para sa collector
            }

            // I-confirm sa user
            await interaction.editReply({
                content: `✅ **Thread created!**\n📌 ${isForum ? thread.url : `https://discord.com/channels/${interaction.guild.id}/${currentChannel.id}/${initialMessage.id}`}\n\n📸 **${attachments.length} images uploaded**\n\n✏️ **Ngayon, mag-type ka ng description sa thread na ito.**\nPuwede kang gumamit ng **Shift+Enter** para sa bagong linya.\n⏳ Maghihintay ako ng 5 minuto.`
            });

            // --- Maghintay ng description mula sa user ---
            const filter = (msg) =>
                msg.author.id === interaction.user.id &&
                // Kung sa Forum: dapat nasa thread na ginawa; kung sa Text: sa same channel
                (isForum ? msg.channel.id === thread.id : msg.channel.id === currentChannel.id);

            const collected = await thread.awaitMessages({
                filter: filter,
                max: 1,
                time: 300000, // 5 minutes
                errors: ['time']
            });

            const descriptionMsg = collected.first();
            const description = descriptionMsg.content.trim();

            if (!description) {
                await interaction.followUp({
                    content: '⚠️ Walang laman ang description. Maaari mo itong i-edit manually.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // I-delete ang mensahe ng user para malinis
            await descriptionMsg.delete().catch(() => {});

            // I-edit ang unang mensahe para isama ang description
            const finalContent = `🚗 **${title}**\n\n${description}\n\n📸 **${attachments.length} images uploaded**`;

            // I-edit ang initial message
            if (isForum) {
                const firstMsg = await thread.messages.fetch(thread.id); // Kunin ang unang mensahe
                await firstMsg.edit({
                    content: finalContent
                });
            } else {
                await initialMessage.edit({
                    content: finalContent
                });
            }

            // I-confirm
            await interaction.followUp({
                content: `✅ **Car showcase completed!**\n📌 ${isForum ? thread.url : `https://discord.com/channels/${interaction.guild.id}/${currentChannel.id}/${initialMessage.id}`}\n📸 ${attachments.length} images | 📝 Description added.`,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Showcase error:', error);
            if (error.code === 'time') {
                await interaction.editReply({
                    content: '⏳ Timeout: Hindi ka nag-type ng description sa loob ng 5 minuto. Maaari mo itong i-edit manually.'
                });
            } else {
                await interaction.editReply({
                    content: `❌ Nagka-error: ${error.message}`
                }).catch(() => {});
            }
        }
    }
};
