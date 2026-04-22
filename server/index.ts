import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Types
interface RoomPlayer {
  id: number;
  name: string;
  socketId: string;
  isHost: boolean;
  isReady: boolean;
  team: 'A' | 'B';
}

interface GameRoom {
  roomId: string;
  players: RoomPlayer[];
  gameState: 'waiting' | 'playing' | 'finished';
  track: 'science' | 'math' | null;
  currentPlayerIndex: number;
  hostSocketId: string;
  createdAt: number;
  hands: Record<number, any[]>;
  deck: any[];
  history: any[];
  effects: string[];
  playedQuestionIds: number[];
}

const rooms: Map<string, GameRoom> = new Map();
const playerRooms: Map<string, string> = new Map(); // socketId -> roomId

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createDeck(track: 'science' | 'math'): any[] {
  const subjects = track === 'science'
    ? ['اللغة العربية', 'الأحياء', 'الكيمياء', 'الفيزياء']
    : ['اللغة العربية', 'الرياضيات', 'الكيمياء', 'الفيزياء'];

  const deck: any[] = [];
  const hardPowers = ['REVENGE', 'TRIPLE', 'STEAL_ALL', 'DOUBLE_STRIKE', 'NUKE'];
  hardPowers.forEach((p, i) => {
    deck.push({
      id: `H-${i}`,
      name: i === 0 ? 'الخصم الانتقامي' : i === 1 ? 'المضاعف الذهبي' : i === 2 ? 'السارق الكبير' : i === 3 ? 'الضربة المزدوجة' : 'القنبلة النووية',
      difficulty: 'صعب-جدا',
      special: p,
      points: 300,
      subject: subjects[i % subjects.length],
      isArmed: i >= 3
    });
  });

  const mhPowers = ['DEDUCT_100', 'PASS_QUESTION', 'STEAL_PASS', 'NONE', 'NONE', 'NONE', 'NONE'];
  mhPowers.forEach((p, i) => {
    deck.push({
      id: `MH-${i}`,
      name: i < 3 ? 'كارت مميز' : 'تحدي عبقري',
      difficulty: 'متوسط-صعب',
      special: p,
      points: 200,
      subject: subjects[i % subjects.length]
    });
  });

  for (let i = 0; i < 18; i++) {
    deck.push({
      id: `M-${i}`,
      name: 'سؤال متوسط',
      difficulty: 'متوسط',
      special: 'NONE',
      points: 100,
      subject: subjects[i % subjects.length]
    });
  }

  for (let i = 0; i < 30; i++) {
    deck.push({
      id: `E-${i}`,
      name: 'سؤال سهل',
      difficulty: 'سهل',
      special: 'NONE',
      points: 50,
      subject: subjects[i % subjects.length]
    });
  }

  return deck.sort(() => 0.5 - Math.random());
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create Room
  socket.on('create-room', ({ playerName, track }: { playerName: string; track: 'science' | 'math' }) => {
    const roomId = generateRoomId();
    const room: GameRoom = {
      roomId,
      players: [{
        id: 0,
        name: playerName || 'المضيف',
        socketId: socket.id,
        isHost: true,
        isReady: false,
        team: 'A'
      }],
      gameState: 'waiting',
      track,
      currentPlayerIndex: 0,
      hostSocketId: socket.id,
      createdAt: Date.now(),
      hands: {},
      deck: [],
      history: [],
      effects: [],
      playedQuestionIds: []
    };

    rooms.set(roomId, room);
    playerRooms.set(socket.id, roomId);
    socket.join(roomId);

    socket.emit('room-created', { roomId, playerId: 0, players: room.players });
    io.to(roomId).emit('room-updated', { players: room.players, gameState: room.gameState });
  });

  // Join Room
  socket.on('join-room', ({ roomId, playerName }: { roomId: string; playerName: string }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room) {
      socket.emit('error', { message: 'الغرفة غير موجودة' });
      return;
    }
    if (room.players.length >= 4) {
      socket.emit('error', { message: 'الغرفة ممتلئة (٤ لاعبين كحد أقصى)' });
      return;
    }
    if (room.gameState !== 'waiting') {
      socket.emit('error', { message: 'اللعبة قيد التقدم بالفعل' });
      return;
    }

    const playerId = room.players.length;
    const team: 'A' | 'B' = playerId < 2 ? 'A' : 'B';

    room.players.push({
      id: playerId,
      name: playerName || `لاعب ${playerId + 1}`,
      socketId: socket.id,
      isHost: false,
      isReady: false,
      team
    });

    playerRooms.set(socket.id, roomId);
    socket.join(roomId);

    socket.emit('room-joined', { roomId, playerId, players: room.players });
    io.to(roomId).emit('room-updated', { players: room.players, gameState: room.gameState });
  });

  // Toggle Ready
  socket.on('toggle-ready', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      player.isReady = !player.isReady;
      io.to(roomId).emit('room-updated', { players: room.players, gameState: room.gameState });
    }
  });

  // Start Game (Host only)
  socket.on('start-game', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.players.length < 2) {
      socket.emit('error', { message: 'يحتاج على الأقل لاعبان لبدء اللعبة' });
      return;
    }

    const allReady = room.players.every(p => p.isReady || p.isHost);
    if (!allReady) {
      socket.emit('error', { message: 'جميع اللاعبين غير جاهزين بعد' });
      return;
    }

    // Initialize game
    const deck = createDeck(room.track || 'science');
    const hands: Record<number, any[]> = {};
    for (let i = 0; i < room.players.length; i++) {
      hands[i] = deck.splice(0, 5);
    }

    room.deck = deck;
    room.hands = hands;
    room.gameState = 'playing';
    room.currentPlayerIndex = 0;
    room.history = [];
    room.effects = [];
    room.playedQuestionIds = [];

    io.to(roomId).emit('game-started', {
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        score: 0,
        isTeammateOf: p.team === 'A' ? room.players.findIndex(x => x.team === 'A' && x.id !== p.id) : room.players.findIndex(x => x.team === 'B' && x.id !== p.id)
      })),
      hands,
      deckCount: deck.length,
      currentPlayerIndex: 0,
      track: room.track
    });
  });

  // Play Card
  socket.on('play-card', ({ card, question }: { card: any; question: any }) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'playing') return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    room.playedQuestionIds.push(question.id);

    io.to(roomId).emit('card-played', {
      playerId: player.id,
      card,
      question,
      currentPlayerIndex: room.currentPlayerIndex
    });
  });

  // Answer Question
  socket.on('submit-answer', ({ isCorrect, pointsGained, selectedIndex }: { isCorrect: boolean; pointsGained: number; selectedIndex: number }) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'playing') return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    io.to(roomId).emit('answer-submitted', {
      playerId: player.id,
      isCorrect,
      pointsGained,
      selectedIndex
    });
  });

  // Next Turn
  socket.on('next-turn', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'playing') return;

    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;

    io.to(roomId).emit('turn-changed', {
      currentPlayerIndex: room.currentPlayerIndex
    });
  });

  // Update Scores
  socket.on('update-scores', ({ players }: { players: any[] }) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    io.to(roomId).emit('scores-updated', { players });
  });

  // Game Over
  socket.on('game-over', ({ players, history }: { players: any[]; history: any[] }) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    room.gameState = 'finished';
    io.to(roomId).emit('game-finished', { players, history });
  });

  // Update Game State (sync full state)
  socket.on('sync-state', (state: any) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    socket.to(roomId).emit('state-synced', state);
  });

  // Chat/Message
  socket.on('send-message', ({ message }: { message: string }) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      io.to(roomId).emit('chat-message', {
        playerName: player.name,
        playerId: player.id,
        message
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex !== -1) {
          const disconnectedPlayerName = room.players[playerIndex].name;
          const disconnectedPlayerId = room.players[playerIndex].id;
          room.players[playerIndex].isReady = false;
          if (room.gameState === 'waiting') {
            // Remove player if still in lobby
            room.players.splice(playerIndex, 1);
            // Reassign IDs
            room.players.forEach((p, i) => { p.id = i; });
          }
          io.to(roomId).emit('room-updated', { players: room.players, gameState: room.gameState });
          io.to(roomId).emit('player-disconnected', { playerId: disconnectedPlayerId, playerName: disconnectedPlayerName });
        }
        if (room.players.length === 0) {
          rooms.delete(roomId);
        }
      }
      playerRooms.delete(socket.id);
    }
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

// Get room info endpoint
app.get('/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json({
    roomId: room.roomId,
    playerCount: room.players.length,
    gameState: room.gameState,
    players: room.players.map(p => ({ id: p.id, name: p.name, isReady: p.isReady }))
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
