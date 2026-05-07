require('dotenv').config({ path: '/var/www/HireHub2/.env' });
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const GROUP_ID = process.env.WHATSAPP_GROUP_ID;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './cron-session' }),
    puppeteer: { headless: true, args: ['--no-sandbox'] }
});

client.on('qr', qr => {
    console.log('Scan QR if required (but session likely exists)');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log(`Ready. Sending test message to group: ${GROUP_ID}`);
    try {
        await client.sendMessage(GROUP_ID, 'Test from cron bot');
        console.log('✅ Message sent successfully to group.');
    } catch (err) {
        console.error('❌ Failed to send:', err.message);
    }
    await client.destroy();
    process.exit(0);
});

client.initialize();
