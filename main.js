// Require the necessary discord.js classes and the bot token
const { Client, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

// Bot channels
const { channel } = require('./config.json');

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

// Message structure validation function
function validateMessageStructure(message) {
	const content = message.content.toLowerCase();

	const userPattern = /^jogador:\s*<@!?\d+>\s*$/m;
	const operationPattern = /^(deposita|retira):\s*\d+\s*po\s*$/m;
	const totalPattern = /^ouro total:\s*\d+\s*po\s*$/m;
	const linkPattern = /^origem:\s*https:\/\/discord.com\/channels.+\s*/m;

	if (!userPattern.test(content)) return { valid: false, reason: 'Usuário fora do padrão' };
	if (!operationPattern.test(content)) return { valid: false, reason: 'Operação fora do padrão' };
	if (!totalPattern.test(content)) return { valid: false, reason: 'Total fora do padrão' };
	if (!linkPattern.test(content)) return { valid: false, reason: 'Origem fora do padrão' };

	return { valid: true };
}

// Function to calculate new total gold
function calculateNewTotal(lastTotal, action, amount) {
	if (action === 'deposita') {
		return lastTotal + amount;
	}
	else if (action === 'retira') {
		return lastTotal - amount;
	}

	return lastTotal;
}

// Function to get last message from triggering user
async function getLastMessage(channelId, userId) {
	// Tweak limit as needed
	const messages = await channelId.messages.fetch({ limit: 100 });
	const userMessages = messages.filter(msg => msg.author.id === userId && !msg.author.bot);

	const userMessagesArray = Array.from(userMessages.values());

	if (userMessagesArray.length < 2) return;

	const message = userMessagesArray[1];
	return message;
}

// Listener for new messages
client.on(Events.MessageCreate, async message => {
	// Checks if the channel is correct and the author of the message is not the bot
	if (message.channel.id !== channel) return;
	if (message.author.bot) return;

	// Validate message structure
	const validation = validateMessageStructure(message);
	if (!validation.valid) {
		await message.react('❌');
		await message.reply(validation.reason);
		return;
	}

	// Separate the info on the post for analysis
	const lines = message.content.toLowerCase().split('\n');
	const operationLine = lines.find(line => line.startsWith('deposita') || line.startsWith('retira'));
	const totalLine = lines.find(line => line.startsWith('ouro total'));
	const actionMatch = operationLine.match(/^(deposita|retira):\s*(\d+)\s*po$/m);
	const totalMatch = totalLine.match(/^ouro total:\s*(\d+)\s*po$/m);

	// Validate the mention with the authot
	const user = message.mentions.users.first();
	if (message.author.id !== user.id) {
		await message.react('❌');
		await message.reply('Jogador mencionado não é o autor do post');
		return;
	}

	// Setup the values for calculations of the current gold sum
	const action = actionMatch[1];
	const amount = parseInt(actionMatch[2]);
	const newTotal = parseInt(totalMatch[1]);

	// Fetch the last message to calculate the new amount of gold
	const lastMessage = await getLastMessage(message.channel, user.id);
	const lastTotal = lastMessage ? parseInt(lastMessage.content.toLowerCase().match(/^ouro total:\s*(\d+)\s*po$/m)[1]) : 0;

	// Validates sum
	const expectedTotal = calculateNewTotal(lastTotal, action, amount);
	if (newTotal !== expectedTotal) {
		await message.react('❌');
		await message.reply('Total incorreto');
		return;
	}

	await message.react('✅');
});

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
	console.log(`Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
client.login(token);