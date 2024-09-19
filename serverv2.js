const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const USERS_FILE = 'users.json';
const SESSIONS_FILE = 'sessions.json';
let messages = [];

// Cargar o crear archivos de usuarios y sesiones
let users = {};
let sessions = {};

if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}
if (fs.existsSync(SESSIONS_FILE)) {
    sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users));
}

function saveSessions() {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
}

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (users[username]) {
        return res.status(400).json({ error: 'Usuario ya existe' });
    }
    users[username] = { password: hashPassword(password) };
    saveUsers();
    res.json({ success: true });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!users[username] || users[username].password !== hashPassword(password)) {
        return res.status(400).json({ error: 'Credenciales inválidas' });
    }
    const sessionId = crypto.randomBytes(16).toString('hex');
    sessions[sessionId] = { username, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 }; // 1 semana
    saveSessions();
    res.json({ sessionId });
});

app.post('/checkSession', (req, res) => {
    const { sessionId } = req.body;
    if (sessions[sessionId] && sessions[sessionId].expires > Date.now()) {
        res.json({ valid: true, username: sessions[sessionId].username });
    } else {
        res.json({ valid: false });
    }
});

io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado');
    
    socket.emit('initial messages', messages);

    socket.on('chat message', (msg) => {
        messages.push(msg);
        io.emit('chat message', msg);
    });

    socket.on('disconnect', () => {
        console.log('Un usuario se ha desconectado');
    });
});

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const PORT = 80;
http.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
