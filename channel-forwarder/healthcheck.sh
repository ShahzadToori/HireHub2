#!/bin/bash
LOG_FILE="/root/.pm2/logs/job-bot-out.log"

# If PM2 says the bot is offline, restart it
if ! pm2 list | grep -q "job-bot.*online"; then
    echo "$(date): Bot was offline – restarting" >> /var/log/bot-watchdog.log
    pm2 restart job-bot
fi

# Check if the bot is printing a QR code (session expired)
if tail -50 "$LOG_FILE" | grep -q "Scan this QR"; then
    echo "$(date): QR code detected – session expired. Manual action needed." >> /var/log/bot-watchdog.log
    # Optional: send a notification (see Step 6)
fi
