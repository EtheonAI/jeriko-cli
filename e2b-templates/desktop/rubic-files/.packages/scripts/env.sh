#!/bin/bash

SANDBOX_SERVER_PORT=9330
if ! grep -q "SANDBOX_SERVER_PORT=" "/home/ubuntu/.env"; then
    echo "export SANDBOX_SERVER_PORT=\"$SANDBOX_SERVER_PORT\"" >> /home/ubuntu/.env
fi