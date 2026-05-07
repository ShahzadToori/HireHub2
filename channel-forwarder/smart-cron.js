// smart-cron.js – Send active jobs to channel, pending jobs to group
require('dotenv').config({ path: '/var/www/HireHub2/.env' });
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mysql = require('mysql2/promise');

// ----- Configuration -----
const GROUP_ID = process.env.WHATSAPP_GROUP_ID;       // For pending jobs
const CHANNEL_ID = process.env.WHATSAPP_CHANNEL_ID;   // For active jobs
const SITE_URL = 'https://joborbit.org';

if (!GROUP_ID || !CHANNEL_ID) {
    console.error('Missing WHATSAPP_GROUP_ID or WHATSAPP_CHANNEL_ID in .env');
    process.exit(1);
}
// -------------------------

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
});

function formatWhatsAppMessage(job) {
    const jobUrl = `${SITE_URL}/job/${job.slug}`;
    const siteName = 'JobOrbit';

    function stripPhoneNumbers(text) {
        let cleaned = text.replace(/(\+?9665|05)\d{8}/g, '')
            .replace(/(\+\d{1,3}[-.\s]?\d{6,})/g, '')
            .replace(/\d{4,}[-.\s]?\d{4,}/g, '');
        if (cleaned !== text && !cleaned.includes('📞 Contact details on website')) {
            cleaned += ' 📞 Contact details on website.';
        }
        return cleaned;
    }

    function stripEmails(text) {
        let cleaned = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '');
        if (cleaned !== text && !cleaned.includes('✉️ Email on website')) {
            cleaned += ' ✉️ Email on website.';
        }
        return cleaned;
    }

    let desc = (job.description || '').replace(/\n/g, ' ');
    desc = stripPhoneNumbers(desc);
    desc = stripEmails(desc);
    desc = desc.replace(/Contact:\s*/gi, '')
               .replace(/Phone:\s*/gi, '')
               .replace(/WhatsApp:\s*/gi, '');
    
    const truncatedDesc = desc.substring(0, 200) + (desc.length >= 200 ? '…' : '');
    const notice = `⚠️ *Important Notice:* 
▪ Verify job details before joining
▪ Do NOT pay anyone for job placement
▪ Only deal with verified sources`;

    return `🔥 *Job Opportunity on ${siteName}*\n\n` +
        `📋 *${job.title}*\n` +
        `🏢 ${job.company || 'Not specified'}\n` +
        `📍 ${job.location}\n` +
        `💼 ${job.job_type || 'Full-time'}\n\n` +
        `${truncatedDesc}\n\n` +
        `🔗 View & apply: ${jobUrl}\n\n` +
        `${notice}`;
}

let client = null;
let isReady = false;

// Initialize WhatsApp client (stores session in ./cron-session)
const initClient = () => {
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './cron-session' }),
        puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    });

    client.on('qr', (qr) => {
        console.log('📱 Scan this QR with the number that will SEND jobs (Number A):');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('✅ Smart cron bot ready!');
        isReady = true;
    });

    client.on('disconnected', (reason) => {
        console.error('❌ Disconnected:', reason);
        isReady = false;
    });

    client.initialize();
};

const sendMessage = async (to, text) => {
    if (!client || !isReady) throw new Error('Not ready');
    await client.sendMessage(to, text);
};

const main = async () => {
    try {
        // Fetch unsent jobs (whatsapp_sent = 0 or NULL) with status active or pending
        const [rows] = await pool.execute(
            `SELECT id, title, company, location, job_type, description, slug, status
             FROM jobs
             WHERE (whatsapp_sent IS NULL OR whatsapp_sent = 0)
               AND status IN ('active', 'pending')
             ORDER BY status DESC, id ASC`  // active first (optional)
        );
        if (rows.length === 0) {
            console.log('No pending jobs to send.');
            return;
        }
        console.log(`Found ${rows.length} unsent jobs.`);

        for (const job of rows) {
            const target = (job.status === 'active') ? CHANNEL_ID : GROUP_ID;
            const targetType = (job.status === 'active') ? 'channel' : 'group';
            const text = formatWhatsAppMessage(job);
            try {
                await sendMessage(target, text);
                await pool.execute('UPDATE jobs SET whatsapp_sent = 1 WHERE id = ?', [job.id]);
                console.log(`✅ Sent ${targetType} job #${job.id} (${job.status}): ${job.title}`);
            } catch (err) {
                console.error(`❌ Failed to send job #${job.id}:`, err.message);
                // Do not mark as sent; will retry next run
            }
            await new Promise(resolve => setTimeout(resolve, 2000)); // delay between messages
        }
    } catch (err) {
        console.error('Error in main:', err);
    } finally {
        await pool.end();
        if (client) await client.destroy();
        process.exit(0);
    }
};

// Startup
initClient();

let timer = setInterval(() => {
    if (isReady) {
        clearInterval(timer);
        main().catch(console.error);
    }
}, 1000);

setTimeout(() => {
    console.error('Timeout waiting for WhatsApp connection.');
    process.exit(1);
}, 180000);
