#!/bin/bash

# Stop the app
forever stopall

# Update the code
cd ~/arbitrage-app
git pull
aws ssm get-parameter --with-decryption --name /crypto-arbitrage/env --output text --query Parameter.Value > ~/arbitrage-app/.env

# Start the app
npm install
npm run start:prod