# Ubuntu Web Panel

A modern web-based control panel for Ubuntu servers that allows you to manage and deploy Python applications easily.

## Features

- File Manager with upload/download capabilities
- Python application deployment
- Real-time log viewer
- Modern and responsive UI using Tailwind CSS
- WebSocket-based live updates

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- Python 3.x

## Installation

1. Clone or copy this repository to your Ubuntu server
2. Run the setup script:
   ```bash
   ./setup.bat
   ```
3. Start the panel:
   ```bash
   npm start
   ```
4. Access the panel in your browser at:
   ```
   http://your-server-ip:3000
   ```

## Deployment

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Make the deployment script executable:
```bash
chmod +x deploy.sh
```

3. Run the deployment script:
```bash
./deploy.sh
```

This will:
- Install all required dependencies
- Set up MongoDB
- Configure Nginx as a reverse proxy
- Set up PM2 for process management
- Configure the firewall
- Start the application

4. Access your web panel at `http://your-domain.com`

## Usage

### File Manager
- Upload files using the file upload form
- View and manage files in your server
- Download files directly from the panel

### Deployment
- Select a Python file from the dropdown
- Choose a port number for your application
- Click "Deploy" to run your Python application

### Logs
- View real-time logs from your running applications
- Error messages are highlighted in red
- Logs are automatically scrolled to show the latest entries

## Security Note

This panel is designed for local network use. If you plan to expose it to the internet, make sure to:
1. Add proper authentication
2. Use HTTPS
3. Implement rate limiting
4. Add input validation

## License

MIT License
