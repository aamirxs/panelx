#!/bin/bash

# Update system
sudo apt update
sudo apt upgrade -y

# Install Node.js and npm if not installed
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install MongoDB if not installed
if ! command -v mongod &> /dev/null; then
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
    sudo apt update
    sudo apt install -y mongodb-org
    sudo systemctl start mongod
    sudo systemctl enable mongod
fi

# Install PM2 globally
sudo npm install -g pm2

# Install dependencies
npm install

# Build for production
npm run build

# Start the application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 process list and configure startup
pm2 save
pm2 startup

# Install and configure Nginx
sudo apt install -y nginx
sudo tee /etc/nginx/sites-available/ubuntu-web-panel << EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the Nginx site
sudo ln -s /etc/nginx/sites-available/ubuntu-web-panel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Configure firewall
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22

echo "Deployment complete! Access your web panel at http://your-domain.com"
