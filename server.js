const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

// مسار فوري (Health Check) لإبقاء خوادم Hugging Face مستيقظة ومنع قطع الـ Buffer Stream
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.status(200).send('<h1>Agent Game Server is Active ✓</h1>');
});

const server = http.createServer(app);

// تهيئة خيارات الاتصال لتعطيل الـ HTTP Polling وإجبار الـ WebSockets فوراً من نقطة الصفر
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket'], // إجبار السيرفر على رفض الـ HTTP Long-Polling الذي يسبب الخطأ
    allowUpgrades: false
});

let rooms = {};

io.on('connection', (socket) => {
    console.log(`لاعب متصل: ${socket.id}`);

    socket.on('createRoom', () => {
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[roomCode] = {
            players: [{ id: socket.id, role: 'Agent', x: 100, y: 100 }]
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, role: 'Agent' });
    });

    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode] && rooms[roomCode].players.length < 2) {
            rooms[roomCode].players.push({ id: socket.id, role: 'Partner', x: 200, y: 200 });
            socket.join(roomCode);
            io.to(roomCode).emit('gameStarted', { roomCode, players: rooms[roomCode].players });
        } else {
            socket.emit('errorMsg', 'الغرفة ممتلئة أو غير موجودة!');
        }
    });

    socket.on('playerMove', (data) => { socket.to(data.roomCode).emit('peerMove', data); });
    socket.on('playerShoot', (data) => { socket.to(data.roomCode).emit('peerShoot', data); });
    socket.on('triggerObstacle', (data) => { socket.to(data.roomCode).emit('peerObstacle', data); });

    socket.on('disconnect', () => {
        for (let code in rooms) {
            rooms[code].players = rooms[code].players.filter(p => p.id !== socket.id);
            if (rooms[code].players.length === 0) delete rooms[code];
            else io.to(code).emit('peerDisconnected');
        }
    });
});

// تشغيل السيرفر على منفذ المنصة المعتمد 7860
const PORT = process.env.PORT || 7860;
server.listen(PORT, () => console.log(`الملتيبلاير جاهز على المنفذ: ${PORT}`));
