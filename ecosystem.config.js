module.exports = {
  apps: [{
    name: 'ubuntu-web-panel',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      MONGODB_URI: 'mongodb+srv://aamir:tajmahal0@cluster0.4ljy1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
      JWT_SECRET: 'your-jwt-secret',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 587,
      SMTP_USER: 'your-email@example.com',
      SMTP_PASS: 'your-email-password'
    }
  }]
};
