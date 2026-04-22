import { io, Socket } from 'socket.io-client';

const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const createRoom = (playerName: string, track: 'science' | 'math') => {
  const s = getSocket();
  s.emit('create-room', { playerName, track });
};

export const joinRoom = (roomId: string, playerName: string) => {
  const s = getSocket();
  s.emit('join-room', { roomId, playerName });
};

export const toggleReady = () => {
  const s = getSocket();
  s.emit('toggle-ready');
};

export const startGame = () => {
  const s = getSocket();
  s.emit('start-game');
};

export const playCard = (card: any, question: any) => {
  const s = getSocket();
  s.emit('play-card', { card, question });
};

export const submitAnswer = (isCorrect: boolean, pointsGained: number, selectedIndex: number) => {
  const s = getSocket();
  s.emit('submit-answer', { isCorrect, pointsGained, selectedIndex });
};

export const emitNextTurn = () => {
  const s = getSocket();
  s.emit('next-turn');
};

export const updateScores = (players: any[]) => {
  const s = getSocket();
  s.emit('update-scores', { players });
};

export const gameOver = (players: any[], history: any[]) => {
  const s = getSocket();
  s.emit('game-over', { players, history });
};

export const syncState = (state: any) => {
  const s = getSocket();
  s.emit('sync-state', state);
};

export const sendMessage = (message: string) => {
  const s = getSocket();
  s.emit('send-message', { message });
};
