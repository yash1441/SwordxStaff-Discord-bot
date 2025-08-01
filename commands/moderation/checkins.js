const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
	codeBlock,
} = require("discord.js");
const Database = require("better-sqlite3");
const path = require("path");
require("dotenv").config();

const checkinsDB = new Database(
	path.join(__dirname, "../../db/checkins.sqlite")
);

const codesDB = new Database(path.join(__dirname, "../../db/codes.sqlite"));

codesDB.exec(`
  CREATE TABLE IF NOT EXISTS codes (
    reward TEXT PRIMARY KEY NOT NULL,
    day INTEGER NOT NULL DEFAULT 0,
    user_id TEXT
  )
`);

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
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("query")
				.setDescription("Send a query to the checkins database")
				.addStringOption((option) =>
					option
						.setName("query")
						.setDescription("The query to send to the database")
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("view")
				.setDescription("View a user's checkins record")
				.addUserOption((option) =>
					option
						.setName("user")
						.setDescription("The user to view checkins for")
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("transfer")
				.setDescription("Temporary command to transfer checkins to sqlite")
				.addStringOption((option) =>
					option
						.setName("base_id")
						.setDescription("The base ID to transfer from")
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName("table_id")
						.setDescription("The table ID to transfer from")
						.setRequired(true)
				)
		),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (interaction.options.getSubcommand() === "delete") {
			const user = interaction.options.getUser("user");

			const result = checkinsDB
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
		} else if (interaction.options.getSubcommand() === "query") {
			const query = interaction.options.getString("query");
			let result;
			try {
				if (query.trim().toUpperCase().startsWith("SELECT")) {
					result = checkinsDB.prepare(query).all();
				} else {
					result = checkinsDB.prepare(query).run();
				}
				await interaction.editReply({
					content: `✅ Query executed successfully: ${JSON.stringify(result)}`,
				});
			} catch (err) {
				await interaction.editReply({
					content: `❌ Query error: ${err.message}`,
				});
			}
		} else if (interaction.options.getSubcommand() === "view") {
			const user = interaction.options.getUser("user");
			const checkin = checkinsDB
				.prepare("SELECT * FROM checkins WHERE user_id = ?")
				.get(user.id);

			if (!checkin) {
				await interaction.editReply({
					content: `❌ No check-in entry found for ${user.username}.`,
				});
			} else {
				await interaction.editReply({
					content: `✅ Check-in entry found for ${user.username}: ${codeBlock(
						JSON.stringify(checkin)
					)}`,
				});
			}
		} else if (interaction.options.getSubcommand() === "transfer") {
			const baseId = interaction.options.getString("base_id");
			const tableId = interaction.options.getString("table_id");
			const response = await lark.listRecords(baseId, tableId);

			if (!response || !response.items)
				return await interaction.editReply({
					content: "❌ Failed to fetch records from Lark.",
				});

			const insertCodes = codesDB.prepare(
				`INSERT OR REPLACE INTO codes (reward, day, user_id) VALUES (?, ?, ?)`
			);

			let count = 0;
			for (const item of response.items) {
				const reward = item.fields.Reward;
				const day = item.fields.Day;
				const userId = item.fields["Discord ID"] || "";

				insertCodes.run(reward, day, userId);
				count++;
			}

			await interaction.editReply({
				content: `✅ Transferred ${count} records from Lark to codes database.`,
			});
		}
	},
};
