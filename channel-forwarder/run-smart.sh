#!/bin/bash
cd /var/www/HireHub2/channel-forwarder
xvfb-run -a node smart-cron.js >> /var/log/smart-cron.log 2>&1
