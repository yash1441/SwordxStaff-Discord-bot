const { MessageFlags, inlineCode } = require("discord.js");
const lark = require("../../utils/lark");
const Database = require("better-sqlite3");
const path = require("path");
require("dotenv").config();

const db = new Database(path.join(__dirname, "../../db/checkins.sqlite"), {
	verbose: console.log,
});

db.exec(`
  CREATE TABLE IF NOT EXISTS checkins (
    user_id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0,
	last_checkin INTEGER NOT NULL,
	rewards TEXT NOT NULL DEFAULT '[]'
  )
`);

const getUserCheckin = (userId) => {
	return db.prepare("SELECT * FROM checkins WHERE user_id = ?").get(userId);
};

module.exports = {
	cooldown: 10,
	data: {
		name: "daily-sign-in",
	},
	async execute(interaction) {
		await interaction.deferReply({
			flags: MessageFlags.Ephemeral,
		});

		const userId = interaction.user.id;
		const username = interaction.user.username;

		const now = new Date();

		const currentDate = now.toISOString().split("T")[0];
		const currentTimestamp = Math.floor(now.getTime() / 1000);

		console.log(now, currentDate, currentTimestamp);

		getUserCheckin(userId)
			? console.log("User already exists in the database")
			: console.log("User does not exist, creating new entry");
	},
};
