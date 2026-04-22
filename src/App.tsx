/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Users,
  Timer,
  Brain,
  Shield,
  Zap,
  Sword,
  Star,
  RotateCcw,
  BookOpen,
  Atom,
  Dna,
  Calculator,
  ChevronRight,
  AlertCircle,
  History,
  FlaskConical,
  CheckCircle,
  XCircle,
  Info,
  Copy,
  Link2,
  Globe,
  Wifi,
  WifiOff,
  MessageCircle,
  Send
} from 'lucide-react';
import type { Subject, Difficulty, SpecialPower, Question, Card, HistoryItem, Player, AIDifficulty } from './types/game';
import { QUESTIONS_BANK, getRandomQuestions } from './data/questions';
import {
  getSocket,
  disconnectSocket,
  createRoom,
  joinRoom,
  toggleReady,
  startGame as startMultiplayerGame,
  playCard,
  submitAnswer as submitMultiplayerAnswer,
  emitNextTurn,
  updateScores,
  gameOver,
  syncState
} from './multiplayer/socket';

// --- Types ---

interface RoomPlayer {
  id: number;
  name: string;
  socketId: string;
  isHost: boolean;
  isReady: boolean;
  team: 'A' | 'B';
}

type GameMode = 'single' | 'multiplayer' | null;
type MpScreen = 'lobby' | 'playing' | 'result';


const createDeck = (track: 'science' | 'math'): Card[] => {
  const deck: Card[] = [];
  const subjects: Subject[] = track === 'science' 
    ? ['اللغة العربية', 'الأحياء', 'الكيمياء', 'الفيزياء'] 
    : ['اللغة العربية', 'الرياضيات', 'الكيمياء', 'الفيزياء'];

  // Hard Cards (5)
  const hardPowers: SpecialPower[] = ['REVENGE', 'TRIPLE', 'STEAL_ALL', 'DOUBLE_STRIKE', 'NUKE'];
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

  // Medium-Hard (7)
  const mhPowers: SpecialPower[] = ['DEDUCT_100', 'PASS_QUESTION', 'STEAL_PASS', 'NONE', 'NONE', 'NONE', 'NONE'];
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

  // Medium (18)
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

  // Easy (30)
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
};

// --- Components ---

interface CardViewProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  isSelected?: boolean;
}

const CardView: React.FC<CardViewProps> = ({ card, onClick, disabled, isSelected }) => {
  const isHard = card.difficulty === 'صعب-جدا';

  const getBG = () => {
    if (isHard) return 'bg-[#FFD700] border-[#8B0000] text-[#8B0000]';
    return 'bg-[#f4e4bc] border-[#C8A84B] text-[#0D2B1A]';
  };

  const getIcon = () => {
    const size = 12;
    switch (card.subject) {
      case 'اللغة العربية': return <BookOpen size={size} />;
      case 'الأحياء': return <Dna size={size} />;
      case 'الفيزياء': return <Atom size={size} />;
      case 'الرياضيات': return <Calculator size={size} />;
      case 'الكيمياء': return <FlaskConical size={size} />;
    }
  };

  return (
    <motion.div
      whileHover={!disabled ? { scale: 1.05, y: -12 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={!disabled ? onClick : undefined}
      className={`relative w-20 h-28 rounded-lg shadow-lg cursor-pointer flex flex-col p-2 text-right transition-all border-2 select-none ${getBG()} ${disabled ? 'opacity-50 grayscale' : ''} ${isSelected ? 'ring-2 ring-white -translate-y-4 z-50' : ''}`}
    >
      <div className={`text-[9px] font-black uppercase border-b pb-0.5 mb-1 ${isHard ? 'border-[#8B0000]/20' : 'border-[#0D2B1A]/10'}`}>
        {card.difficulty}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-1">
         {getIcon()}
         <span className="text-xs font-black leading-tight">{card.name}</span>
      </div>

      <div className="w-full flex justify-between items-center mt-auto pt-0.5 font-black">
        <span className="text-base">{card.points}</span>
        {card.isArmed && (
          <div className="absolute -top-1.5 -right-1.5 bg-[#8B0000] text-white w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-md">
             <Sword size={10} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<'intro' | 'setup' | 'playing' | 'result' | 'multiplayer-lobby' | 'multiplayer-playing' | 'multiplayer-result'>('intro');
  const [track, setTrack] = useState<'science' | 'math'>('science');
  const [players, setPlayers] = useState<Player[]>([
    { id: 0, name: 'لاعب ١', team: 'A', score: 0, isTeammateOf: 2 },
    { id: 1, name: 'لاعب ٢', team: 'B', score: 0, isTeammateOf: 3 },
    { id: 2, name: 'لاعب ٣', team: 'A', score: 0, isTeammateOf: 0 },
    { id: 3, name: 'لاعب ٤', team: 'B', score: 0, isTeammateOf: 1 },
  ]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [deck, setDeck] = useState<Card[]>([]);
  const [hands, setHands] = useState<Record<number, Card[]>>({});
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timer, setTimer] = useState(60);
  const [isAnswering, setIsAnswering] = useState(false);
  const [effects, setEffects] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [passedToTeammate, setPassedToTeammate] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('متوسط');
  const [showExplanation, setShowExplanation] = useState(false);
  const [lastAnswerInfo, setLastAnswerInfo] = useState<{ isCorrect: boolean, selectedIndex: number } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [playedQuestionIds, setPlayedQuestionIds] = useState<number[]>([]);

  // --- Multiplayer State ---
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [mpScreen, setMpScreen] = useState<MpScreen>('lobby');
  const [roomId, setRoomId] = useState('');
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  const [mpPlayers, setMpPlayers] = useState<RoomPlayer[]>([]);
  const [mpChat, setMpChat] = useState<{ playerName: string; playerId: number; message: string }[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [mpTrack, setMpTrack] = useState<'science' | 'math'>('science');
  const [joinRoomId, setJoinRoomId] = useState('');

  // Refs to avoid stale closures in callbacks
  const handsRef = useRef(hands);
  handsRef.current = hands;
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const playersRef = useRef(players);
  playersRef.current = players;
  const currentQuestionRef = useRef(currentQuestion);
  currentQuestionRef.current = currentQuestion;
  const isAiPlayingRef = useRef(false);

  // --- Start Game ---
  const startGame = (chosenTrack: 'science' | 'math') => {
    const fullDeck = createDeck(chosenTrack);
    const newHands: Record<number, Card[]> = {};
    for (let i = 0; i < 4; i++) {
      newHands[i] = fullDeck.splice(0, 5); // Start with 5 cards each
    }
    
    // Setup AI Players
    const newPlayers: Player[] = [
      { id: 0, name: 'أنت', team: 'A', score: 0, isTeammateOf: 2, isAI: false },
      { id: 1, name: 'الخصم ١', team: 'B', score: 0, isTeammateOf: 3, isAI: true },
      { id: 2, name: 'الزميل (AI)', team: 'A', score: 0, isTeammateOf: 0, isAI: true },
      { id: 3, name: 'الخصم ٢', team: 'B', score: 0, isTeammateOf: 1, isAI: true },
    ];

    setPlayers(newPlayers);
    setDeck(fullDeck);
    setHands(newHands);
    setTrack(chosenTrack);
    setGameState('playing');
    setCurrentPlayerIndex(0); // Human starts
    setSelectedCard(null);
    setCurrentQuestion(null);
    setIsAnswering(false);
    setShowExplanation(false);
    setLastAnswerInfo(null);
    setPlayedQuestionIds([]);
  };

  // --- Turn Logic ---
  const nextTurn = useCallback(() => {
    const nextIdx = (currentPlayerIndex + 1) % 4;
    const latestPlayers = playersRef.current;

    // Resets
    setSelectedCard(null);
    setCurrentQuestion(null);
    setIsAnswering(false);
    setShowExplanation(false);
    setLastAnswerInfo(null);
    setTimer(60);
    setPassedToTeammate(false);
    setIsAiThinking(false);

    // Check for skip/freeze
    if (latestPlayers[nextIdx].nextTurnEffect === 'FREEZE') {
      const updatedPlayers = [...latestPlayers];
      updatedPlayers[nextIdx].nextTurnEffect = undefined;
      setPlayers(updatedPlayers);
      setEffects(prev => [...prev, `تم تجميد دور ${latestPlayers[nextIdx].name}!`]);

      // Move even further
      setTimeout(() => {
        setCurrentPlayerIndex((nextIdx + 1) % 4);
      }, 1000);
      return;
    }

    setCurrentPlayerIndex(nextIdx);
  }, [currentPlayerIndex]);

  // --- Card Selection ---
  const handlePlayCard = (card: Card) => {
    if (showExplanation || isAnswering) return;
    if (gameMode === 'multiplayer') {
      handleMpPlayCard(card);
      return;
    }
    setSelectedCard(card);
    const q = getRandomQuestions(card.subject, 1, playedQuestionIds)[0] || QUESTIONS_BANK[0];
    setCurrentQuestion(q);
    setPlayedQuestionIds(prev => [...prev, q.id]);
    setIsAnswering(true);
    setTimer(60);
    setShowExplanation(false);
    setLastAnswerInfo(null);
  };

  // --- Answer Choice ---
  const handleAnswer = useCallback((index: number) => {
    if (!currentQuestion || !selectedCard || showExplanation) return;
    if (gameMode === 'multiplayer') {
      handleMpAnswer(index);
      return;
    }
    
    const isCorrect = index === currentQuestion.correctIndex;
    const actorIdx = passedToTeammate ? players[currentPlayerIndex].isTeammateOf : currentPlayerIndex;
    const actor = players[actorIdx];

    const updatedPlayers = [...players];
    let pointsGained = 0;

    if (isCorrect) {
      pointsGained = selectedCard.points;
      
      if (actor.nextTurnEffect === 'TRIPLE') {
        pointsGained *= 3;
        updatedPlayers[actorIdx].nextTurnEffect = undefined;
      }

      // Special Powers
      if (selectedCard.special === 'REVENGE') {
        const prevIdx = (currentPlayerIndex + 3) % 4;
        const stolen = Math.min(updatedPlayers[prevIdx].score, 300);
        updatedPlayers[prevIdx].score -= stolen;
        pointsGained += 300 + stolen;
      }
      if (selectedCard.special === 'TRIPLE') {
        updatedPlayers[actor.isTeammateOf].nextTurnEffect = 'TRIPLE';
      }
      if (selectedCard.special === 'STEAL_ALL') {
        const targetIdx = (currentPlayerIndex + 1) % 4;
        const stolen = updatedPlayers[targetIdx].score;
        updatedPlayers[targetIdx].score = 0;
        pointsGained += stolen;
      }
      if (selectedCard.special === 'DOUBLE_STRIKE') {
        const targetIdx = (currentPlayerIndex + 1) % 4;
        updatedPlayers[targetIdx].score = Math.max(0, updatedPlayers[targetIdx].score - 100);
        pointsGained += 200;
        if (selectedCard.isArmed) updatedPlayers[targetIdx].nextTurnEffect = 'FREEZE';
      }
      if (selectedCard.special === 'NUKE') {
        pointsGained += 500;
        if (selectedCard.isArmed) updatedPlayers[actor.isTeammateOf].score += 150;
      }
      if (selectedCard.special === 'DEDUCT_100') {
        const targetIdx = (currentPlayerIndex + 1) % 4;
        updatedPlayers[targetIdx].score = Math.max(0, updatedPlayers[targetIdx].score - 100);
      }
      if (selectedCard.special === 'STEAL_PASS') {
        // Steal 50 points from next opponent
        const targetIdx = (currentPlayerIndex + 1) % 4;
        const stolen = Math.min(updatedPlayers[targetIdx].score, 50);
        updatedPlayers[targetIdx].score -= stolen;
        pointsGained += stolen;
      }

      updatedPlayers[actorIdx].score += pointsGained;
    } else {
      if (selectedCard.special === 'NUKE') {
        updatedPlayers[actorIdx].score = Math.max(0, updatedPlayers[actorIdx].score - 200);
      }
    }

    setHistory(prev => [...prev, { p: actor.name, q: currentQuestion.text, correct: isCorrect, pts: isCorrect ? pointsGained : 0 }]);
    
    // Show Explanation
    setLastAnswerInfo({ isCorrect, selectedIndex: index });
    setShowExplanation(true);
    setPlayers(updatedPlayers);

    // Card usage
    const newHands = { ...hands };
    newHands[currentPlayerIndex] = newHands[currentPlayerIndex].filter(c => c.id !== selectedCard.id);
    if (deck.length > 0) {
      newHands[currentPlayerIndex].push(deck[0]);
      setDeck(prev => prev.slice(1));
    }
    setHands(newHands);
  }, [currentQuestion, selectedCard, showExplanation, passedToTeammate, players, currentPlayerIndex, hands, deck, gameMode]);

  const handleCloseQuestion = useCallback(() => {
    if (gameMode === 'multiplayer') {
      handleMpCloseQuestion();
      return;
    }
    const allHandsEmpty = Object.values(handsRef.current).every((h: Card[]) => h.length === 0);
    if (allHandsEmpty && deckRef.current.length === 0) {
      setGameState('result');
    } else {
      nextTurn();
    }
  }, [nextTurn, gameMode]);

  const handlePassToTeammate = useCallback(() => {
    if (!selectedCard || !currentQuestion) return;
    setPassedToTeammate(true);
    setEffects(prev => [...prev, `${players[currentPlayerIndex].name} مرر السؤال لزميله!`]);
    // The question will now be answered by the teammate
  }, [selectedCard, currentQuestion, players, currentPlayerIndex]);
  useEffect(() => {
    let interval: any;
    if (isAnswering && timer > 0 && !showExplanation) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    } else if (timer === 0 && isAnswering && !showExplanation) {
      handleAnswer(-1); // Timeout as wrong answer
    }
    return () => clearInterval(interval);
  }, [isAnswering, timer, showExplanation, handleAnswer]);

  // --- AI Logic ---
  useEffect(() => {
    if (gameState !== 'playing' || gameMode === 'multiplayer' || !players[currentPlayerIndex]?.isAI || isAnswering || isAiPlayingRef.current) return;

    // AI Thinking & Play Card
    isAiPlayingRef.current = true;
    setIsAiThinking(true);
    const thinkTime = 2000 + Math.random() * 2000;

    const timeout = setTimeout(() => {
      isAiPlayingRef.current = false;
      setIsAiThinking(false);
      const hand = handsRef.current[currentPlayerIndex] || [];
      if (hand.length > 0) {
        const randomCard = hand[Math.floor(Math.random() * hand.length)];
        handlePlayCard(randomCard);
      }
    }, thinkTime);

    return () => {
      clearTimeout(timeout);
      isAiPlayingRef.current = false;
    };
  }, [currentPlayerIndex, players, gameState, isAnswering, gameMode]);

  useEffect(() => {
    if (isAnswering && gameMode !== 'multiplayer' && players[currentPlayerIndex]?.isAI && !showExplanation) {
      // AI Answering Delay: 11 seconds
      const answerDelay = 11000;
      const timeout = setTimeout(() => {
        let prob = 0.5;
        if (aiDifficulty === 'سهل') prob = 0.3;
        if (aiDifficulty === 'متوسط') prob = 0.65;
        if (aiDifficulty === 'صعب') prob = 0.9;

        const isCorrect = Math.random() < prob;
        const answerToken = isCorrect ? currentQuestion?.correctIndex : (currentQuestion?.correctIndex === 0 ? 1 : 0);
        handleAnswer(answerToken ?? -1);
      }, answerDelay);

      return () => clearTimeout(timeout);
    }
  }, [isAnswering, currentPlayerIndex, players, showExplanation, aiDifficulty, currentQuestion, gameMode]);

  // Auto-close AI explanation
  useEffect(() => {
    if (showExplanation && gameMode !== 'multiplayer' && players[currentPlayerIndex]?.isAI) {
      const closeTimeout = setTimeout(() => {
        handleCloseQuestion();
      }, 6000);
      return () => clearTimeout(closeTimeout);
    }
  }, [showExplanation, currentPlayerIndex, players, handleCloseQuestion, gameMode]);

  // --- Multiplayer Socket Listeners ---
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onRoomCreated = ({ roomId, playerId, players }: { roomId: string; playerId: number; players: RoomPlayer[] }) => {
      setRoomId(roomId);
      setMyPlayerId(playerId);
      setMpPlayers(players);
      setGameState('multiplayer-lobby');
      setMpScreen('lobby');
      setJoinError('');
    };
    const onRoomJoined = ({ roomId, playerId, players }: { roomId: string; playerId: number; players: RoomPlayer[] }) => {
      setRoomId(roomId);
      setMyPlayerId(playerId);
      setMpPlayers(players);
      setGameState('multiplayer-lobby');
      setMpScreen('lobby');
      setJoinError('');
    };
    const onRoomUpdated = ({ players, gameState: gs }: { players: RoomPlayer[]; gameState: string }) => {
      setMpPlayers(players);
    };
    const onGameStarted = ({ players, hands, deckCount, currentPlayerIndex: cpi, track: t }: any) => {
      const mappedPlayers: Player[] = players.map((p: any) => {
        const teammateIdx = players.findIndex((x: any) => x.team === p.team && x.id !== p.id);
        return {
          id: p.id,
          name: p.name,
          team: p.team,
          score: 0,
          isTeammateOf: teammateIdx >= 0 ? teammateIdx : p.id,
          isAI: false,
        };
      });
      setPlayers(mappedPlayers);
      setHands(hands);
      setDeck(Array(deckCount).fill(null)); // We don't need actual deck cards on client
      setCurrentPlayerIndex(cpi);
      setTrack(t);
      setGameState('multiplayer-playing');
      setMpScreen('playing');
      setHistory([]);
      setEffects([]);
      setPlayedQuestionIds([]);
      setSelectedCard(null);
      setCurrentQuestion(null);
      setIsAnswering(false);
      setShowExplanation(false);
      setLastAnswerInfo(null);
      setTimer(60);
    };
    const onCardPlayed = ({ playerId, card, question }: any) => {
      setSelectedCard(card);
      setCurrentQuestion(question);
      setIsAnswering(true);
      setTimer(60);
      setShowExplanation(false);
      setLastAnswerInfo(null);
      setPlayedQuestionIds(prev => [...prev, question.id]);
    };
    const onAnswerSubmitted = ({ playerId, isCorrect, pointsGained, selectedIndex }: any) => {
      setLastAnswerInfo({ isCorrect, selectedIndex });
      setShowExplanation(true);
      setPlayers(prev => {
        const updated = [...prev];
        if (updated[playerId]) {
          updated[playerId] = { ...updated[playerId], score: updated[playerId].score + (isCorrect ? pointsGained : 0) };
        }
        return updated;
      });
      const currentPlayers = playersRef.current;
      const currentQ = currentQuestionRef.current;
      setHistory(prev => [...prev, {
        p: currentPlayers[playerId]?.name || `لاعب ${playerId + 1}`,
        q: currentQ?.text || '',
        correct: isCorrect,
        pts: isCorrect ? pointsGained : 0
      }]);
    };
    const onTurnChanged = ({ currentPlayerIndex: cpi }: any) => {
      setCurrentPlayerIndex(cpi);
      setSelectedCard(null);
      setCurrentQuestion(null);
      setIsAnswering(false);
      setShowExplanation(false);
      setLastAnswerInfo(null);
      setTimer(60);
      setPassedToTeammate(false);
    };
    const onScoresUpdated = ({ players: updatedPlayers }: any) => {
      setPlayers(updatedPlayers);
    };
    const onGameFinished = ({ players: finalPlayers, history: finalHistory }: any) => {
      setPlayers(finalPlayers);
      setHistory(finalHistory);
      setGameState('multiplayer-result');
      setMpScreen('result');
    };
    const onChatMessage = ({ playerName, playerId, message }: any) => {
      setMpChat(prev => [...prev, { playerName, playerId, message }]);
    };
    const onError = ({ message }: { message: string }) => {
      setJoinError(message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-created', onRoomCreated);
    socket.on('room-joined', onRoomJoined);
    socket.on('room-updated', onRoomUpdated);
    socket.on('game-started', onGameStarted);
    socket.on('card-played', onCardPlayed);
    socket.on('answer-submitted', onAnswerSubmitted);
    socket.on('turn-changed', onTurnChanged);
    socket.on('scores-updated', onScoresUpdated);
    socket.on('game-finished', onGameFinished);
    socket.on('chat-message', onChatMessage);
    socket.on('error', onError);

    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-created', onRoomCreated);
      socket.off('room-joined', onRoomJoined);
      socket.off('room-updated', onRoomUpdated);
      socket.off('game-started', onGameStarted);
      socket.off('card-played', onCardPlayed);
      socket.off('answer-submitted', onAnswerSubmitted);
      socket.off('turn-changed', onTurnChanged);
      socket.off('scores-updated', onScoresUpdated);
      socket.off('game-finished', onGameFinished);
      socket.off('chat-message', onChatMessage);
      socket.off('error', onError);
    };
  }, []);

  // --- URL Room Detection ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setJoinRoomId(roomFromUrl.toUpperCase());
      setGameMode('multiplayer');
      setGameState('multiplayer-lobby');
      setMpScreen('lobby');
    }
  }, []);

  // --- Rules Modal Component ---
  const RulesModal = ({ onClose }: { onClose: () => void }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-[#0a1a12] w-full max-w-lg max-h-[85vh] rounded-2xl border border-gold/30 p-4 md:p-6 flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 md:mb-4 shrink-0">
          <h3 className="text-lg md:text-xl font-black text-gold flex items-center gap-2">
            <Shield size={20} /> قوانين وشرح اللعبة
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gold/10 rounded-full flex items-center justify-center text-gold hover:bg-gold/20 transition-all"
            aria-label="إغلاق"
          >
            <XCircle size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 text-right custom-scrollbar">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <h4 className="text-sm md:text-base font-black text-gold mb-1">فكرة اللعبة</h4>
            <p className="text-xs md:text-sm text-white/80 leading-relaxed">
              بطولة تعليمية تعاونية بنظام <span className="text-gold font-black">٢ ضد ٢</span>. فريقك يضمك وزميل AI، وتقاتلان فريقين AI خصمين.
              الهدف: الإجابة الصحيحة على الأسئلة وجمع أكبر عدد من النقاط قبل نفاد البطاقات.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <h4 className="text-sm md:text-base font-black text-gold mb-1">نظام الفرق</h4>
            <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
              <div className="bg-gold/10 border border-gold/20 rounded-lg p-2 text-center">
                <div className="font-black text-gold">فريق أ</div>
                <div className="text-white/70">أنت + الزميل (AI)</div>
              </div>
              <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-2 text-center">
                <div className="font-black text-red-400">فريق ب</div>
                <div className="text-white/70">الخصم ١ + الخصم ٢ (AI)</div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <h4 className="text-sm md:text-base font-black text-gold mb-1">أنواع البطاقات</h4>
            <div className="space-y-1 text-xs md:text-sm text-white/80">
              <div className="flex items-center justify-between"><span className="text-green-400 font-black">سهل</span><span>٥٠ نقطة</span></div>
              <div className="flex items-center justify-between"><span className="text-blue-400 font-black">متوسط</span><span>١٠٠ نقطة</span></div>
              <div className="flex items-center justify-between"><span className="text-purple-400 font-black">متوسط-صعب</span><span>٢٠٠ نقطة</span></div>
              <div className="flex items-center justify-between"><span className="text-red-400 font-black">صعب-جداً</span><span>٣٠٠ نقطة</span></div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <h4 className="text-sm md:text-base font-black text-gold mb-1">القوى الخاصة</h4>
            <div className="space-y-1.5 text-xs md:text-sm text-white/80">
              <div><span className="text-red-400 font-black">الخصم الانتقامي:</span> خصم ٣٠٠ من الخصم السابق + ٣٠٠ لك</div>
              <div><span className="text-gold font-black">المضاعف الذهبي:</span> ثلاثة أضعاف نقاط زميلك في دوره القادم</div>
              <div><span className="text-purple-400 font-black">السارق الكبير:</span> سرقة كل نقاط خصم واحد</div>
              <div><span className="text-orange-400 font-black">الضربة المزدوجة:</span> خصم ١٠٠ من خصم + ٢٠٠ لك، وتجميد دوره</div>
              <div><span className="text-red-500 font-black">القنبلة النووية:</span> +٥٠٠ لفريقك، لكن -٢٠٠ إذا أخطأت</div>
              <div><span className="text-blue-400 font-black">خصم ١٠٠:</span> خصم ١٠٠ نقطة من خصم</div>
              <div><span className="text-green-400 font-black">تمرير السؤال:</span> مرر السؤال الصعب لزميلك ليساعدك</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <h4 className="text-sm md:text-base font-black text-gold mb-1">كيفية الفوز</h4>
            <p className="text-xs md:text-sm text-white/80 leading-relaxed">
              عند نفاد جميع البطاقات من جميع اللاعبين، يُعلن الفريق صاحب المجموع الأعلى من النقاط فائزاً.
              استخدم القوى الخاصة بحكمة وتعاون مع زميلك للفوز!
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  // --- Multiplayer Helpers ---
  const handleCreateRoom = () => {
    if (!isConnected) {
      setJoinError('غير متصل بالخادم. تأكد من تشغيل خادم اللعبة (npm run server)');
      return;
    }
    if (!playerName.trim()) {
      setJoinError('الرجاء إدخال اسمك أولاً');
      return;
    }
    setJoinError('');
    createRoom(playerName.trim(), mpTrack);
  };
  const handleJoinRoom = () => {
    if (!isConnected) {
      setJoinError('غير متصل بالخادم. تأكد من تشغيل خادم اللعبة (npm run server)');
      return;
    }
    if (!playerName.trim()) {
      setJoinError('الرجاء إدخال اسمك أولاً');
      return;
    }
    if (!joinRoomId.trim()) {
      setJoinError('الرجاء إدخال رمز الغرفة');
      return;
    }
    setJoinError('');
    joinRoom(joinRoomId.trim().toUpperCase(), playerName.trim());
  };
  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };
  const handleMpPlayCard = (card: Card) => {
    if (showExplanation || isAnswering) return;
    const q = getRandomQuestions(card.subject, 1, playedQuestionIds)[0] || QUESTIONS_BANK[0];
    playCard(card, q);
  };
  const handleMpAnswer = (index: number) => {
    if (!currentQuestion || !selectedCard || showExplanation) return;
    const isCorrect = index === currentQuestion.correctIndex;
    const pointsGained = isCorrect ? selectedCard.points : 0;
    submitMultiplayerAnswer(isCorrect, pointsGained, index);
  };
  const handleMpCloseQuestion = () => {
    const allHandsEmpty = Object.values(handsRef.current).every((h: Card[]) => h.length === 0);
    if (allHandsEmpty) {
      gameOver(playersRef.current, history);
      setGameState('multiplayer-result');
      setMpScreen('result');
    } else {
      emitNextTurn();
    }
  };

  // --- UI Sections ---

  if (gameState === 'multiplayer-lobby') {
    const isInRoom = roomId && mpPlayers.length > 0;
    const isHost = myPlayerId === 0;
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-dark-green" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border-2 border-gold/20 shadow-2xl space-y-6"
        >
          <div className="text-center">
            <h2 className="text-4xl font-black text-gold mb-2">اللعب الجماعي</h2>
            <div className="h-1 w-20 bg-gold mx-auto rounded-full" />
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-xs text-white/60">{isConnected ? 'متصل بالخادم' : 'غير متصل'}</span>
            </div>
          </div>

          {!isInRoom ? (
            <div className="space-y-4">
              <div>
                <label className="block text-gold font-black mb-2 text-sm">اسمك</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="أدخل اسمك"
                  className="w-full p-4 rounded-2xl bg-white/5 border-2 border-gold/20 text-white placeholder-white/30 text-right focus:border-gold focus:outline-none transition-colors"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="block text-gold font-black mb-2 text-sm">المسار</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setMpTrack('science')}
                    className={`flex-1 p-4 rounded-2xl font-black border-2 transition-all ${mpTrack === 'science' ? 'bg-gold text-dark-green border-gold' : 'bg-white/5 text-gold border-gold/20'}`}
                  >
                    <Atom className="mx-auto mb-1" /> علمي علوم
                  </button>
                  <button
                    onClick={() => setMpTrack('math')}
                    className={`flex-1 p-4 rounded-2xl font-black border-2 transition-all ${mpTrack === 'math' ? 'bg-gold text-dark-green border-gold' : 'bg-white/5 text-gold border-gold/20'}`}
                  >
                    <Calculator className="mx-auto mb-1" /> علمي رياضة
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={!isConnected}
                className={`w-full p-4 rounded-2xl font-black text-lg transition-all ${isConnected ? 'bg-gold text-dark-green hover:scale-[1.02]' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
              >
                {isConnected ? 'إنشاء غرفة جديدة' : 'جاري الاتصال بالخادم...'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-[#0a1a12] px-3 text-white/40">أو</span></div>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  placeholder="رمز الغرفة"
                  className="flex-1 p-4 rounded-2xl bg-white/5 border-2 border-gold/20 text-white placeholder-white/30 text-center tracking-widest font-black uppercase focus:border-gold focus:outline-none transition-colors"
                  maxLength={6}
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={!isConnected}
                  className={`px-6 rounded-2xl font-black transition-all ${isConnected ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
                >
                  دخول
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/5 rounded-2xl p-4 border border-gold/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gold font-black">رمز الغرفة</span>
                  <span className="text-2xl font-black text-white tracking-widest">{roomId}</span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="w-full p-3 bg-white/5 border border-gold/20 rounded-xl text-gold font-black text-sm hover:bg-gold/10 transition-all flex items-center justify-center gap-2"
                >
                  {copiedLink ? <CheckCircle size={16} /> : <Link2 size={16} />}
                  {copiedLink ? 'تم النسخ!' : 'نسخ رابط الدعوة'}
                </button>
                <p className="text-[10px] text-white/40 mt-2 text-center truncate">{shareUrl}</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-gold font-black text-sm">اللاعبون ({mpPlayers.length}/4)</h3>
                {mpPlayers.map((p) => (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${p.id === myPlayerId ? 'bg-gold/10 border-gold/30' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${p.isReady ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      <span className="font-black text-white">{p.name}</span>
                      {p.isHost && <span className="text-[10px] bg-gold/20 text-gold px-2 py-0.5 rounded-full">مضيف</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.team === 'A' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>فريق {p.team}</span>
                    </div>
                    {p.id === myPlayerId && (
                      <button
                        onClick={toggleReady}
                        className={`text-xs font-black px-3 py-1 rounded-lg transition-all ${p.isReady ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                      >
                        {p.isReady ? 'جاهز' : 'غير جاهز'}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {isHost && (
                <button
                  onClick={startMultiplayerGame}
                  disabled={mpPlayers.length < 2 || !mpPlayers.every(p => p.isReady || p.isHost)}
                  className="w-full p-4 bg-green-500 text-white rounded-2xl font-black text-lg hover:bg-green-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ابدأ اللعبة
                </button>
              )}

              <div className="bg-black/30 rounded-2xl p-3 border border-white/10 max-h-40 overflow-y-auto">
                {mpChat.map((msg, i) => (
                  <div key={i} className="text-xs mb-1">
                    <span className="text-gold font-black">{msg.playerName}:</span>{' '}
                    <span className="text-white/70">{msg.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {joinError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-black text-center">
              {joinError}
            </div>
          )}

          <button
            onClick={() => { setGameMode(null); setGameState('intro'); setRoomId(''); setMpPlayers([]); setJoinError(''); disconnectSocket(); }}
            className="w-full p-3 bg-white/5 border border-white/10 rounded-2xl text-white/60 font-black hover:bg-white/10 transition-all"
          >
            العودة للقائمة الرئيسية
          </button>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-8 bg-dark-green relative overflow-hidden" dir="rtl">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-10 left-10"><Dna size={120} className="text-gold" /></div>
          <div className="absolute bottom-10 right-10"><Atom size={120} className="text-gold" /></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Brain size={300} className="text-gold" /></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10"
        >
          <div className="inline-block p-1 rounded-2xl bg-gradient-to-b from-gold to-transparent mb-4">
             <div className="bg-dark-green rounded-xl px-12 py-8 border border-gold/30">
                <h1 className="text-7xl md:text-9xl font-black text-gold drop-shadow-[0_0_15px_rgba(200,168,75,0.4)]">
                  ثانوية بطولة
                </h1>
                <p className="text-xl md:text-2xl text-gold/80 font-bold mt-4 tracking-widest">مواجهة العباقرة ٢٠٢٦</p>
             </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl z-10">
          <button
            onClick={() => setGameState('setup')}
            className="group relative flex items-center justify-center p-6 bg-gold rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:scale-105 transition-all text-dark-green font-black text-2xl overflow-hidden border-4 border-white/20"
            aria-label="ابدأ المواجهة"
          >
            <Users className="ml-2" /> ابدأ المواجهة
          </button>
          <button
            onClick={() => { setGameMode('multiplayer'); setGameState('multiplayer-lobby'); setMpScreen('lobby'); }}
            className="group relative flex items-center justify-center p-6 bg-blue-500 rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:scale-105 transition-all text-white font-black text-2xl overflow-hidden border-4 border-white/20"
            aria-label="اللعب الجماعي"
          >
            <Globe className="ml-2" /> اللعب الجماعي
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="p-6 bg-white/5 backdrop-blur-md border-2 border-gold/20 rounded-[32px] flex items-center justify-center text-gold font-black text-xl hover:bg-gold/10 transition-colors cursor-pointer"
            aria-label="قوانين اللعبة"
          >
            <Info className="ml-2" /> قوانين اللعبة
          </button>
        </div>

        {/* Tutorial Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-2xl z-10"
        >
          <button
            onClick={() => setShowRules(true)}
            className="w-full bg-white/5 backdrop-blur-md border-2 border-gold/30 rounded-2xl p-4 md:p-5 hover:bg-gold/10 hover:border-gold/50 transition-all text-right group"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base md:text-lg font-black text-gold flex items-center gap-2">
                <BookOpen size={20} /> كيف تلعب؟ اضغط لمعرفة القواعد
              </h3>
              <ChevronRight size={20} className="text-gold group-hover:translate-x-[-4px] transition-transform" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] md:text-xs text-white/70">
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <div className="text-gold font-black text-sm mb-1">١</div>
                <div>اختر مسارك العلمي</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <div className="text-gold font-black text-sm mb-1">٢</div>
                <div>ارمِ البطاقة في دورك</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <div className="text-gold font-black text-sm mb-1">٣</div>
                <div>أجب قبل انتهاء الوقت</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <div className="text-gold font-black text-sm mb-1">٤</div>
                <div>استخدم القوى الخاصة</div>
              </div>
            </div>
          </button>
        </motion.div>

        <div className="text-gold/40 text-sm font-black tracking-widest uppercase">
           نظام المحاكاة المتطور للمرحلة الثانوية
        </div>

        <AnimatePresence>
          {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-dark-green">
        <motion.div 
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="w-full max-w-lg bg-white/5 backdrop-blur-xl p-10 rounded-[40px] border-2 border-gold/20 shadow-2xl space-y-10"
        >
          <div className="text-center">
             <h2 className="text-5xl font-black text-gold mb-2">اختر مسارك</h2>
             <div className="h-1 w-20 bg-gold mx-auto rounded-full mb-6" />
             
             <div className="flex justify-center gap-3 mb-8">
                {(['سهل', 'متوسط', 'صعب'] as AIDifficulty[]).map((level) => (
                   <button
                     key={level}
                     onClick={() => setAiDifficulty(level)}
                     className={`px-4 py-2 rounded-xl font-black text-sm transition-all border-2 ${aiDifficulty === level ? 'bg-gold text-dark-green border-gold' : 'bg-white/5 text-gold border-gold/20'}`}
                   >
                      مستوى الـ AI: {level}
                   </button>
                ))}
             </div>
          </div>
          
          <div className="space-y-6">
            <button 
              onClick={() => startGame('science')}
              className="w-full p-8 bg-white/5 border-2 border-white/10 rounded-3xl flex items-center justify-between hover:border-gold hover:bg-gold/10 transition-all group text-right"
              aria-label="اختر شعبة علمي علوم"
            >
              <div className="flex-1">
                <span className="block text-3xl font-black text-white group-hover:text-gold transition-colors">شعبة علمي علوم</span>
                <span className="text-sm opacity-60 font-bold">أحياء • فيزياء • كيمياء • لغة عربية</span>
              </div>
              <Dna size={48} className="text-gold opacity-40 group-hover:opacity-100 transition-all group-hover:rotate-12" />
            </button>
            <button 
              onClick={() => startGame('math')}
              className="w-full p-8 bg-white/5 border-2 border-white/10 rounded-3xl flex items-center justify-between hover:border-gold hover:bg-gold/10 transition-all group text-right"
              aria-label="اختر شعبة علمي رياضة"
            >
              <div className="flex-1">
                <span className="block text-3xl font-black text-white group-hover:text-gold transition-colors">شعبة علمي رياضة</span>
                <span className="text-sm opacity-60 font-bold">رياضيات • فيزياء • كيمياء • لغة عربية</span>
              </div>
              <Calculator size={48} className="text-gold opacity-40 group-hover:opacity-100 transition-all group-hover:rotate-12" />
            </button>
          </div>
          <p className="text-center text-xs text-gold/40 font-bold leading-relaxed">
             * بطولة تعاونية: ٤ لاعبين في نظام (٢ ضد ٢) <br/>
             الإجابة الصحيحة تمنح فريقك التقدم نحو النصر
          </p>

          <button
            onClick={() => setShowRules(true)}
            className="w-full py-3 bg-white/5 border border-gold/20 rounded-xl flex items-center justify-center text-gold font-black text-sm hover:bg-gold/10 transition-colors"
            aria-label="قوانين اللعبة"
          >
            <Info className="ml-2" size={16} /> كيف تلعب؟ اضغط هنا
          </button>
        </motion.div>

        <AnimatePresence>
          {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  if (gameState === 'playing' || gameState === 'multiplayer-playing') {
    const currentPlayer = players[currentPlayerIndex];
    const localId = gameMode === 'multiplayer' ? (myPlayerId ?? 0) : 0;
    const teammateId = players[localId]?.isTeammateOf ?? (localId === 0 ? 2 : localId === 1 ? 3 : localId === 2 ? 0 : 1);
    const opponentIds = [0, 1, 2, 3].filter(id => id !== localId && id !== teammateId);
    const topId = gameMode === 'multiplayer' ? teammateId : 2;
    const rightId = gameMode === 'multiplayer' ? opponentIds[0] ?? 1 : 1;
    const leftId = gameMode === 'multiplayer' ? opponentIds[1] ?? 3 : 3;
    const bottomId = gameMode === 'multiplayer' ? localId : 0;

    return (
      <div className="h-screen flex flex-col overflow-hidden select-none bg-dark-green text-[#E0E0E0] relative" dir="rtl">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-5 pointer-events-none z-0">
          <div className="absolute top-1/4 left-1/4 rotate-12"><Atom size={140} className="text-gold" /></div>
          <div className="absolute bottom-1/4 right-1/4 -rotate-12"><Dna size={140} className="text-gold" /></div>
        </div>

        {/* Top: Header/Scores */}
        <div className="h-[52px] bg-black/40 border-b-2 border-gold flex items-center justify-between px-3 md:px-5 z-30 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2">
             <div className="text-base md:text-lg font-black text-gold tracking-tighter flex items-center gap-2 drop-shadow-lg">
                <Shield size={16} className="text-gold" />
                بطولة العباقرة ٢٠٢٦
             </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
             <div className="flex items-center gap-2 md:gap-3 border-l border-white/10 pl-2 md:pl-3 h-8">
                <div className="flex flex-col items-end">
                  <div className="text-[9px] font-black text-gold opacity-60">فريق أ</div>
                  <div className="text-base md:text-lg font-black text-white leading-none">{players[0].score + players[2].score}</div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-[9px] font-black text-red-400 opacity-60">فريق ب</div>
                  <div className="text-base md:text-lg font-black text-white leading-none">{players[1].score + players[3].score}</div>
                </div>
             </div>

             <div className="flex items-center gap-2">
                <div className="text-left leading-none">
                   <div className="text-[9px] opacity-60 uppercase font-black text-gold">الدور</div>
                   <div className="text-sm md:text-base font-black text-white">{players[currentPlayerIndex].name}</div>
                </div>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-dark-green font-black text-xs shadow-[0_0_10px_rgba(200,168,75,0.4)] ${currentPlayer.team === 'A' ? 'bg-gold' : 'bg-red-400'}`}>
                   {currentPlayerIndex + 1}
                </div>
             </div>

             <button
               onClick={() => setShowRules(true)}
               className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gold hover:bg-gold/20 transition-all"
               aria-label="قوانين اللعبة"
             >
               <Info size={14} />
             </button>
          </div>
        </div>

        {/* Main Viewport */}
        <div className="flex-1 flex p-2 md:p-3 gap-2 md:gap-3 relative overflow-hidden">

           {/* Sidebar: Activity Log */}
           <div className="w-52 md:w-60 flex flex-col gap-2 z-10">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-3 flex flex-col h-full shadow-2xl">
                 <h4 className="text-xs font-black text-gold mb-2 flex items-center gap-1">
                    <History size={14} /> ساحة المعركة
                 </h4>
                 <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                    {history.length === 0 && (
                      <div className="text-white/20 text-xs italic text-center mt-6">
                        البطولة في بدايتها...
                      </div>
                    )}
                    {history.slice().reverse().map((h, i) => (
                       <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i}
                        className="bg-white/5 p-2 rounded-xl border border-white/5 text-right relative overflow-hidden"
                       >
                          <div className={`absolute top-0 right-0 w-1 h-full ${h.correct ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div className="font-black text-[9px] text-gold/60">{h.p}</div>
                          <div className={`text-xs font-bold ${h.correct ? 'text-green-400' : 'text-red-400'}`}>
                             {h.correct ? `أصاب! ${h.pts}+` : 'أخطأ'}
                          </div>
                       </motion.div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Table & Game Action Area */}
           <div className="flex-1 relative flex flex-col items-center justify-center">
              {/* Question Overlay */}
              <AnimatePresence>
                {isAnswering && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-dark-green/50 backdrop-blur-md"
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="bg-[#0a1a12]/95 w-full max-w-3xl max-h-[92vh] rounded-xl border border-gold/30 p-2.5 md:p-4 flex flex-col shadow-2xl relative overflow-hidden overflow-y-auto custom-scrollbar"
                    >
                       {/* Turn Indicator Banner */}
                       <div className={`w-full py-0.5 px-2 rounded-md mb-1.5 flex items-center justify-between shrink-0 ${currentPlayer.team === 'A' ? 'bg-gold/20 border border-gold/40' : 'bg-red-400/20 border border-red-400/40'}`}>
                          <div className="flex items-center gap-1">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${currentPlayer.team === 'A' ? 'bg-gold text-dark-green' : 'bg-red-400 text-white'}`}>
                              {currentPlayerIndex + 1}
                            </div>
                            <span className="text-[11px] md:text-sm font-black text-white">
                              دور: {currentPlayer.name} {currentPlayer.isAI ? '(AI)' : '(أنت)'}
                            </span>
                          </div>
                          <span className={`text-[9px] font-black ${currentPlayer.team === 'A' ? 'text-gold' : 'text-red-400'}`}>
                            فريق {currentPlayer.team}
                          </span>
                       </div>

                       <div className="flex justify-between items-start mb-1.5 w-full z-10 shrink-0">
                         <div className="bg-gold text-dark-green px-2 py-0.5 rounded font-black text-[10px] shadow-xl">
                            {selectedCard?.subject}
                         </div>
                         <div className="flex flex-col items-end gap-0.5 font-black">
                           <div className="bg-deep-red/40 px-2 py-0.5 rounded-full border border-deep-red text-white flex items-center gap-1 text-[10px]">
                                <Timer size={12} /> {timer}
                           </div>
                         </div>
                       </div>

                       <div className="flex-1 flex flex-col justify-start gap-2 z-10 min-h-0 overflow-y-auto custom-scrollbar">
                          <h2 className="text-sm md:text-base lg:text-lg font-black text-right text-white leading-snug shrink-0">
                             {currentQuestion?.text}
                          </h2>

                          {selectedCard?.special === 'PASS_QUESTION' && !passedToTeammate && !showExplanation && (gameMode === 'multiplayer' ? currentPlayerIndex === myPlayerId : !currentPlayer.isAI) && (
                            <button
                              onClick={handlePassToTeammate}
                              className="px-3 py-1.5 bg-gold text-dark-green rounded-lg font-black text-xs md:text-sm hover:scale-105 transition-all shadow-xl w-fit shrink-0"
                            >
                              مرر السؤال للزميل
                            </button>
                          )}

                          {passedToTeammate && (
                            <div className="text-center text-gold font-black text-xs md:text-sm animate-pulse shrink-0">
                              تم تمرير السؤال لـ {players[players[currentPlayerIndex].isTeammateOf].name}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-1.5 md:gap-2 shrink-0">
                             {currentQuestion?.options.map((opt, i) => (
                                <button
                                   key={i}
                                   onClick={() => !showExplanation && (gameMode === 'multiplayer' ? currentPlayerIndex === myPlayerId : !currentPlayer.isAI) && handleAnswer(i)}
                                   disabled={showExplanation || (gameMode === 'multiplayer' ? currentPlayerIndex !== myPlayerId : currentPlayer.isAI)}
                                   aria-label={`الخيار ${i + 1}: ${opt}`}
                                   className={`p-1.5 md:p-2.5 rounded-lg text-right font-black text-[11px] md:text-sm border-2 transition-all ${showExplanation ? (i === currentQuestion.correctIndex ? 'bg-green-600 border-green-400 text-white' : (lastAnswerInfo?.selectedIndex === i ? 'bg-red-600 border-red-400 text-white' : 'opacity-30')) : 'bg-white/5 border-white/10 hover:border-gold text-white'}`}
                                >
                                   <span className="inline-block ml-1 text-gold/70">{String.fromCharCode(65 + i)}.</span>
                                   {opt}
                                </button>
                             ))}
                          </div>
                       </div>

                       {showExplanation && (
                          <div className="mt-3 bg-black/40 border-2 border-gold p-3 rounded-xl relative shrink-0">
                             <button
                               onClick={handleCloseQuestion}
                               className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-gold text-dark-green rounded-full flex items-center justify-center font-black text-sm hover:scale-110 transition-all"
                               aria-label="إغلاق"
                             >
                               X
                             </button>
                             <div className={`font-black mb-1.5 flex items-center gap-1.5 text-sm ${lastAnswerInfo?.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                {lastAnswerInfo?.isCorrect ? (
                                  <><CheckCircle size={16}/> إجابة صحيحة! +{selectedCard?.points || 0}</>
                                ) : (
                                  <><XCircle size={16}/> إجابة خاطئة</>
                                )}
                             </div>
                             <div className="text-gold font-black mb-1 flex items-center gap-1.5 text-xs"><BookOpen size={14}/> التفسير:</div>
                             <p className="text-white text-xs md:text-sm text-right">{currentQuestion?.explanation}</p>
                             {gameMode !== 'multiplayer' && currentPlayer.isAI && (
                               <div className="mt-1.5 text-[10px] text-gold/60 text-center">
                                 سيتم الانتقال للدور التالي تلقائياً...
                               </div>
                             )}
                             {gameMode === 'multiplayer' && currentPlayerIndex === myPlayerId && (
                               <div className="mt-1.5 text-[10px] text-gold/60 text-center">
                                 اضغط X للانتقال للدور التالي
                               </div>
                             )}
                          </div>
                       )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Table (Tarneeb Style) */}
              <div className="w-full max-w-xl aspect-square rounded-full border-[10px] border-black/20 flex items-center justify-center relative bg-[#0d2b1a] shadow-inner">
                 <div className={`absolute top-0 -translate-y-1/2 flex flex-col items-center gap-0.5 ${currentPlayerIndex === topId ? 'opacity-100' : 'opacity-60'}`}>
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 ${currentPlayerIndex === topId ? 'bg-gold/30 border-gold' : 'bg-black/40 border-white/10'}`}>
                      <Users size={22} />
                      {hands[topId] && hands[topId].length > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 bg-gold text-dark-green w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">
                          {hands[topId].length}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-black">{players[topId].name}</span>
                 </div>
                 <div className={`absolute bottom-0 translate-y-1/2 flex flex-col items-center gap-0.5 ${currentPlayerIndex === bottomId ? 'opacity-100' : 'opacity-60'}`}>
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center border-2 shadow-lg ${currentPlayerIndex === bottomId ? 'bg-gold/40 border-gold' : 'bg-gold/20 border-gold'}`}>
                      <Users size={24} className="text-gold" />
                      {hands[bottomId] && hands[bottomId].length > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 bg-white text-dark-green w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">
                          {hands[bottomId].length}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-black text-gold">{players[bottomId].name}</span>
                 </div>
                 <div className={`absolute left-0 -translate-x-1/2 flex items-center gap-2 ${currentPlayerIndex === leftId ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="flex flex-col items-center gap-0.5">
                       <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 ${currentPlayerIndex === leftId ? 'bg-gold/30 border-gold' : 'bg-black/40 border-white/10'}`}>
                         <Brain size={22} />
                         {hands[leftId] && hands[leftId].length > 0 && (
                           <div className="absolute -top-1.5 -right-1.5 bg-gold text-dark-green w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">
                             {hands[leftId].length}
                           </div>
                         )}
                       </div>
                       <span className="text-[10px] font-black">{players[leftId].name}</span>
                    </div>
                 </div>
                 <div className={`absolute right-0 translate-x-1/2 flex items-center gap-2 ${currentPlayerIndex === rightId ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="flex flex-col items-center gap-0.5">
                       <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 ${currentPlayerIndex === rightId ? 'bg-gold/30 border-gold' : 'bg-black/40 border-white/10'}`}>
                         <Brain size={22} />
                         {hands[rightId] && hands[rightId].length > 0 && (
                           <div className="absolute -top-1.5 -right-1.5 bg-gold text-dark-green w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">
                             {hands[rightId].length}
                           </div>
                         )}
                       </div>
                       <span className="text-[10px] font-black">{players[rightId].name}</span>
                    </div>
                 </div>

                 {selectedCard && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="z-30 shadow-2xl">
                       <CardView card={selectedCard} />
                    </motion.div>
                 )}
              </div>
           </div>
        </div>

        {/* Hand Section */}
        <div className="h-[140px] md:h-[200px] bg-gradient-to-t from-[#050d0a] to-[#0d2b1a] border-t-4 border-gold/20 flex items-end justify-center px-6 pb-6 md:pb-10 relative z-40 shrink-0">
           {isAiThinking && players[currentPlayerIndex].isAI && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-gold/10 px-8 py-2 rounded-full border-2 border-gold text-gold font-black text-sm md:text-base animate-pulse shadow-[0_0_30px_rgba(200,168,75,0.2)] z-50 backdrop-blur-md"
              >
                 {players[currentPlayerIndex].name} يخطط لضربته القادمة...
              </motion.div>
           )}

           <div className="flex items-end justify-center w-full max-w-5xl pt-6">
              <div className="flex -space-x-8 md:-space-x-10 lg:-space-x-12 rtl:space-x-reverse justify-center items-end h-full w-full overflow-x-auto px-4">
                {(hands[bottomId] || []).map((card: Card, idx) => (
                  <motion.div
                    key={card.id}
                    whileHover={{
                      y: -60,
                      scale: 1.1,
                      zIndex: 100,
                      rotate: 0,
                      transition: { duration: 0.2 }
                    }}
                    className="transition-all duration-300 origin-bottom flex-shrink-0"
                    style={{
                      zIndex: idx,
                      transform: `rotate(${(idx - (hands[bottomId].length / 2)) * 3}deg)`
                    }}
                  >
                    <CardView
                      card={card}
                      onClick={() => handlePlayCard(card)}
                      disabled={isAnswering || (gameMode !== 'multiplayer' && players[currentPlayerIndex].isAI) || (gameState !== 'playing' && gameState !== 'multiplayer-playing') || currentPlayerIndex !== bottomId}
                      isSelected={selectedCard?.id === card.id}
                    />
                  </motion.div>
                ))}
              </div>
           </div>

           <div className="absolute left-4 bottom-4">
              <button
                onClick={() => setGameState('intro')}
                className="bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-xl font-black text-xs transition-all border border-white/10 hover:border-red-500/50 uppercase tracking-widest backdrop-blur-sm"
                aria-label="انسحاب"
              >
                 انسحاب
              </button>
           </div>
        </div>

        <AnimatePresence>
          {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  if (gameState === 'result' || gameState === 'multiplayer-result') {
    const teamAScore = players[0].score + players[2].score;
    const teamBScore = players[1].score + players[3].score;
    const winner = teamAScore > teamBScore ? 'فريق أ' : 'فريق ب';
    
    return (
      <div className="min-h-screen p-6 bg-dark-green flex flex-col items-center justify-center space-y-12 overflow-y-auto">
        <motion.div 
           initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
           className="text-center"
        >
          <div className="relative inline-block">
             <Trophy size={160} className="mx-auto text-gold mb-6 drop-shadow-[0_0_50px_rgba(200,168,75,0.4)]" />
             <div className="absolute inset-0 animate-ping opacity-20 bg-gold rounded-full scale-150" />
          </div>
          <h2 className="text-7xl font-black text-white">نصر تاريخي لـ {winner}</h2>
          <p className="text-2xl text-gold mt-4 font-bold">المستوى التعليمي: عباقرة الثانوية ٢٠٢٦</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
           <div className={`p-10 rounded-[40px] border-2 flex flex-col items-center shadow-2xl transition-all ${winner === 'فريق أ' ? 'bg-gold/10 border-gold' : 'bg-white/5 border-white/10 opacity-40'}`}>
              <h3 className="text-3xl font-black text-gold mb-4">فريق أ (العلوم)</h3>
              <span className="text-8xl font-black text-white">{teamAScore}</span>
              <div className="mt-6 flex gap-10 text-sm font-black border-t border-gold/20 pt-4">
                 <div className="text-center">
                    <div className="opacity-50 mb-1">{players[0].name}</div>
                    <div className="text-lg text-gold">{players[0].score}</div>
                 </div>
                 <div className="text-center">
                    <div className="opacity-50 mb-1">{players[2].name}</div>
                    <div className="text-lg text-gold">{players[2].score}</div>
                 </div>
              </div>
           </div>
           
           <div className={`p-10 rounded-[40px] border-2 flex flex-col items-center shadow-2xl transition-all ${winner === 'فريق ب' ? 'bg-deep-red/10 border-deep-red' : 'bg-white/5 border-white/10 opacity-40'}`}>
              <h3 className="text-3xl font-black text-deep-red mb-4">فريق ب (الرياضيات)</h3>
              <span className="text-8xl font-black text-white">{teamBScore}</span>
              <div className="mt-6 flex gap-10 text-sm font-black border-t border-deep-red/20 pt-4">
                 <div className="text-center">
                    <div className="opacity-50 mb-1">{players[1].name}</div>
                    <div className="text-lg text-deep-red">{players[1].score}</div>
                 </div>
                 <div className="text-center">
                    <div className="opacity-50 mb-1">{players[3].name}</div>
                    <div className="text-lg text-deep-red">{players[3].score}</div>
                 </div>
              </div>
           </div>
        </div>

        <div className="w-full max-w-3xl bg-black/40 p-8 rounded-[40px] border border-gold/20 backdrop-blur-md">
           <h4 className="text-2xl font-black mb-6 flex items-center gap-3 text-gold">
              <RotateCcw size={24}/> سجل المعركة التعليمية
           </h4>
           <div className="max-h-80 overflow-y-auto space-y-4 px-2 pr-6 custom-scrollbar">
              {history.map((h, i) => (
                <div key={i} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${h.correct ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                         {h.correct ? '✓' : '✗'}
                      </div>
                      <div className="text-right">
                         <div className="font-black text-white">{h.p}</div>
                         <div className="text-xs opacity-50 truncate max-w-[200px]">{h.q}</div>
                      </div>
                   </div>
                   <div className="text-2xl font-black text-gold">+{h.pts}</div>
                </div>
              ))}
           </div>
        </div>

        <button
           onClick={() => {
             if (gameMode === 'multiplayer') {
               setGameMode(null);
               setGameState('intro');
               setRoomId('');
               setMpPlayers([]);
               disconnectSocket();
             } else {
               window.location.reload();
             }
           }}
           className="px-16 py-6 bg-gold text-dark-green font-black text-2xl rounded-[32px] shadow-2xl hover:scale-110 transition-all border-4 border-white/20 active:scale-95"
           aria-label="تحدّي جديد"
        >
           {gameMode === 'multiplayer' ? 'العودة للقائمة' : 'تحدّي جديد'}
        </button>
      </div>
    );
  }

  return null;
}
