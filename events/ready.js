const { Events, ActivityType } = require("discord.js");

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		client.user.setPresence({
			activities: [
				{
					name: "杖劍傳說：坎斯汀之約",
					type: ActivityType.Playing,
					state: "杖劍傳說：坎斯汀之約",
				},
			],
			status: "online",
		});
	},
};
