#!/bin/bash

echo "==================================="
echo "MONITORING API CALLS"
echo "==================================="
echo ""

echo "1. Active Connections to Orchestration:"
sudo netstat -tnp 2>/dev/null | grep -E "ESTABLISHED.*start_server"

echo ""
echo "2. start_server Process Info:"
ps aux | grep start_server | grep -v grep

echo ""
echo "3. Open Files by start_server:"
sudo lsof -p 794 2>/dev/null | grep -E "TCP|UNIX" | head -20

echo ""
echo "4. Recent Network Activity:"
sudo ss -tnp 2>/dev/null | grep -E "10.93.83.1|10.9.181.1" | head -10

echo ""
echo "==================================="
