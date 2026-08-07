// smart-cron.js – Send active jobs to channel, pending jobs to group
require('dotenv').config({ path: '/var/www/HireHub2/.env' });
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mysql = require('mysql2/promise');
const { renderTemplate, DEFAULT_TEMPLATE, DEFAULT_NOTICE, DEFAULT_DESC_LENGTH } = require('./message-template');

// ----- Configuration -----
const GROUP_ID = process.env.WHATSAPP_GROUP_ID;       // For pending jobs
const CHANNEL_ID = process.env.WHATSAPP_CHANNEL_ID;   // For active jobs

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

// Message format is editable from admin → WhatsApp Bot (server/routes/admin-whatsapp.js
// writes these into the settings table); fall back to the built-in default
// so nothing breaks if the settings have never been touched.
async function loadMessageFormat() {
    const [rows] = await pool.execute(
        "SELECT `key`, `value` FROM settings WHERE `key` IN ('whatsapp_msg_template','whatsapp_desc_length','whatsapp_notice_text')"
    );
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    const descLength = parseInt(map.whatsapp_desc_length, 10);
    return {
        template: map.whatsapp_msg_template || DEFAULT_TEMPLATE,
        descLength: Number.isFinite(descLength) ? descLength : DEFAULT_DESC_LENGTH,
        notice: map.whatsapp_notice_text != null ? map.whatsapp_notice_text : DEFAULT_NOTICE,
    };
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
        const format = await loadMessageFormat();

        // Fetch unsent jobs (whatsapp_sent = 0 or NULL) with status active or pending
        const [rows] = await pool.execute(
            `SELECT j.id, j.title, j.company, j.location, j.job_type, j.description, j.slug, j.status,
                    j.salary, j.salary_min, j.salary_max, j.positions, c.name AS category
             FROM jobs j
             LEFT JOIN categories c ON c.id = j.category_id
             WHERE (j.whatsapp_sent IS NULL OR j.whatsapp_sent = 0)
               AND j.status IN ('active', 'pending')
             ORDER BY j.status DESC, j.id ASC`  // active first (optional)
        );
        if (rows.length === 0) {
            console.log('No pending jobs to send.');
            return;
        }
        console.log(`Found ${rows.length} unsent jobs.`);

        for (const job of rows) {
            const target = (job.status === 'active') ? CHANNEL_ID : GROUP_ID;
            const targetType = (job.status === 'active') ? 'channel' : 'group';
            const text = renderTemplate(format.template, job, { descLength: format.descLength, notice: format.notice });
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
