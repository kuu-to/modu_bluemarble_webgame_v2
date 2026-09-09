import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const ACCESS_CODE = '964';

export interface RoomPlayer {
  socketId: string;
  name: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
  playerIndex: 0 | 1;
  connected: boolean;
}

export interface RoomData {
  id: string;
  createdAt: number;
  status: 'waiting' | 'in_game' | 'game_over';
  players: RoomPlayer[];
  config: {
    speed: 'normal' | 'fast' | 'turbo';
    timeLimitMinutes: number;
    initialMoney: number;
  };
  gameState?: any;
  messages: Array<{
    id: string;
    senderName: string;
    senderColor: string;
    text: string;
    timestamp: number;
  }>;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const rooms = new Map<string, RoomData>();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', activeRooms: rooms.size });
  });

  // Verify secret access code (964)
  app.post('/api/verify-code', (req, res) => {
    const { code } = req.body;
    if (String(code).trim() === ACCESS_CODE) {
      res.json({ success: true, message: '인증에 성공하였습니다.' });
    } else {
      res.status(401).json({ success: false, message: '인증 코드가 올바르지 않습니다. (코드는 964입니다)' });
    }
  });

  // Query Room Info
  app.get('/api/rooms/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
    }
    res.json({
      id: room.id,
      status: room.status,
      playerCount: room.players.length,
      isFull: room.players.length >= 2,
    });
  });

  // Helper to generate clean short room codes
  function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return rooms.has(code) ? generateRoomCode() : code;
  }

  // Socket.io connection logic
  io.use((socket, next) => {
    const code = socket.handshake.auth?.code || socket.handshake.query?.code;
    if (code && String(code).trim() !== ACCESS_CODE) {
      return next(new Error('INVALID_ACCESS_CODE'));
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null;

    // Verify code via socket
    socket.on('verify_code', (data: { code: string }, callback) => {
      const isValid = String(data?.code).trim() === ACCESS_CODE;
      if (typeof callback === 'function') {
        callback({ success: isValid });
      }
    });

    // Create Room
    socket.on('create_room', (payload: {
      accessCode: string;
      customRoomId?: string;
      playerName: string;
      playerColor: string;
      config?: {
        speed: 'normal' | 'fast' | 'turbo';
        timeLimitMinutes: number;
        initialMoney: number;
      };
    }, callback) => {
      if (String(payload?.accessCode).trim() !== ACCESS_CODE) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '인증 코드가 일치하지 않습니다.' });
        }
        return;
      }

      const roomId = (payload.customRoomId?.trim() || generateRoomCode()).toUpperCase();

      if (rooms.has(roomId)) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '이미 존재하는 방 번호입니다. 다른 번호를 입력해주세요.' });
        }
        return;
      }

      const hostPlayer: RoomPlayer = {
        socketId: socket.id,
        name: payload.playerName?.trim() || '방장 플레이어',
        color: payload.playerColor || 'red',
        isHost: true,
        isReady: true,
        playerIndex: 0,
        connected: true,
      };

      const newRoom: RoomData = {
        id: roomId,
        createdAt: Date.now(),
        status: 'waiting',
        players: [hostPlayer],
        config: {
          speed: payload.config?.speed || 'normal',
          timeLimitMinutes: payload.config?.timeLimitMinutes ?? 60,
          initialMoney: payload.config?.initialMoney ?? 300,
        },
        messages: [
          {
            id: 'msg_sys_init',
            senderName: '시스템',
            senderColor: 'emerald',
            text: `방이 생성되었습니다! (방 코드: ${roomId}) 친구에게 코드를 공유하세요.`,
            timestamp: Date.now(),
          },
        ],
      };

      rooms.set(roomId, newRoom);
      currentRoomId = roomId;
      socket.join(roomId);

      if (typeof callback === 'function') {
        callback({ success: true, roomId, room: newRoom, myPlayerIndex: 0 });
      }

      io.to(roomId).emit('room_updated', newRoom);
    });

    // Join Room
    socket.on('join_room', (payload: {
      accessCode: string;
      roomId: string;
      playerName: string;
      playerColor: string;
    }, callback) => {
      if (String(payload?.accessCode).trim() !== ACCESS_CODE) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '인증 코드가 일치하지 않습니다.' });
        }
        return;
      }

      const targetRoomId = (payload.roomId || '').trim().toUpperCase();
      const room = rooms.get(targetRoomId);

      if (!room) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '존재하지 않는 방입니다. 방 코드를 확인해주세요.' });
        }
        return;
      }

      if (room.status === 'in_game') {
        // Check if this is a reconnecting player
        const existingIdx = room.players.findIndex(p => p.name === payload.playerName?.trim());
        if (existingIdx !== -1) {
          room.players[existingIdx].socketId = socket.id;
          room.players[existingIdx].connected = true;
          currentRoomId = targetRoomId;
          socket.join(targetRoomId);

          if (typeof callback === 'function') {
            callback({
              success: true,
              roomId: targetRoomId,
              room,
              myPlayerIndex: existingIdx,
              isReconnecting: true,
            });
          }
          io.to(targetRoomId).emit('room_updated', room);
          io.to(targetRoomId).emit('player_reconnected', { playerIndex: existingIdx });
          return;
        }

        if (typeof callback === 'function') {
          callback({ success: false, error: '해당 방은 이미 게임이 진행 중입니다.' });
        }
        return;
      }

      if (room.players.length >= 2) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '해당 방은 2인 정원이 가득 찼습니다.' });
        }
        return;
      }

      // If color already taken, select different default
      let chosenColor = payload.playerColor || 'blue';
      if (room.players.some(p => p.color === chosenColor)) {
        chosenColor = chosenColor === 'red' ? 'blue' : 'emerald';
      }

      const guestPlayer: RoomPlayer = {
        socketId: socket.id,
        name: payload.playerName?.trim() || '친구 플레이어',
        color: chosenColor,
        isHost: false,
        isReady: false,
        playerIndex: 1,
        connected: true,
      };

      room.players.push(guestPlayer);
      currentRoomId = targetRoomId;
      socket.join(targetRoomId);

      room.messages.push({
        id: `msg_join_${Date.now()}`,
        senderName: '시스템',
        senderColor: 'amber',
        text: `🎮 ${guestPlayer.name}님이 방에 입장했습니다!`,
        timestamp: Date.now(),
      });

      if (typeof callback === 'function') {
        callback({ success: true, roomId: targetRoomId, room, myPlayerIndex: 1 });
      }

      io.to(targetRoomId).emit('room_updated', room);
    });

    // Toggle Ready State (Guest)
    socket.on('toggle_ready', (payload: { roomId: string }, callback) => {
      const room = rooms.get(payload.roomId?.toUpperCase());
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (player && !player.isHost) {
        player.isReady = !player.isReady;
        io.to(room.id).emit('room_updated', room);
        if (typeof callback === 'function') callback({ success: true, isReady: player.isReady });
      }
    });

    // Update Profile inside Room (Name, Color)
    socket.on('update_profile', (payload: { roomId: string; name: string; color: string }) => {
      const room = rooms.get(payload.roomId?.toUpperCase());
      if (!room || room.status === 'in_game') return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        if (payload.name) player.name = payload.name.trim();
        if (payload.color) player.color = payload.color;
        io.to(room.id).emit('room_updated', room);
      }
    });

    // Start Game (Host only)
    socket.on('start_game', (payload: { roomId: string; initialGameState: any }, callback) => {
      const room = rooms.get(payload.roomId?.toUpperCase());
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: '방이 없습니다.' });
        return;
      }
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player?.isHost) {
        if (typeof callback === 'function') callback({ success: false, error: '방장만 게임을 시작할 수 있습니다.' });
        return;
      }
      if (room.players.length < 2) {
        if (typeof callback === 'function') callback({ success: false, error: '친구가 입장한 후 시작할 수 있습니다.' });
        return;
      }

      room.status = 'in_game';
      room.gameState = payload.initialGameState;

      room.messages.push({
        id: `msg_start_${Date.now()}`,
        senderName: '시스템',
        senderColor: 'emerald',
        text: '🎲 게임이 시작되었습니다! 행운을 빕니다.',
        timestamp: Date.now(),
      });

      io.to(room.id).emit('game_started', {
        room,
        initialGameState: payload.initialGameState,
      });

      if (typeof callback === 'function') callback({ success: true });
    });

    // Relay Dice Roll Event
    socket.on('dice_rolled', (payload: {
      roomId: string;
      dice: [number, number];
      isDouble: boolean;
      doubleCount: number;
      playerIndex: number;
    }) => {
      if (!payload.roomId) return;
      const roomId = payload.roomId.toUpperCase();
      socket.to(roomId).emit('dice_rolled', payload);
    });

    // Relay Game Action (Buy, Pay Toll, Takeover, Space Travel, Golden Key, Debt, Island, etc.)
    socket.on('game_action', (payload: {
      roomId: string;
      actionType: string;
      data: any;
    }) => {
      if (!payload.roomId) return;
      const roomId = payload.roomId.toUpperCase();
      socket.to(roomId).emit('game_action', payload);
    });

    // Synchronize Full Game State (Authoritative Snapshot for 100% parity)
    socket.on('sync_game_state', (payload: {
      roomId: string;
      gameState: any;
    }) => {
      if (!payload.roomId) return;
      const roomId = payload.roomId.toUpperCase();
      const room = rooms.get(roomId);
      if (room) {
        room.gameState = payload.gameState;
      }
      socket.to(roomId).emit('game_state_synced', payload.gameState);
    });

    // In-room Chat Message
    socket.on('send_chat', (payload: {
      roomId: string;
      text: string;
      senderName: string;
      senderColor: string;
    }) => {
      if (!payload.roomId || !payload.text?.trim()) return;
      const roomId = payload.roomId.toUpperCase();
      const room = rooms.get(roomId);
      const msg = {
        id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderName: payload.senderName || '플레이어',
        senderColor: payload.senderColor || 'emerald',
        text: payload.text.trim(),
        timestamp: Date.now(),
      };
      if (room) {
        room.messages.push(msg);
        if (room.messages.length > 100) room.messages.shift();
      }
      io.to(roomId).emit('chat_message', msg);
    });

    // Quick Emoji Reaction
    socket.on('send_reaction', (payload: {
      roomId: string;
      emoji: string;
      senderName: string;
    }) => {
      if (!payload.roomId || !payload.emoji) return;
      const roomId = payload.roomId.toUpperCase();
      io.to(roomId).emit('reaction_received', {
        id: `rx_${Date.now()}`,
        emoji: payload.emoji,
        senderName: payload.senderName,
      });
    });

    // Restart / Rematch in room
    socket.on('restart_game', (payload: { roomId: string; newGameState: any }) => {
      if (!payload.roomId) return;
      const roomId = payload.roomId.toUpperCase();
      const room = rooms.get(roomId);
      if (room) {
        room.status = 'in_game';
        room.gameState = payload.newGameState;
        io.to(roomId).emit('game_restarted', { newGameState: payload.newGameState });
      }
    });

    // Leave Room
    socket.on('leave_room', (payload: { roomId: string }) => {
      if (!payload.roomId) return;
      handlePlayerExit(socket, payload.roomId.toUpperCase());
    });

    socket.on('disconnect', () => {
      if (currentRoomId) {
        handlePlayerExit(socket, currentRoomId);
      }
    });

    function handlePlayerExit(clientSocket: Socket, roomId: string) {
      const room = rooms.get(roomId);
      if (!room) return;

      const leavingPlayer = room.players.find(p => p.socketId === clientSocket.id);
      if (!leavingPlayer) return;

      if (room.status === 'in_game') {
        leavingPlayer.connected = false;
        io.to(roomId).emit('player_disconnected', {
          playerIndex: leavingPlayer.playerIndex,
          playerName: leavingPlayer.name,
        });
      } else {
        // In waiting room
        room.players = room.players.filter(p => p.socketId !== clientSocket.id);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          // If host left, promote remaining player to host
          if (leavingPlayer.isHost && room.players[0]) {
            room.players[0].isHost = true;
            room.players[0].playerIndex = 0;
            room.players[0].isReady = true;
          }
          io.to(roomId).emit('room_updated', room);
        }
      }
      clientSocket.leave(roomId);
    }
  });

  // Vite middleware in development vs static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
