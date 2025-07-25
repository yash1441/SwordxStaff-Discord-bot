const { MessageFlags, inlineCode } = require("discord.js");
const lark = require("../../utils/lark");
const { Keyv } = require("keyv");
const path = require("path");
require("dotenv").config();

const dbPath = path.join(__dirname, "../../db/signin.sqlite");
const keyv = new Keyv(`sqlite://${dbPath}`);

keyv.on("error", (err) => console.error("Keyv connection error:", err));

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
		const now = new Date();

		// Fetch user's last claim info from Keyv
		let userRecord = await keyv.get(userId);
		let streak = 1;
		let lastClaim = userRecord?.lastClaim
			? new Date(userRecord.lastClaim)
			: null;

		if (lastClaim) {
			const diffDays = Math.floor((now - lastClaim) / (1000 * 60 * 60 * 24));
			if (diffDays === 0) {
				// Fetch today's reward for user's current streak
				const rewards = await lark.listRecords(
					process.env.DAILY_REWARDS_BASE,
					process.env.DAILY_REWARDS_TABLE,
					{
						filter: `AND(CurrentValue.[Day]=${userRecord.streak}, CurrentValue.[Discord ID]="${userId}")`,
					}
				);

				let rewardMsg = "No rewards available for today.";
				if (rewards.total && rewards.items.length > 0) {
					rewardMsg = inlineCode(rewards.items[0].fields.Reward);
				}

				return interaction.editReply({
					content: `You've already claimed today's reward.\nToday's Reward: ${rewardMsg}`,
					flags: MessageFlags.Ephemeral,
				});
			} else if (diffDays > 5) {
				streak = 1;
			} else {
				streak = userRecord.streak + 1;
			}
		}

		// Find available reward for this streak from Lark
		const rewards = await lark.listRecords(
			process.env.DAILY_REWARDS_BASE,
			process.env.DAILY_REWARDS_TABLE,
			{
				filter: `AND(CurrentValue.[Day]=${streak}, CurrentValue.[Discord ID]="")`,
			}
		);

		let reward;
		if (rewards.total && rewards.items.length > 0) {
			reward = rewards.items[0].fields.Reward;
			// Mark reward as claimed in Lark
			await lark.updateRecord(
				process.env.DAILY_REWARDS_BASE,
				process.env.DAILY_REWARDS_TABLE,
				rewards.items[0].record_id,
				{
					fields: { "Discord ID": userId },
				}
			);
		} else {
			reward = "No rewards available for today.";
		}

		// Update user's streak and last claim in Keyv
		await keyv.set(userId, {
			streak,
			lastClaim: now.toISOString(),
		});

		await interaction.editReply({
			content: `CLAIM SUCCESSFULLY!\nBonus Reward: ${inlineCode(
				reward
			)}\nCurrent Streak: ${streak} Days`,
			flags: MessageFlags.Ephemeral,
		});
	},
};
