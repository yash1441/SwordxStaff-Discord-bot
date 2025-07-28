const {
	MessageFlags,
	EmbedBuilder,
	inlineCode,
	codeBlock,
} = require("discord.js");
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
	last_checkin TEXT NOT NULL,
	rewards TEXT NOT NULL DEFAULT '[]'
  )
`);

module.exports = {
	cooldown: 1, // Change this later
	data: {
		name: "checkins",
	},
	async execute(interaction) {
		await interaction.deferReply({
			flags: MessageFlags.Ephemeral,
		});

		const userId = interaction.user.id;
		const username = interaction.user.username;

		const now = new Date();
		const currentDate = now.toISOString().split("T")[0];

		const interactionReply = isNewUser(userId)
			? await createCheckin(userId, username, currentDate)
			: await updateCheckin(userId, currentDate);

		await interaction.editReply(interactionReply);
	},
};

function isNewUser(userId) {
	// Check if the user already has a check-in record
	const existingCheckin = db
		.prepare("SELECT * FROM checkins WHERE user_id = ?")
		.get(userId);

	return !existingCheckin;
}

function daysBetween(date1, date2) {
	const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
	const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());

	const diffTime = d2 - d1;
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
	return diffDays;
}

async function createCheckin(userId, username, currentDate) {
	const streak = 1; // Initial streak for new users

	const embed = new EmbedBuilder()
		.setColor(process.env.EMBED_COLOR)
		.setTitle("CLAIMED SUCCESSFULLY!")
		.addFields({
			name: "Current Streak",
			value: `${inlineCode(streak.toString())} Day`,
		})
		.setTimestamp();

	const response = await lark.listRecords(
		process.env.DAILY_REWARDS_BASE,
		process.env.DAILY_REWARDS_TABLE,
		{
			filter: `AND(CurrentValue.[Discord ID] = "", CurrentValue.[Day] = ${streak})`,
		}
	);

	let rewards = [];
	if (response && response.total > 0) {
		rewards = [response.items[0].fields.Reward];

		const success = await lark.updateRecord(
			process.env.DAILY_REWARDS_BASE,
			process.env.DAILY_REWARDS_TABLE,
			response.items[0].record_id,
			{ fields: { "Discord ID": userId } }
		);

		if (!success)
			return {
				content: `❌ Failed to update rewards for ${username}. Please try again later.`,
			};

		embed.addFields({
			name: "Rewards",
			value: codeBlock(rewards.join(", ") || "No rewards earned yet."),
		});
	} else {
		embed.addFields({
			name: "Rewards",
			value: codeBlock("No rewards earned yet."),
		});
	}

	db.prepare(
		`
		INSERT INTO checkins (user_id, username, streak, last_checkin, rewards)
		VALUES (?, ?, ?, ?, ?)
	`
	).run(userId, username, streak, currentDate, JSON.stringify(rewards));

	return {
		content: `✅ First check-in for ${username}! Your streak has started.`,
		embeds: [embed],
	};
}

async function updateCheckin(userId, currentDate) {
	const row = db
		.prepare("SELECT * FROM checkins WHERE user_id = ?")
		.get(userId);

	const lastCheckin = new Date(row.last_checkin);
	const now = new Date();

	const lastDate = row.last_checkin;

	if (lastDate === currentDate)
		return {
			content: `⏳ ${row.username}, you've already checked in today. Please try again tomorrow.`,
		};

	// Calculate streak
	const days = daysBetween(lastCheckin, now);
	const newStreak = days <= 5 ? row.streak + 1 : 1;

	// Add a new reward
	const rewards = JSON.parse(row.rewards);
	const newReward = `reward${newStreak}`; // Get the reward based on the streak from Lark
	rewards.push(newReward);

	db.prepare(
		`UPDATE checkins
		SET streak = ?, last_checkin = ?, rewards = ?
		WHERE user_id = ?`
	).run(newStreak, currentDate, JSON.stringify(rewards), userId);

	return {
		content: `✅ ${row.username}, you checked in!\n🔥 Streak: ${newStreak}\n🎁 Reward: ${newReward}`,
	};
}
