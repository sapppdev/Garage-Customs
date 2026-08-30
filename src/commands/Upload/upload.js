import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    ThreadAutoArchiveDuration
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('upload')
        .setDescription('Mag-upload ng RAR/ZIP file (isang file lang)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addAttachmentOption(option =>
            option
                .setName('file')
                .setDescription('Pumili ng RAR o ZIP file')
                .setRequired(true)
        ),

    category: 'Upload',

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const file = interaction.options.getAttachment('file');

        // I-validate kung RAR o ZIP
        const fileName = file.name.toLowerCase();
        const validExtensions = ['.rar', '.zip'];
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            return await interaction.editReply({
                content: '❌ **.RAR** o **.ZIP** file lang ang puwede.'
            });
        }

        // I-check ang file size (Discord limit: 25MB, or 500MB if boosted)
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (file.size > maxSize) {
            return await interaction.editReply({
                content: `❌ Ang file ay **${(file.size / (1024 * 1024)).toFixed(2)} MB**.\n` +
                         `Limit: **25 MB** lang.`
            });
        }

        const currentChannel = interaction.channel;
        const isForum = currentChannel.type === ChannelType.GuildForum;
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

        try {
            // I-download ang file
            const response = await fetch(file.url, {
                headers: { Authorization: `Bot ${interaction.client.token}` }
            });
            if (!response.ok) throw new Error(`Failed to download: ${file.name}`);
            const buffer = await response.arrayBuffer();

            const attachment = {
                attachment: Buffer.from(buffer),
                name: file.name
            };

            const content = `📁 **${file.name}**\n📦 ${sizeMB} MB`;

            if (isForum) {
                // Forum channel: gumawa ng thread
                const thread = await currentChannel.threads.create({
                    name: file.name,
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                    message: {
                        content: content,
                        files: [attachment]
                    }
                });

                await interaction.editReply({
                    content: `✅ **File uploaded!**\n📌 ${thread.url}`
                });
            } else {
                // Text channel: send message
                await currentChannel.send({
                    content: content,
                    files: [attachment]
                });

                await interaction.editReply({
                    content: `✅ **File uploaded!**\n📌 <#${currentChannel.id}>`
                });
            }

        } catch (error) {
            console.error('Upload error:', error);
            await interaction.editReply({
                content: `❌ Nagka-error: ${error.message}`
            });
        }
    }
};
