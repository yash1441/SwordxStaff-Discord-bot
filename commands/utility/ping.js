const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    cooldown: 5,
    category: "utility",
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong!"),
    async execute(interaction) {
        const reply = await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
            withResponse: true,
        });

        await interaction.editReply({
            content:
                "API Latency: " +
                interaction.client.ws.ping +
                "ms\nClient Ping: " +
                (
                    reply.resource.message.createdTimestamp -
                    interaction.createdTimestamp
                ).toString() +
                "ms",
        });
    },
};
