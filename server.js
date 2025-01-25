const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fileUpload = require('express-fileupload');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os-utils');
const si = require('systeminformation');
const pty = require('node-pty');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const pm2 = require('pm2');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');

// Security Middleware
app.use(helmet());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
}));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost/webpanel'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/webpanel');

// User Schema
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: String,
    role: String
});

const User = mongoose.model('User', mongoose.model('User') || mongoose.model('User', userSchema));

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const token = req.session.token;
    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Store running processes
const runningProcesses = new Map();

// Routes
app.get('/', (req, res) => {
    res.render('dashboard');
});

// File Manager API
app.get('/api/files', async (req, res) => {
    const dir = req.query.path || './';
    try {
        const files = await fs.readdir(dir);
        const fileStats = await Promise.all(
            files.map(async (file) => {
                const stats = await fs.stat(path.join(dir, file));
                return {
                    name: file,
                    isDirectory: stats.isDirectory(),
                    size: stats.size,
                    modified: stats.mtime
                };
            })
        );
        res.json(fileStats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// File Upload
app.post('/api/upload', async (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const { file } = req.files;
    const uploadPath = path.join(__dirname, 'uploads', file.name);

    try {
        await file.mv(uploadPath);
        res.json({ message: 'File uploaded successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deploy Python Application
app.post('/api/deploy', async (req, res) => {
    const { file, port } = req.body;
    if (!file) {
        return res.status(400).json({ error: 'No file specified' });
    }

    try {
        const process = spawn('python3', [file], {
            cwd: path.join(__dirname, 'uploads')
        });

        const processId = Date.now().toString();
        runningProcesses.set(processId, process);

        process.stdout.on('data', (data) => {
            io.emit('log', { processId, data: data.toString() });
        });

        process.stderr.on('data', (data) => {
            io.emit('error', { processId, data: data.toString() });
        });

        res.json({ processId, message: 'Application deployed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop Python Application
app.post('/api/stop/:processId', (req, res) => {
    const { processId } = req.params;
    const process = runningProcesses.get(processId);

    if (process) {
        process.kill();
        runningProcesses.delete(processId);
        res.json({ message: 'Application stopped successfully' });
    } else {
        res.status(404).json({ error: 'Process not found' });
    }
});

// Backup System
const backupSystem = {
    createBackup: async (directory) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const output = fs.createWriteStream(`backups/${timestamp}.zip`);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.pipe(output);
        archive.directory(directory, false);
        await archive.finalize();

        return `backups/${timestamp}.zip`;
    },

    scheduleBackup: (directory, schedule) => {
        cron.schedule(schedule, async () => {
            try {
                const backupPath = await backupSystem.createBackup(directory);
                console.log(`Backup created: ${backupPath}`);
            } catch (error) {
                console.error('Backup failed:', error);
            }
        });
    }
};

// Process Management
const processManager = {
    list: () => {
        return new Promise((resolve, reject) => {
            pm2.list((err, list) => {
                if (err) reject(err);
                resolve(list);
            });
        });
    },

    start: (script, name) => {
        return new Promise((resolve, reject) => {
            pm2.start({
                script,
                name,
                exec_mode: 'fork'
            }, (err, apps) => {
                if (err) reject(err);
                resolve(apps);
            });
        });
    },

    stop: (name) => {
        return new Promise((resolve, reject) => {
            pm2.stop(name, (err, proc) => {
                if (err) reject(err);
                resolve(proc);
            });
        });
    }
};

// Email Notifications
const emailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// New Routes
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, 'your-secret-key');
    req.session.token = token;
    res.json({ token });
});

app.post('/api/backup/create', authenticateToken, async (req, res) => {
    try {
        const backupPath = await backupSystem.createBackup(req.body.directory);
        res.json({ path: backupPath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/backup/schedule', authenticateToken, (req, res) => {
    try {
        backupSystem.scheduleBackup(req.body.directory, req.body.schedule);
        res.json({ message: 'Backup scheduled successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/processes', authenticateToken, async (req, res) => {
    try {
        const processes = await processManager.list();
        res.json(processes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/processes/start', authenticateToken, async (req, res) => {
    try {
        const result = await processManager.start(req.body.script, req.body.name);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/processes/stop', authenticateToken, async (req, res) => {
    try {
        const result = await processManager.stop(req.body.name);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// WebSocket connection for real-time logs and terminal
io.on('connection', (socket) => {
    console.log('Client connected');

    // Terminal handling
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const term = pty.spawn(shell, [], {
        name: 'xterm-color',
        cwd: process.env.HOME,
        env: process.env
    });

    term.onData(data => {
        socket.emit('terminal.data', data);
    });

    socket.on('terminal.input', data => {
        term.write(data);
    });

    // System monitoring
    const sendSystemInfo = async () => {
        try {
            const [cpu, mem, disk] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.fsSize()
            ]);

            socket.emit('system.info', {
                cpu: cpu.currentLoad,
                memory: {
                    total: mem.total,
                    used: mem.used,
                    free: mem.free
                },
                disk: disk[0] ? {
                    size: disk[0].size,
                    used: disk[0].used,
                    free: disk[0].free
                } : null
            });
        } catch (error) {
            console.error('Error getting system info:', error);
        }
    };

    // Send system info every 5 seconds
    const systemInfoInterval = setInterval(sendSystemInfo, 5000);

    // Process monitoring
    socket.on('process.monitor', async (processId) => {
        try {
            const process = await si.processes();
            const targetProcess = process.list.find(p => p.pid === processId);
            if (targetProcess) {
                socket.emit('process.stats', targetProcess);
            }
        } catch (error) {
            console.error('Process monitoring error:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        clearInterval(systemInfoInterval);
        term.kill();
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
