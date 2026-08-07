#!/bin/bash
cd /var/www/HireHub2/channel-forwarder
LOCK_FILE="./.reconnect.lock"
LOG_FILE="/var/log/smart-cron.log"

if [ -f "$LOCK_FILE" ]; then
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") [run-smart] skipped — reconnect in progress" >> "$LOG_FILE"
  exit 0
fi

echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") [run-smart] ===== run start =====" >> "$LOG_FILE"
xvfb-run -a node smart-cron.js >> "$LOG_FILE" 2>&1
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") [run-smart] ===== run end (exit $?) =====" >> "$LOG_FILE"
