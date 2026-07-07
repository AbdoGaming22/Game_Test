const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// السماح بالاتصال من أي مكان لتجنب مشاكل الـ CORS
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let rooms = {}; // لتخزين بيانات الغرف واللاعبين

io.on('connection', (socket) => {
    console.log(`لاعب متصل: ${socket.id}`);

    // 1. إنشاء غرفة جديدة
    socket.on('createRoom', () => {
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString(); // كود من 4 أرقام
        rooms[roomCode] = {
            players: [{ id: socket.id, role: 'Agent', x: 100, y: 100 }]
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, role: 'Agent' });
        console.log(`تم إنشاء الغرفة: ${roomCode}`);
    });

    // 2. الانضمام لغرفة موجودة
    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode]) {
            if (rooms[roomCode].players.length < 2) {
                const role = 'Hacker_or_Partner';
                rooms[roomCode].players.push({ id: socket.id, role: role, x: 200, y: 200 });
                socket.join(roomCode);
                
                // إبلاغ الطرفين ببدء اللعب الجماعي الحقيقي
                io.to(roomCode).emit('gameStarted', { roomCode, players: rooms[roomCode].players });
                console.log(`لاعب انضم للغرفة: ${roomCode}`);
            } else {
                socket.emit('errorMsg', 'الغرفة ممتلئة باللاعبين!');
            }
        } else {
            socket.emit('errorMsg', 'كود الغرفة غير صحيح أو انتهت صلاحيته!');
        }
    });

    // 3. مزامنة الحركة وإطلاق النار والعقبات بين الجهازين فورياً
    socket.on('playerMove', (data) => {
        socket.to(data.roomCode).emit('peerMove', data);
    });

    socket.on('playerShoot', (data) => {
        socket.to(data.roomCode).emit('peerShoot', data);
    });

    socket.on('triggerObstacle', (data) => {
        socket.to(data.roomCode).emit('peerObstacle', data);
    });

    socket.on('disconnect', () => {
        console.log(`لاعب انفصل: ${socket.id}`);
        // تنظيف الغرف عند خروج اللاعبين
        for (let code in rooms) {
            rooms[code].players = rooms[code].players.filter(p => p.id !== socket.id);
            if (rooms[code].players.length === 0) {
                delete rooms[code];
            } else {
                io.to(code).emit('peerDisconnected');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`سيرفر الملتيبلاير يعمل على المنفذ: ${PORT}`));
