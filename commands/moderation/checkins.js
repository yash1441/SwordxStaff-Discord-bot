const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
} = require("discord.js");
const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.join(__dirname, "../../db/checkins.sqlite"));
require("dotenv").config();

module.exports = {
	category: "moderation",
	data: new SlashCommandBuilder()
		.setName("checkins")
		.setDescription("Checkins related commands")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("delete")
				.setDescription("Delete a user's checkins record")
				.addUserOption((option) =>
					option
						.setName("user")
						.setDescription("The user to delete checkins for")
						.setRequired(true)
				)
		),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (interaction.options.getSubcommand() === "delete") {
			const user = interaction.options.getUser("user");

			const result = db
				.prepare("DELETE FROM checkins WHERE user_id = ?")
				.run(user.id);

			if (!result.changes) {
				await interaction.editReply({
					content: `❌ No check-in entry found for ${user.username}.`,
				});
			} else {
				await interaction.editReply({
					content: `✅ Check-in entry deleted for ${user.username}.`,
				});
			}
		}
	},
};
