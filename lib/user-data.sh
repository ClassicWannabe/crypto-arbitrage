#!/bin/bash

# Update and install Node.js
sudo yum update -y
sudo yum install -y nodejs20 git

# Create symlinks
sudo ln -s /usr/bin/node-20 /usr/bin/node
sudo ln -s /usr/bin/npm-20 /usr/bin/npm

# Install and run Cloudwatch agent
sudo yum install -y amazon-cloudwatch-agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c ssm:/crypto-arbitrage/cloudwatch-config

# Get the repo
aws ssm get-parameter --with-decryption --name /github/deploy-key --output text --query Parameter.Value > ~/.ssh/id_ed25519
chmod 400 ~/.ssh/id_ed25519
echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" > ~/.ssh/known_hosts
mkdir ~/arbitrage-app
git clone git@github.com:ClassicWannabe/crypto-arbitrage.git ~/arbitrage-app/
aws ssm get-parameter --with-decryption --name /crypto-arbitrage/env --output text --query Parameter.Value > ~/arbitrage-app/.env

# Start the app
cd ~/arbitrage-app
npm install -g corepack
corepack enable
corepack use yarn@3.x
corepack yarn start:prod
