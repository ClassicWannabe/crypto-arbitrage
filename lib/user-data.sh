#!/bin/bash

# Update and install Node.js
sudo yum update -y
sudo yum install -y nodejs20 git

sudo ln -s /usr/bin/node-20 /usr/bin/node
sudo ln -s /usr/bin/npm-20 /usr/bin/npm

npm install -g yarn

sudo mkdir -p /home/my-user/arbitrage-app

sudo aws ssm get-parameter --with-decryption --name /github/deploy-key --output text --query Parameter.Value > /home/my-user/.ssh/id_ed25519_arbitrage_server

sudo git clone git@github.com:ClassicWannabe/crypto-arbitrage.git /home/my-user/arbitrage-app/

sudo aws ssm get-parameter --with-decryption --name /crypto-arbitrage/env --output text --query Parameter.Value > /home/my-user/arbitrage-app/.env

sudo cd /home/my-user/arbitrage-app

sudo yarn install --prod

sudo yarn start:prod