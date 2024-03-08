#!/bin/bash

echo "Update and install Node.js"
sudo yum update -y
sudo yum install -y nodejs20 git

echo "Create symlinks"
sudo ln -s /usr/bin/node-20 /usr/bin/node
sudo ln -s /usr/bin/npm-20 /usr/bin/npm

echo "Install and run Cloudwatch agent"
sudo yum install -y amazon-cloudwatch-agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c ssm:/crypto-arbitrage/cloudwatch-config

echo "Install Chrome (node-html-to-image dependency)"
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum install -y ./google-chrome-stable_current_x86_64.rpm
sudo rm --force google-chrome-stable_current_x86_64.rpm
sudo ln -s /usr/bin/google-chrome-stable /usr/bin/chromium

echo "Get the repo"
aws ssm get-parameter --with-decryption --name /github/deploy-key --output text --query Parameter.Value > ~/.ssh/id_ed25519
chmod 400 ~/.ssh/id_ed25519
echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" > ~/.ssh/known_hosts
mkdir ~/arbitrage-app
git clone git@github.com:ClassicWannabe/crypto-arbitrage.git ~/arbitrage-app/
aws ssm get-parameter --with-decryption --name /crypto-arbitrage/env --output text --query Parameter.Value > ~/arbitrage-app/.env

echo "Get the code update script on reboot"
aws ssm get-parameter --name /crypto-arbitrage/code-update-script --output text --query Parameter.Value > /var/lib/cloud/scripts/per-boot/code-update.sh
chmod +x /var/lib/cloud/scripts/per-boot/code-update.sh

echo "Start the app"
cd ~/arbitrage-app
npm install
npm install -g forever
npm run start:prod
