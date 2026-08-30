import { MessageFlags } from 'discord.js';

import { createTicket } from '../../../services/ticket.js';
import { getGuildConfig } from '../../../services/config/guildConfig.js';

import { successEmbed } from '../../../utils/embeds.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';


async function createCategoryTicket(
    interaction,
    client,
    type,
    reason
) {
    try {
        if (!interaction.inGuild()) {
            return;
        }

        const deferred =
            await InteractionHelper.safeDefer(
                interaction,
                {
                    flags: MessageFlags.Ephemeral,
                }
            );

        if (!deferred) {
            return;
        }

        const config =
            await getGuildConfig(
                client,
                interaction.guildId
            );

        const categoryId =
            config.ticketCategoryId || null;

        const { channel } =
            await createTicket(
                interaction.guild,
                interaction.member,
                categoryId,
                reason
            );

        await InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [
                    successEmbed(
                        '🎫 Ticket Created',
                        `Your **${type}** ticket has been created!\n\n` +
                        `📩 ${channel}\n\n` +
                        `A staff member will assist you shortly.`
                    ),
                ],
            }
        );

    } catch (error) {
        await handleInteractionError(
            interaction,
            error,
            {
                type: 'button',
                handler: 'category_ticket',
                customId: interaction.customId,
            }
        );
    }
}


// ==========================================
// 🛒 BUY / TRADE
// ==========================================

const buyTicketHandler = {
    name: 'ticket_buy',

    async execute(interaction, client) {
        await createCategoryTicket(
            interaction,
            client,
            'Buy / Trade',
            'Buy / Trade'
        );
    },
};


// ==========================================
// 🔧 SUPPORT
// ==========================================

const supportTicketHandler = {
    name: 'ticket_support',

    async execute(interaction, client) {
        await createCategoryTicket(
            interaction,
            client,
            'Support',
            'Support'
        );
    },
};


// ==========================================
// 🤝 PARTNERSHIP
// ==========================================

const partnershipTicketHandler = {
    name: 'ticket_partnership',

    async execute(interaction, client) {
        await createCategoryTicket(
            interaction,
            client,
            'Partnership',
            'Partnership'
        );
    },
};


export default [
    buyTicketHandler,
    supportTicketHandler,
    partnershipTicketHandler,
];
