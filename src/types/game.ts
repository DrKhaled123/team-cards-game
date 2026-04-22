export type Subject = 'اللغة العربية' | 'الأحياء' | 'الكيمياء' | 'الفيزياء' | 'الرياضيات';
export type Difficulty = 'سهل' | 'متوسط' | 'متوسط-صعب' | 'صعب-جدا';
export type SpecialPower =
  | 'REVENGE'
  | 'TRIPLE'
  | 'STEAL_ALL'
  | 'DOUBLE_STRIKE'
  | 'NUKE'
  | 'DEDUCT_100'
  | 'PASS_QUESTION'
  | 'STEAL_PASS'
  | 'NONE';

export interface Question {
  id: number;
  subject: Subject;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Card {
  id: string;
  name: string;
  difficulty: Difficulty;
  special: SpecialPower;
  points: number;
  subject: Subject;
  isArmed?: boolean;
}

export interface HistoryItem {
  p: string;
  q: string;
  correct: boolean;
  pts: number;
}

export interface Player {
  id: number;
  name: string;
  team: 'A' | 'B';
  score: number;
  isTeammateOf: number;
  nextTurnEffect?: 'TRIPLE' | 'FREEZE';
  isAI?: boolean;
  isHost?: boolean;
  socketId?: string;
  isConnected?: boolean;
}

export type AIDifficulty = 'سهل' | 'متوسط' | 'صعب';

export type GameScreen = 'intro' | 'setup' | 'playing' | 'result' | 'multiplayer-lobby' | 'multiplayer-game';

// Multiplayer types
export interface RoomPlayer {
  id: number;
  name: string;
  socketId: string;
  isHost: boolean;
  isReady: boolean;
  team: 'A' | 'B';
}

export interface GameRoom {
  roomId: string;
  players: RoomPlayer[];
  gameState: 'waiting' | 'playing' | 'finished';
  track: 'science' | 'math';
  currentPlayerIndex: number;
  hostSocketId: string;
  createdAt: number;
}

export interface ServerGameState {
  roomId: string;
  players: Player[];
  currentPlayerIndex: number;
  hands: Record<number, Card[]>;
  deck: Card[];
  history: HistoryItem[];
  effects: string[];
  track: 'science' | 'math';
  playedQuestionIds: number[];
  gameStatus: 'playing' | 'finished';
}
