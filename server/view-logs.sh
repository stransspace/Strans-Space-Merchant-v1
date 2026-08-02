#!/bin/bash
# Script untuk melihat log server di production

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== POS Coffee - Production Logs ===${NC}"
echo ""

# Check if pm2 is running
if command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 Logs:${NC}"
    pm2 logs pos-coffee --lines 50
else
    echo -e "${YELLOW}Node.js process logs not found. Check manually.${NC}"
fi

# Check Apache error logs
if [ -f "/var/log/apache2/error.log" ]; then
    echo -e "\n${YELLOW}Apache Error Logs (last 20 lines):${NC}"
    tail -n 20 /var/log/apache2/error.log
fi

# Check for application log file if exists
if [ -f "server.log" ]; then
    echo -e "\n${YELLOW}Application Logs:${NC}"
    tail -n 50 server.log
fi

echo -e "\n${GREEN}=== End of Logs ===${NC}"
