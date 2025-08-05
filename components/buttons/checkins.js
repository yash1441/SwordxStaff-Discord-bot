const {
	MessageFlags,
	EmbedBuilder,
	inlineCode,
	codeBlock,
} = require("discord.js");
const Database = require("better-sqlite3");
const path = require("path");
require("dotenv").config();

const checkinsDB = new Database(
	path.join(__dirname, "../../db/checkins.sqlite")
);
const codesDB = new Database(path.join(__dirname, "../../db/codes.sqlite"));

checkinsDB.exec(`
  CREATE TABLE IF NOT EXISTS checkins (
    user_id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0,
	last_checkin TEXT NOT NULL,
	rewards TEXT NOT NULL DEFAULT '[]',
	max_streak INTEGER NOT NULL DEFAULT 0
  )
`);

module.exports = {
	cooldown: 5,
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
		const currentDate = now.toLocaleDateString("sv-SE", {
			timeZone: "Asia/Singapore", // UTC+8
		});

		const interactionReply = isNewUser(userId)
			? await createCheckin(userId, username, currentDate)
			: await updateCheckin(userId, currentDate);

		await interaction.editReply(interactionReply);
	},
};

function isNewUser(userId) {
	// Check if the user already has a check-in record
	const existingCheckin = checkinsDB
		.prepare("SELECT * FROM checkins WHERE user_id = ?")
		.get(userId);

	console.log(
		`Checking if user ${userId} is new: ${!existingCheckin ? "Yes" : "No"}`
	);
	// If no record exists, the user is new
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
		.setTitle("日常簽到")
		.setDescription(`✅ ${username}，你已成功簽到！`)
		.addFields({
			name: "當前累計簽到天數",
			value: `${inlineCode(streak.toString())} 天`,
		})
		.setTimestamp();

	let rewards = [];
	const reward = getLocalReward(streak);

	console.log(
		`Creating check-in for user ${userId} with streak ${streak} on ${currentDate}`
	);

	if (reward) {
		rewards = [reward];
		console.log(
			`Reward for streak ${streak} found: ${reward}. Updating local reward.`
		);
		updateLocalReward(streak, userId);
		embed.addFields({
			name: "獎勵",
			value: codeBlock(rewards.join(", ")),
		});
	} else {
		console.log(
			`No reward found for streak ${streak}. Adding default message.`
		);
		embed.addFields({
			name: "獎勵",
			value: codeBlock("尚未獲得任何獎勵。"),
		});
	}

	checkinsDB
		.prepare(
			`
		INSERT INTO checkins (user_id, username, streak, last_checkin, rewards)
		VALUES (?, ?, ?, ?, ?)
	`
		)
		.run(userId, username, streak, currentDate, JSON.stringify(rewards));

	return {
		embeds: [embed],
	};
}

async function updateCheckin(userId, currentDate) {
	const embed = new EmbedBuilder()
		.setColor(process.env.EMBED_COLOR)
		.setTitle("日常簽到")
		.setTimestamp();

	const row = checkinsDB
		.prepare("SELECT * FROM checkins WHERE user_id = ?")
		.get(userId);

	const lastCheckin = new Date(row.last_checkin);
	const now = new Date();

	const lastDate = row.last_checkin;

	console.log(
		`Updating check-in for user ${userId} with last check-in on ${lastDate} and current date ${currentDate}`
	);

	// Parse rewards safely
	let rewards = [];
	try {
		rewards = JSON.parse(row.rewards);
	} catch {
		rewards = [];
		console.error(
			`Failed to parse rewards for user ${userId}. Using empty array.`
		);
	}

	if (lastDate === currentDate) {
		embed.setDescription(`⏳ ${row.username}，您已完成今日簽到。請明日再試。`);
		embed.addFields(
			{
				name: "當前累計簽到天數",
				value: `${inlineCode(row.streak.toString())} 天`,
			},
			{
				name: "獎勵",
				value: codeBlock(
					rewards.length ? rewards.join(", ") : "尚未獲得任何獎勵。"
				),
			}
		);

		console.log(
			`User ${userId} has already checked in today. Returning existing streak and rewards.`
		);

		return {
			embeds: [embed],
		};
	}

	// Calculate streak
	const days = daysBetween(lastCheckin, now);
	// const newStreak = days <= 5 ? row.streak + 1 : 1;
	const newStreak = row.streak + 1;
	const isReset = newStreak === 1;

	const updateCheckin = checkinsDB.prepare(
		`UPDATE checkins
		SET streak = ?, last_checkin = ?, rewards = ?
		WHERE user_id = ?`
	);

	if (isReset) {
		// Update max_streak to previous streak if it's higher

		console.log(
			`User ${userId} has not checked in for more than 5 days. Resetting streak to 1.`
		);

		if (row.streak > row.max_streak) {
			checkinsDB
				.prepare(`UPDATE checkins SET max_streak = ? WHERE user_id = ?`)
				.run(row.streak, userId);
		}
		updateCheckin.run(newStreak, currentDate, JSON.stringify(rewards), userId);
		embed.setDescription(
			`🔄 ${row.username}，您已有5天未進行簽到，累計簽到次數已重置為1。`
		);
		embed.addFields(
			{
				name: "當前累計簽到天數",
				value: `${inlineCode(newStreak.toString())} 天`,
			},
			{
				name: "獎勵",
				value: codeBlock(
					rewards.length ? rewards.join(", ") : "尚未獲得任何獎勵。"
				),
			}
		);

		return {
			embeds: [embed],
		};
	}

	// If streak continues
	embed.setDescription(`✅ ${row.username}，你已成功簽到！`);
	embed.addFields({
		name: "當前累計簽到天數",
		value: `${inlineCode(newStreak.toString())} 天`,
	});

	// After calculating newStreak
	const shouldGiveReward = newStreak > row.max_streak;
	let rewardGiven = false;

	if (shouldGiveReward) {
		const reward = getLocalReward(newStreak);
		if (reward) {
			rewards.push(reward);
			updateLocalReward(newStreak, userId);
			checkinsDB
				.prepare(`UPDATE checkins SET max_streak = ? WHERE user_id = ?`)
				.run(newStreak, userId);
			rewardGiven = true;
			console.log(
				`Reward for new streak ${newStreak} found: ${reward}. Updating local reward.`
			);
		}
	}

	embed.addFields({
		name: "獎勵",
		value: codeBlock(
			rewards.length ? rewards.join(", ") : "尚未獲得任何獎勵。"
		),
	});

	if (shouldGiveReward && !rewardGiven) {
		console.log(
			`No reward found for new streak ${newStreak}. Adding default message.`
		);
		// Just return the normal embed (no error message)
		updateCheckin.run(newStreak, currentDate, JSON.stringify(rewards), userId);
		return {
			embeds: [embed],
		};
	}

	updateCheckin.run(newStreak, currentDate, JSON.stringify(rewards), userId);
	return {
		embeds: [embed],
	};
}

function getLocalReward(day) {
	const dayStr = String(day); // Ensure day is a string
	const row = codesDB
		.prepare("SELECT reward FROM codes WHERE day = ? AND discord_id = ''")
		.get(dayStr);

	console.log(`Fetching local reward for day ${dayStr}:`, row);
	return row ? row.reward : null;
}

function updateLocalReward(day, userId) {
	const dayStr = String(day); // Ensure day is a string
	codesDB
		.prepare(
			"UPDATE codes SET discord_id = ? WHERE day = ? AND discord_id = ''"
		)
		.run(userId, dayStr);
}
