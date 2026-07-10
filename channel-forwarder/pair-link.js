// pair-link.js — Re-link the WhatsApp bot session using a PAIRING CODE (no QR needed)
//
// Use this instead of scanning a QR when the session expires.
// It writes to the SAME ./cron-session folder that smart-cron.js uses,
// so after linking, smart-cron.js works exactly as before. smart-cron.js is NOT modified.
//
// USAGE (on VPS):
//   cd /var/www/HireHub2/channel-forwarder
//   rm -rf cron-session
//   xvfb-run -a node pair-link.js 9665XXXXXXXX
//
// (Replace 9665XXXXXXXX with the bot's full number: country code + number, NO + sign, NO spaces)
//
// Then on your phone:
//   WhatsApp → ⋮ → Linked Devices → Link a Device → "Link with phone number instead"
//   → enter the 8-character code shown in the terminal.
//
// When you see "✅ LINKED! Session saved." press Ctrl+C. Done.

require('dotenv').config({ path: '/var/www/HireHub2/.env' });
const { Client, LocalAuth } = require('whatsapp-web.js');

const phoneNumber = (process.argv[2] || '').replace(/[^0-9]/g, '');

if (!phoneNumber || phoneNumber.length < 10) {
    console.error('');
    console.error('❌ Missing or invalid phone number.');
    console.error('');
    console.error('Usage:  xvfb-run -a node pair-link.js 9665XXXXXXXX');
    console.error('        (country code + number, no + sign, no spaces)');
    console.error('');
    process.exit(1);
}

console.log('');
console.log('🔗 WhatsApp Bot Re-Link Tool (pairing code — no QR)');
console.log(`📞 Number: ${phoneNumber}`);
console.log('⏳ Starting browser... (this can take 30–60 seconds, be patient)');
console.log('');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './cron-session' }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

let codeRequested = false;

// The 'qr' event fires when WhatsApp is ready to accept auth.
// Instead of showing the QR, we immediately request a pairing code.
client.on('qr', async () => {
    if (codeRequested) return;   // qr event can fire multiple times — only request once
    codeRequested = true;
    try {
        const code = await client.requestPairingCode(phoneNumber);
        console.log('');
        console.log('══════════════════════════════════════════════');
        console.log(`   🔑 PAIRING CODE:  ${code}`);
        console.log('══════════════════════════════════════════════');
        console.log('');
        console.log('On your phone, RIGHT NOW (code expires in ~1 minute):');
        console.log('  WhatsApp → ⋮ → Linked Devices → Link a Device');
        console.log('  → "Link with phone number instead" → enter the code above');
        console.log('');
        console.log('⏳ Waiting for you to enter the code...');
    } catch (err) {
        console.error('❌ Failed to request pairing code:', err.message);
        console.error('   Check the number format (country code + number, no + sign).');
        process.exit(1);
    }
});

client.on('authenticated', () => {
    console.log('🔐 Authenticated! Saving session...');
});

client.on('ready', () => {
    console.log('');
    console.log('✅ LINKED! Session saved to ./cron-session');
    console.log('   smart-cron.js will now work as before.');
    console.log('');
    console.log('   Press Ctrl+C to exit, then (optional) test with:');
    console.log('   ./run-smart.sh');
    console.log('');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Auth failure:', msg);
    process.exit(1);
});

client.on('disconnected', (reason) => {
    console.error('❌ Disconnected:', reason);
    process.exit(1);
});

client.initialize();

// Safety timeout — 5 minutes to complete the whole process
setTimeout(() => {
    console.error('');
    console.error('⏰ Timeout (5 min). Run the tool again and enter the code faster —');
    console.error('   pairing codes expire quickly (~1 minute after appearing).');
    process.exit(1);
}, 300000);
