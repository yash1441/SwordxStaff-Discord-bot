const {
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ComponentType,
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	bold,
	inlineCode,
} = require("discord.js");
const lark = require("./lark");
require("dotenv").config();

const topicOptions = [
	"基礎指南",
	"裝備",
	"技能",
	"BOSS",
	"職業",
	"升級",
	"公會",
	"副本",
	"其他",
];

async function submitContent(interaction, platform) {
	await interaction.deferReply({ ephemeral: true });

	const submissionData = {
		guildId: interaction.guildId,
		userId: interaction.user.id,
		name: interaction.user.username,
		platform: platform,
	};

	const submissionModal = new ModalBuilder().setCustomId("submission-modal");

	const submissionModalLink = new ActionRowBuilder().addComponents(
		new TextInputBuilder()
			.setCustomId("link")
			.setLabel("攻略連結")
			.setStyle(TextInputStyle.Short)
	);
	const submissionModalTheme = new ActionRowBuilder().addComponents(
		new TextInputBuilder()
			.setCustomId("theme")
			.setLabel("攻略主題")
			.setStyle(TextInputStyle.Short)
	);

	submissionModal.addComponents(submissionModalLink, submissionModalTheme);

	const topicSelectMenu = new StringSelectMenuBuilder()
		.setCustomId("submission-topic")
		.setPlaceholder("選擇類型")
		.addOptions(
			topicOptions.map((label) =>
				new StringSelectMenuOptionBuilder().setLabel(label).setValue(label)
			)
		);
	const topicRow = new ActionRowBuilder().addComponents(topicSelectMenu);

	await interaction.editReply({
		content: bold("您的攻略類型是？"),
		components: [topicRow],
	});
	const botReply = await interaction.fetchReply();

	const collector = botReply.createMessageComponentCollector({
		time: 10_000,
		componentType: ComponentType.StringSelect,
	});

	collector.on("collect", async (topicInteraction) => {
		submissionData.topic = topicInteraction.values[0];
		submissionModal.setTitle(submissionData.topic);

		await topicInteraction.showModal(submissionModal);

		botReply.modalReply = await topicInteraction
			.awaitModalSubmit({
				time: 60_000,
				filter: (modalInteraction) =>
					modalInteraction.user.id === topicInteraction.user.id,
			})
			.catch(() => {
				interaction.editReply({
					content: "表單已過期",
					components: [],
				});
				setTimeout(() => interaction.deleteReply(), 10_000);
			});

		collector.stop();

		if (!submissionData.topic || !botReply.modalReply) return;

		await botReply.modalReply.reply({
			content: bold(submissionData.topic),
			ephemeral: true,
		});

		await botReply.modalReply.deleteReply();

		submissionData.link = botReply.modalReply.fields.getTextInputValue("link");
		submissionData.theme =
			botReply.modalReply.fields.getTextInputValue("theme");

		await interaction.editReply({
			content:
				"您的作品已提交\nTopic " +
				inlineCode(submissionData.topic) +
				"\nLink " +
				inlineCode(submissionData.link) +
				"\nTheme " +
				inlineCode(submissionData.theme),
			components: [],
		});

		const records = await lark.listRecords(
			process.env.CREATOR_BASE,
			process.env.SUBMISSION_TABLE,
			{
				filter: 'CurrentValue.[Video].contains("' + submissionData.link + '")',
			}
		);

		if (records.total)
			return console.log(submissionData.link, " already submitted.");

		const success = await lark.createRecord(
			process.env.CREATOR_BASE,
			process.env.SUBMISSION_TABLE,
			{
				fields: {
					"Discord ID": submissionData.userId,
					"Discord Name": submissionData.name,
					Platform: submissionData.platform,
					Video: {
						link: submissionData.link,
						text: submissionData.theme,
					},
					Topic: submissionData.topic,
				},
			}
		);

		if (!success) return console.warn("Could not create record.");
	});

	collector.on("end", (collected, reason) => {
		if (reason === "time" && !collected.size) {
			interaction.editReply({
				content: "所選內容已過期",
				components: [],
			});
			setTimeout(() => interaction.deleteReply(), 10_000);
		}
	});
}

module.exports = { submitContent };
