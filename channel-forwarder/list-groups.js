require('dotenv').config({ path: '/var/www/HireHub2/.env' });
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './cron-session' }),
    puppeteer: { headless: true, args: ['--no-sandbox'] }
});

client.on('ready', async () => {
    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);
    console.log('Groups this bot is a member of:');
    groups.forEach(g => console.log(`- Name: ${g.name}, ID: ${g.id._serialized}`));
    await client.destroy();
    process.exit(0);
});

client.initialize();
