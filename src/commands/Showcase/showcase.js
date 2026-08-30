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
        .setDescription('Mag-upload ng car showcase (4 na larawan agad)')
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

        const currentChannel = interaction.channel;
        const isForum = currentChannel.type === ChannelType.GuildForum;

        // Kunin ang mga input
        const title = interaction.options.getString('title').trim();
        const description = interaction.options.getString('description').trim();
        const image1 = interaction.options.getAttachment('image1');
        const image2 = interaction.options.getAttachment('image2');
        const image3 = interaction.options.getAttachment('image3');
        const image4 = interaction.options.getAttachment('image4');

        // I-validate ang mga images
        const images = [image1, image2, image3, image4].filter(img => img !== null);
        
        // I-validate kung lahat ay images
        for (const img of images) {
            if (!img.contentType || !img.contentType.startsWith('image/')) {
                return await interaction.editReply({
                    content: `❌ Ang file na **${img.name}** ay hindi image. Please upload image files only.`
                });
            }
        }

        try {
            // I-download ang lahat ng images
            const attachments = [];
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                const response = await fetch(img.url, {
                    headers: { Authorization: `Bot ${interaction.client.token}` }
                });
                if (!response.ok) throw new Error(`Failed to download image ${i + 1}: ${response.status}`);
                const buffer = await response.arrayBuffer();
                attachments.push({
                    attachment: Buffer.from(buffer),
                    name: img.name || `car-image${i + 1}.png`
                });
            }

            // BUILd content
            let content = `**${title}**\n\n${description}`;
            
            // Add image count
            content += `\n\n**${attachments.length} images uploaded**`;

            // --- KUNG FORUM CHANNEL: Gumawa ng thread ---
            if (isForum) {
                const thread = await currentChannel.threads.create({
                    name: title,
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                    message: {
                        content: content,
                        files: attachments
                    }
                });

                await interaction.editReply({
                    content: `✅ **Car showcase posted!**\n📌 ${thread.url}\n📸 ${attachments.length} images uploaded.`
                });
            } 
            // --- KUNG TEXT CHANNEL: Send as normal message ---
            else {
                await currentChannel.send({
                    content: content,
                    files: attachments
                });

                await interaction.editReply({
                    content: `✅ **Car showcase posted!**\n📌 <#${currentChannel.id}>\n📸 ${attachments.length} images uploaded.`
                });
            }

        } catch (error) {
            console.error('Showcase error:', error);
            await interaction.editReply({
                content: `❌ Nagka-error: ${error.message}`
            }).catch(() => {});
        }
    }
};
