require('dotenv').config({ path: '/var/www/HireHub2/.env' });
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './cron-session' }),
    puppeteer: { headless: true, args: ['--no-sandbox'] }
});

client.on('ready', () => {
    console.log('✅ Bot ready. Waiting for a message in your target group...');
    console.log('👉 Send any message to the group now (from any number).');
});

client.on('message', async msg => {
    if (msg.from.endsWith('@g.us')) {
        const groupName = (await msg.getChat()).name;
        console.log(`\n🎯 Group Name: ${groupName}`);
        console.log(`📌 Group ID: ${msg.from}`);
        console.log(`   (Copy this ID and put it in .env as WHATSAPP_GROUP_ID)`);
        await client.destroy();
        process.exit(0);
    }
});

client.initialize();
