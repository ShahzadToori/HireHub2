#!/bin/bash
# Kill any leftover browser processes (avoids "browser already running")
pkill -f chromium 2>/dev/null
pkill -f puppeteer 2>/dev/null
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null
cd /var/www/HireHub2/channel-forwarder
exec xvfb-run -a node forwarder.js
