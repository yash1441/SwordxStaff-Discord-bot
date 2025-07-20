const {
	MessageFlags,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ActionRowBuilder,
} = require("discord.js");
require("dotenv").config();

module.exports = {
	cooldown: 10,
	data: {
		name: "content-submission",
	},
	async execute(interaction) {
		const platformSelectMenu = new StringSelectMenuBuilder()
			.setCustomId("platform-select")
			.setPlaceholder("Select a platform")
			.addOptions([
				new StringSelectMenuOptionBuilder()
					.setLabel("YouTube")
					.setValue("YouTube"),
				new StringSelectMenuOptionBuilder()
					.setLabel("YouTube Shorts")
					.setValue("YouTube Shorts"),
				new StringSelectMenuOptionBuilder()
					.setLabel("TikTok")
					.setValue("TikTok"),
				new StringSelectMenuOptionBuilder()
					.setLabel("Discord")
					.setValue("Discord"),
				new StringSelectMenuOptionBuilder()
					.setLabel("巴哈姆特")
					.setValue("巴哈姆特"),
			]);
		const platformSelectMenuRow = new ActionRowBuilder().addComponents(
			platformSelectMenu
		);

		await interaction.reply({
			content: "Please select the platform for your content submission:",
			components: [platformSelectMenuRow],
			flags: MessageFlags.Ephemeral,
		});
	},
};
