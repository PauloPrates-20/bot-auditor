// Require the necessary discord.js classes and the bot token
const { Client, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

// Bot channels
const CHANNEL_ID = '1263634516325699695';

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
	const content = message.content;
	const userPattern = /^Jogador: <@.+$/m;
	const operationPattern = /^(Deposita|Retira): \d+ PO$/m;
	const totalPattern = /^Total: \d+ PO$/m;
	const linkPattern = /^Origem: https:\/\/discord.com\/channels.+/m;

	if (!userPattern.test(content)) return { valid: false, reason: 'Usuário fora do padrão' };
	if (!operationPattern.test(content)) return { valid: false, reason: 'Operação fora do padrão' };
	if (!totalPattern.test(content)) return { valid: false, reason: 'Total fora do padrão' };
	if (!linkPattern.test(content)) return { valid: false, reason: 'Origem fora do padrão' };

	return { valid: true };
}

// Function to calculate new total gold
function calculateNewTotal(lastTotal, action, amount) {
	if (action === 'Deposita') {
		return lastTotal + amount;
	}
	else if (action === 'Retira') {
		return lastTotal - amount;
	}

	return lastTotal;
}

// Function to get last message from triggering user
async function getLastMessage(channel, userId) {
	// Tweak limit as needed
	const messages = await channel.messages.fetch({ limit: 100 });
	const userMessages = messages.filter(msg => msg.author.id === userId && !msg.author.bot);

	const userMessagesArray = Array.from(userMessages.values());

	if (userMessagesArray.length < 2) return;

	const message = userMessagesArray[1];
	return message;
}

// Listener for new messages
client.on(Events.MessageCreate, async message => {
	if (message.channel.id !== CHANNEL_ID) return;
	if (message.author.bot) return;

	const validation = validateMessageStructure(message);
	if (!validation.valid) {
		await message.react('❌');
		await message.reply(validation.reason);
		return;
	}

	const lines = message.content.split('\n');
	const user = message.mentions.users.first();
	const operationLine = lines.find(line => line.startsWith('Deposita') || line.startsWith('Retira'));
	const totalLine = lines.find(line => line.startsWith('Total'));
	const actionMatch = operationLine.match(/^(Deposita|Retira): (\d+) PO$/m);
	const totalMatch = totalLine.match(/^Total: (\d+) PO$/m);

	const action = actionMatch[1];
	const amount = parseInt(actionMatch[2]);
	const newTotal = parseInt(totalMatch[1]);

	const lastMessage = await getLastMessage(message.channel, user.id);
	const lastTotal = lastMessage ? parseInt(lastMessage.content.match(/^Total: (\d+) PO$/m)[1]) : 0;

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