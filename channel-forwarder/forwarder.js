// forwarder.js
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// --- Configuration ---
const SOURCE_GROUP_ID = '120363406555452902@g.us';   // Group where jobs are posted
const TARGET_CHANNEL_ID = '120363425421213722@newsletter'; // Your JobOrbit channel
// --------------------

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('🔐 Scan the QR code below with your dedicated WhatsApp number (the bot):');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ WhatsApp bot is ready and connected!');
    console.log(`📍 Monitoring group: ${SOURCE_GROUP_ID}`);
    console.log(`🔁 Will forward messages to channel: ${TARGET_CHANNEL_ID}`);
});

client.on('message', async (message) => {
    // Ignore messages that are not from the source group
    if (message.from !== SOURCE_GROUP_ID) return;

    // (Optional) Filter by keyword, e.g., only forward messages containing "Job Opportunity"
    // if (!message.body.includes('Job Opportunity')) return;

    console.log(`🔄 New message detected in source group. Forwarding to channel...`);
    try {
        await client.sendMessage(TARGET_CHANNEL_ID, message.body);
        console.log(`✅ Message forwarded successfully!`);
    } catch (error) {
        console.error(`❌ Failed to forward message:`, error);
    }
});

client.initialize();
