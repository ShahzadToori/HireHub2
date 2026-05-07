require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');

const PERSONAL_NUMBER = '923083993052' // replace with your phone number (including country code, no plus)

const client = new Client({ authStrategy: new LocalAuth({ dataPath: './cron-session' }), puppeteer: { headless: true, args: ['--no-sandbox'] } });

client.on('ready', async () => {
    const numberWithSuffix = PERSONAL_NUMBER + '@c.us';
    try {
        await client.sendMessage(numberWithSuffix, 'Test to personal number');
        console.log('✅ Message sent to personal number');
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
    await client.destroy();
    process.exit(0);
});
client.initialize();
