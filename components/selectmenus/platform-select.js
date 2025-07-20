const {} = require("discord.js");
const { submitContent } = require("../../utils/creator");
require("dotenv").config();

module.exports = {
	data: {
		name: "platform-select",
	},
	async execute(interaction) {
		const platform = interaction.values[0];
		await submitContent(interaction, platform);
	},
};
