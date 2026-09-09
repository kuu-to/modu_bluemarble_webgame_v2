import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Player, 
  CellState, 
  GameLogEntry, 
  GameModeConfig,
  GameOverResult,
  GoldenKeyCard, 
  FloatingEffect, 
  SpaceData, 
  GameSpeed, 
  SPEED_CONFIGS, 
  BoardBroadcastMessage, 
  PropertySalePlan
} from './types';
import { AirplaneColorId, AIRPLANE_CONFIGS } from './utils/airplaneConfig';
import { BOARD_SPACES, calculateToll, calculateSpaceValue } from './data/boardData';
import { getRandomGoldenKey } from './data/goldenKeyData';
import { soundManager } from './utils/audio';
import { decideAIBuilding, decideAITakeover, decideAISpaceTravelDestination } from './utils/ai';
import { createPlayersForMode } from './utils/playerPresets';
import { Board } from './components/Board';
import { Sidebar } from './components/Sidebar';
import { PurchaseModal } from './components/PurchaseModal';
import { TollModal } from './components/TollModal';
import { GoldenKeyModal } from './components/GoldenKeyModal';
import { TurnTransitionBanner } from './components/TurnTransitionBanner';
import { GameOverModal } from './components/GameOverModal';
import { ModeSelectModal } from './components/ModeSelectModal';
import { FloatingCashEffect } from './components/FloatingCashEffect';
import { GameSetupScreen } from './components/GameSetupScreen';
import { EmergencyDebtModal } from './components/EmergencyDebtModal';
import { StartUpgradeModal, getUpgradeableCities } from './components/StartUpgradeModal';
import { IslandModal } from './components/IslandModal';
import { ForceSellModal, ForceSellTargetBuilding } from './components/ForceSellModal';
import { GateScreen } from './components/GateScreen';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { WaitingRoom, WaitingRoomData } from './components/WaitingRoom';
import { InGameMultiplayerHUD, FloatingReaction } from './components/InGameMultiplayerHUD';
import { getSocket, getSavedAccessCode, saveAccessCode, clearAccessCode } from './utils/socket';
import { Trophy } from 'lucide-react';

const INITIAL_MONEY = 300;
const SALARY_AMOUNT = 20;

export default function App() {
  // Screen views: 'gate' | 'lobby' | 'waiting' | 'setup' | 'playing'
  const [appScreen, setAppScreen] = useState<'gate' | 'lobby' | 'waiting' | 'setup' | 'playing'>(() => {
    const saved = getSavedAccessCode();
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam === '964' || saved === '964') {
      saveAccessCode('964');
      return 'lobby';
    }
    return 'gate';
  });

  // Multiplayer socket state
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [currentRoom, setCurrentRoom] = useState<WaitingRoomData | null>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState<number>(0);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [isLobbyLoading, setIsLobbyLoading] = useState<boolean>(false);
  const [myProfile, setMyProfile] = useState<{ name: string; color: AirplaneColorId }>({
    name: '플레이어 1',
    color: 'red',
  });

  // In-game multiplayer extras
  const [opponentConnected, setOpponentConnected] = useState<boolean>(true);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [activeObserverModal, setActiveObserverModal] = useState<string | null>(null);
  const [activeObserverDetail, setActiveObserverDetail] = useState<string>('');

  // Game config & status
  const [gameConfig, setGameConfig] = useState<GameModeConfig>({
    humanCount: 2,
    aiCount: 0,
    speed: 'normal',
    timeLimitMinutes: 60,
  });
  const [isModeModalOpen, setIsModeModalOpen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const currentSpeed: GameSpeed = gameConfig.speed || 'normal';
  const speedConfig = SPEED_CONFIGS[currentSpeed];

  // Players state
  const [players, setPlayers] = useState<Player[]>(() =>
    createPlayersForMode(2, 0, INITIAL_MONEY, undefined, ['red', 'blue'])
  );

  // Board Cells state
  const [cells, setCells] = useState<Record<number, CellState>>(() => {
    const init: Record<number, CellState> = {};
    BOARD_SPACES.forEach((s) => {
      init[s.id] = {
        owner: null,
        buildings: { hasVilla: false, hasBuilding: false, hasHotel: false, isLandmark: false },
        currentToll: 0,
      };
    });
    return init;
  });

  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [turnCount, setTurnCount] = useState<number>(1);
  const [socialFund, setSocialFund] = useState<number>(50);

  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [isTumbling, setIsTumbling] = useState<boolean>(false);
  const [isTurnBusy, setIsTurnBusy] = useState<boolean>(false);
  const [currentDice, setCurrentDice] = useState<[number, number]>([3, 4]);
  const [lastDice, setLastDice] = useState<[number, number] | null>(null);
  const [isDouble, setIsDouble] = useState<boolean>(false);
  const [doubleCount, setDoubleCount] = useState<number>(0);

  const [gameLogs, setGameLogs] = useState<GameLogEntry[]>([]);
  const [floatingEffects, setFloatingEffects] = useState<FloatingEffect[]>([]);
  const [turnBannerVisible, setTurnBannerVisible] = useState<boolean>(true);
  const [boardBroadcast, setBoardBroadcast] = useState<BoardBroadcastMessage | null>(null);

  // Active modal controls
  const [activeModal, setActiveModal] = useState<null | 'purchase' | 'toll' | 'golden_key' | 'space_travel' | 'game_over' | 'debt' | 'start_upgrade' | 'island' | 'force_sell_land' | 'force_sell_building'>(null);
  const [selectedWarpSpace, setSelectedWarpSpace] = useState<SpaceData | null>(null);
  const [currentGoldenKey, setCurrentGoldenKey] = useState<GoldenKeyCard | null>(null);
  const [goldenKeyContext, setGoldenKeyContext] = useState<{
    card: GoldenKeyCard;
    player: Player;
    currentTurnSeq: number;
    rolledDouble: boolean;
  } | null>(null);
  const [currentTollData, setCurrentTollData] = useState<{ space: SpaceData; owner: Player; payer: Player } | null>(null);
  const [debtModalData, setDebtModalData] = useState<{
    payer: Player;
    debtAmount: number;
    totalRequiredAmount?: number;
    recipient: Player | null;
    reasonText: string;
    rolledDouble?: boolean;
    onSuccess: (updatedPayer: Player, updatedRecipient: Player | null) => void;
  } | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverResult | null>(null);
  const [showGameOverModal, setShowGameOverModal] = useState<boolean>(false);

  // Concurrency refs
  const turnSeqRef = useRef<number>(1);
  const timersRef = useRef<number[]>([]);
  const broadcastTimeoutRef = useRef<number | null>(null);

  const playersRef = useRef<Player[]>(players);
  const cellsRef = useRef<Record<number, CellState>>(cells);
  const activePlayerIndexRef = useRef<number>(activePlayerIndex);
  const isTurnBusyRef = useRef<boolean>(false);
  const doubleCountRef = useRef<number>(0);
  const rolledDoubleRef = useRef<boolean>(false);
  const gameOverDataRef = useRef<GameOverResult | null>(null);
  const currentRoomRef = useRef<WaitingRoomData | null>(null);
  const isMultiplayerRef = useRef<boolean>(isMultiplayer);
  const myPlayerIndexRef = useRef<number>(myPlayerIndex);

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { cellsRef.current = cells; }, [cells]);
  useEffect(() => { activePlayerIndexRef.current = activePlayerIndex; }, [activePlayerIndex]);
  useEffect(() => { isTurnBusyRef.current = isTurnBusy; }, [isTurnBusy]);
  useEffect(() => { doubleCountRef.current = doubleCount; }, [doubleCount]);
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);
  useEffect(() => { isMultiplayerRef.current = isMultiplayer; }, [isMultiplayer]);
  useEffect(() => { myPlayerIndexRef.current = myPlayerIndex; }, [myPlayerIndex]);

  // Timers
  const registerTimer = useCallback((fn: () => void, delayMs: number, expectedTurnSeq?: number) => {
    const timerId = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter(t => t !== timerId);
      if (expectedTurnSeq !== undefined && expectedTurnSeq !== turnSeqRef.current) return;
      fn();
    }, delayMs);
    timersRef.current.push(timerId);
    return timerId;
  }, []);

  const registerInterval = useCallback((fn: () => void, intervalMs: number) => {
    const intervalId = window.setInterval(fn, intervalMs);
    timersRef.current.push(intervalId);
    return intervalId;
  }, []);

  const clearAllGameTimers = useCallback(() => {
    timersRef.current.forEach(t => {
      window.clearTimeout(t);
      window.clearInterval(t);
    });
    timersRef.current = [];
    if (broadcastTimeoutRef.current) {
      window.clearTimeout(broadcastTimeoutRef.current);
      broadcastTimeoutRef.current = null;
    }
    soundManager.stopAll();
  }, []);

  const triggerBroadcast = useCallback((msg: Omit<BoardBroadcastMessage, 'id' | 'timestamp'>) => {
    if (broadcastTimeoutRef.current) {
      window.clearTimeout(broadcastTimeoutRef.current);
      broadcastTimeoutRef.current = null;
    }
    setBoardBroadcast({
      ...msg,
      id: Math.random().toString(),
      timestamp: Date.now(),
    });

    broadcastTimeoutRef.current = window.setTimeout(() => {
      setBoardBroadcast(null);
      broadcastTimeoutRef.current = null;
    }, 6500);
  }, []);

  useEffect(() => {
    soundManager.enabled = soundEnabled;
  }, [soundEnabled]);

  // Floating cash animation
  const showFloatingEffect = (playerId: number, amount: number, isPositive: boolean) => {
    const newFx: FloatingEffect = {
      id: Math.random().toString(),
      playerId,
      amount,
      isPositive,
      text: `${isPositive ? '+' : '-'}${amount}만 원`,
      x: 50 + (playerId % 2 === 0 ? -15 : 15),
      y: 50,
    };
    setFloatingEffects(prev => [...prev, newFx]);
    setTimeout(() => {
      setFloatingEffects(prev => prev.filter(f => f.id !== newFx.id));
    }, 1800);
  };

  // Log
  const addLog = (playerId: number, text: string, type: GameLogEntry['type']) => {
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setGameLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        playerId,
        text,
        type,
        timestamp: timeStr,
      },
    ]);
  };

  // Recalculate total assets
  const updateTotalAssets = (updatedPlayers: Player[], updatedCells: Record<number, CellState>) => {
    return updatedPlayers.map(p => {
      let propertySum = 0;
      let count = 0;
      Object.entries(updatedCells).forEach(([idStr, cell]) => {
        if (cell.owner === p.id) {
          count++;
          const space = BOARD_SPACES[Number(idStr)];
          if (space) {
            propertySum += calculateSpaceValue(space, cell.buildings);
          }
        }
      });
      const netAssets = Math.max(0, p.money + propertySum - (p.debt || 0));
      return {
        ...p,
        totalAssets: netAssets,
        ownedCityCount: count,
      };
    });
  };

  // State Broadcast Helper for Realtime Sync
  const broadcastSyncState = (overrides?: Partial<any>) => {
    if (!isMultiplayerRef.current || !currentRoomRef.current) return;
    const socket = getSocket();
    const payload = {
      players: playersRef.current,
      cells: cellsRef.current,
      activePlayerIndex: activePlayerIndexRef.current,
      turnCount,
      socialFund,
      currentDice,
      lastDice,
      isDouble,
      doubleCount: doubleCountRef.current,
      activeModal,
      activeObserverModal: activeModal,
      activeObserverDetail: activeModal === 'purchase'
        ? `${playersRef.current[activePlayerIndexRef.current]?.name}님이 토지/건물 구매를 검토하고 있습니다.`
        : activeModal === 'toll'
        ? `${playersRef.current[activePlayerIndexRef.current]?.name}님이 통행료 지불 및 인수 여부를 결정 중입니다.`
        : activeModal === 'space_travel'
        ? `${playersRef.current[activePlayerIndexRef.current]?.name}님이 우주여행 목적지를 선택하고 있습니다.`
        : activeModal === 'golden_key'
        ? `${playersRef.current[activePlayerIndexRef.current]?.name}님이 황금열쇠 카드를 확인하고 있습니다.`
        : activeModal === 'island'
        ? `${playersRef.current[activePlayerIndexRef.current]?.name}님이 무인도 탈출 작전을 선택하고 있습니다.`
        : '',
      remainingSeconds,
      gameOverData: gameOverDataRef.current,
      ...overrides,
    };
    socket.emit('sync_game_state', {
      roomId: currentRoomRef.current.id,
      gameState: payload,
    });
  };

  // Socket Connection & Event Listeners
  useEffect(() => {
    if (appScreen === 'gate') return;

    const socket = getSocket('964');

    function onConnect() {
      setSocketConnected(true);
      setLobbyError(null);
    }

    function onDisconnect() {
      setSocketConnected(false);
    }

    function onRoomUpdated(updatedRoom: WaitingRoomData) {
      setCurrentRoom(updatedRoom);
      if (updatedRoom.players.length === 2 && isMultiplayerRef.current) {
        setOpponentConnected(true);
      }
    }

    function onPlayerDisconnected(data: { playerIndex: number; playerName: string }) {
      if (isMultiplayerRef.current) {
        setOpponentConnected(false);
        addLog(data.playerIndex, `⚠️ [${data.playerName}] 님의 연결이 일시적으로 끊겼습니다. 재접속 대기 중...`, 'event');
      }
    }

    function onPlayerReconnected(data: { playerIndex: number }) {
      if (isMultiplayerRef.current) {
        setOpponentConnected(true);
        addLog(data.playerIndex, `🟢 상대방이 게임에 다시 연결되었습니다!`, 'event');
      }
    }

    function onGameStarted(data: { room: WaitingRoomData; initialGameState: any }) {
      setCurrentRoom(data.room);
      setIsMultiplayer(true);
      setOpponentConnected(true);

      // Initialize from room config
      const p1 = data.room.players[0];
      const p2 = data.room.players[1];

      const newPlayers: Player[] = [
        {
          id: 0,
          name: p1.name,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p1.name)}`,
          airplaneColor: (p1.color as AirplaneColorId) || 'red',
          color: AIRPLANE_CONFIGS[p1.color as AirplaneColorId]?.primaryColor || '#ef4444',
          glowColor: AIRPLANE_CONFIGS[p1.color as AirplaneColorId]?.glowColor || '#fca5a5',
          secondaryColor: AIRPLANE_CONFIGS[p1.color as AirplaneColorId]?.secondaryColor || '#b91c1c',
          pos: 0,
          prevPos: 0,
          money: data.room.config.initialMoney || INITIAL_MONEY,
          totalAssets: data.room.config.initialMoney || INITIAL_MONEY,
          isAI: false,
          islandTurnsLeft: 0,
          hasIslandEscapeCard: 0,
          freePassCards: 0,
          spaceTravelQueued: false,
          isBankrupt: false,
          ownedCityCount: 0,
          debt: 0,
          hasUsedLoan: false,
        },
        {
          id: 1,
          name: p2.name,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p2.name)}`,
          airplaneColor: (p2.color as AirplaneColorId) || 'blue',
          color: AIRPLANE_CONFIGS[p2.color as AirplaneColorId]?.primaryColor || '#2563eb',
          glowColor: AIRPLANE_CONFIGS[p2.color as AirplaneColorId]?.glowColor || '#93c5fd',
          secondaryColor: AIRPLANE_CONFIGS[p2.color as AirplaneColorId]?.secondaryColor || '#1d4ed8',
          pos: 0,
          prevPos: 0,
          money: data.room.config.initialMoney || INITIAL_MONEY,
          totalAssets: data.room.config.initialMoney || INITIAL_MONEY,
          isAI: false,
          islandTurnsLeft: 0,
          hasIslandEscapeCard: 0,
          freePassCards: 0,
          spaceTravelQueued: false,
          isBankrupt: false,
          ownedCityCount: 0,
          debt: 0,
          hasUsedLoan: false,
        },
      ];

      const initCells: Record<number, CellState> = {};
      BOARD_SPACES.forEach((s) => {
        initCells[s.id] = {
          owner: null,
          buildings: { hasVilla: false, hasBuilding: false, hasHotel: false, isLandmark: false },
          currentToll: 0,
        };
      });

      setPlayers(newPlayers);
      playersRef.current = newPlayers;
      setCells(initCells);
      cellsRef.current = initCells;
      setActivePlayerIndex(0);
      activePlayerIndexRef.current = 0;
      setTurnCount(1);
      setSocialFund(50);
      setGameConfig(prev => ({
        ...prev,
        speed: data.room.config.speed,
        timeLimitMinutes: data.room.config.timeLimitMinutes,
      }));

      if (data.room.config.timeLimitMinutes > 0) {
        setRemainingSeconds(data.room.config.timeLimitMinutes * 60);
      } else {
        setRemainingSeconds(null);
      }

      setGameOverData(null);
      gameOverDataRef.current = null;
      setShowGameOverModal(false);
      setActiveModal(null);
      setActiveObserverModal(null);
      setGameLogs([]);

      setAppScreen('playing');

      addLog(0, `🎲 실시간 2인 대전 시작! [${p1.name}] VS [${p2.name}]`, 'event');
      triggerBroadcast({
        category: 'turn',
        playerId: 0,
        playerName: p1.name,
        playerColor: p1.color,
        isAI: false,
        title: `🎮 실시간 대전 시작! [${p1.name}] 선공 차례`,
        detail: '주사위를 굴려 부를 축적하고 승리하세요!',
        badge: '1라운드 시작',
        badgeColor: 'emerald',
      });
      setTurnBannerVisible(true);
      registerTimer(() => setTurnBannerVisible(false), SPEED_CONFIGS[data.room.config.speed].bannerDurationMs);
    }

    function onRemoteDiceRolled(payload: {
      dice: [number, number];
      isDouble: boolean;
      doubleCount: number;
      playerIndex: number;
    }) {
      // Execute the exact dice roll animation remotely for spectator parity
      executeRemoteRollAnimation(payload.dice, payload.isDouble, payload.doubleCount, payload.playerIndex);
    }

    function onGameStateSynced(incomingState: any) {
      if (!incomingState) return;

      if (incomingState.cells) {
        setCells(incomingState.cells);
        cellsRef.current = incomingState.cells;
      }
      if (incomingState.players) {
        setPlayers(incomingState.players);
        playersRef.current = incomingState.players;
      }
      if (incomingState.activePlayerIndex !== undefined) {
        setActivePlayerIndex(incomingState.activePlayerIndex);
        activePlayerIndexRef.current = incomingState.activePlayerIndex;
      }
      if (incomingState.turnCount !== undefined) {
        setTurnCount(incomingState.turnCount);
      }
      if (incomingState.socialFund !== undefined) {
        setSocialFund(incomingState.socialFund);
      }
      if (incomingState.remainingSeconds !== undefined) {
        setRemainingSeconds(incomingState.remainingSeconds);
      }
      if (incomingState.gameOverData) {
        setGameOverData(incomingState.gameOverData);
        gameOverDataRef.current = incomingState.gameOverData;
        setShowGameOverModal(true);
      }

      // Observer Modal notice
      if (incomingState.activeObserverModal) {
        setActiveObserverModal(incomingState.activeObserverModal);
        setActiveObserverDetail(incomingState.activeObserverDetail || '');
      } else {
        setActiveObserverModal(null);
        setActiveObserverDetail('');
      }
    }

    function onChatMessage(msg: any) {
      setCurrentRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, msg],
        };
      });
    }

    function onReactionReceived(data: { id: string; emoji: string; senderName: string }) {
      soundManager.playTilePass();
      setFloatingReactions(prev => [...prev, data]);
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== data.id));
      }, 2400);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_updated', onRoomUpdated);
    socket.on('player_disconnected', onPlayerDisconnected);
    socket.on('player_reconnected', onPlayerReconnected);
    socket.on('game_started', onGameStarted);
    socket.on('dice_rolled', onRemoteDiceRolled);
    socket.on('game_state_synced', onGameStateSynced);
    socket.on('chat_message', onChatMessage);
    socket.on('reaction_received', onReactionReceived);

    if (socket.connected) {
      setSocketConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_updated', onRoomUpdated);
      socket.off('player_disconnected', onPlayerDisconnected);
      socket.off('player_reconnected', onPlayerReconnected);
      socket.off('game_started', onGameStarted);
      socket.off('dice_rolled', onRemoteDiceRolled);
      socket.off('game_state_synced', onGameStateSynced);
      socket.off('chat_message', onChatMessage);
      socket.off('reaction_received', onReactionReceived);
    };
  }, [appScreen, registerTimer]);

  // Check URL query param for room code on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && appScreen === 'lobby' && socketConnected) {
      handleJoinRoom(roomParam);
    }
  }, [appScreen, socketConnected]);

  // Turn Sequence Switch
  const endTurn = (rolledDoubleParam: boolean = false, fromTurnSeq?: number) => {
    if (gameOverDataRef.current) return;
    if (fromTurnSeq !== undefined && fromTurnSeq !== turnSeqRef.current) return;

    const activePlayer = playersRef.current[activePlayerIndexRef.current];
    const isTrappedInIsland = activePlayer ? activePlayer.islandTurnsLeft > 0 : false;
    const canContinueDouble = rolledDoubleParam && !isTrappedInIsland;

    if (canContinueDouble) {
      rolledDoubleRef.current = true;
      const currentSeq = ++turnSeqRef.current;
      soundManager.playTurnSwitch();
      setTurnBannerVisible(true);
      registerTimer(() => setTurnBannerVisible(false), speedConfig.bannerDurationMs, currentSeq);

      setIsTurnBusy(false);
      setIsRolling(false);
      setIsTumbling(false);
      setActiveModal(null);

      if (activePlayer) {
        triggerBroadcast({
          category: 'turn',
          playerId: activePlayer.id,
          playerName: activePlayer.name,
          playerColor: activePlayer.color,
          isAI: activePlayer.isAI,
          title: `🎯 [${activePlayer.name}] 더블 찬스 추가 턴!`,
          detail: activePlayer.isAI ? '컴퓨터 AI가 추가 턴 주사위를 굴립니다...' : '🎲 한 번 더 주사위를 굴려 이동하세요!',
          badge: '더블 추가턴',
          badgeColor: 'amber',
        });
      }
      broadcastSyncState({ activeModal: null });
      return;
    }

    rolledDoubleRef.current = false;
    setDoubleCount(0);
    doubleCountRef.current = 0;
    setIsDouble(false);
    setActiveModal(null);
    setIsRolling(false);
    setIsTumbling(false);

    const currentSeq = ++turnSeqRef.current;
    const total = playersRef.current.length;
    let nextIdx = activePlayerIndexRef.current;
    for (let i = 1; i <= total; i++) {
      const candidate = (activePlayerIndexRef.current + i) % total;
      if (!playersRef.current[candidate].isBankrupt) {
        nextIdx = candidate;
        break;
      }
    }

    activePlayerIndexRef.current = nextIdx;
    setActivePlayerIndex(nextIdx);
    setTurnCount(prev => prev + 1);

    const nextPlayer = playersRef.current[nextIdx];
    if (nextPlayer) {
      if (nextPlayer.spaceTravelQueued) {
        triggerBroadcast({
          category: 'space_travel',
          playerId: nextPlayer.id,
          playerName: nextPlayer.name,
          playerColor: nextPlayer.color,
          isAI: nextPlayer.isAI,
          title: `🛸 [${nextPlayer.name}] 우주여행 차례입니다!`,
          detail: nextPlayer.isAI
            ? '컴퓨터 AI가 우주여행 목적지를 연산 중입니다...'
            : '🚀 [우주여행 하기] 버튼을 눌러 원하는 목적지로 워프하세요!',
          badge: '우주여행 턴',
          badgeColor: 'purple',
        });
      } else {
        triggerBroadcast({
          category: 'turn',
          playerId: nextPlayer.id,
          playerName: nextPlayer.name,
          playerColor: nextPlayer.color,
          isAI: nextPlayer.isAI,
          title: `🏁 [${nextPlayer.name}] 님의 차례입니다`,
          detail: nextPlayer.isAI
            ? '컴퓨터 AI가 주사위 굴림 및 부동산 전략을 연산 중입니다...'
            : nextPlayer.islandTurnsLeft > 0
            ? '🏝️ 무인도 조난 탈출 작전 선택이 필요합니다.'
            : '🎲 주사위 굴리기 버튼을 눌러 이동하세요!',
          badge: nextPlayer.isAI ? 'AI 턴' : nextPlayer.islandTurnsLeft > 0 ? '무인도 조난' : '플레이어 턴',
          badgeColor: nextPlayer.isAI ? 'purple' : nextPlayer.islandTurnsLeft > 0 ? 'indigo' : 'emerald',
        });
      }

      if (!nextPlayer.isAI && nextPlayer.islandTurnsLeft > 0) {
        // Trapped in island
        const isMe = !isMultiplayerRef.current || (myPlayerIndexRef.current === nextIdx);
        if (isMe) {
          setIsTurnBusy(true);
          registerTimer(() => {
            if (turnSeqRef.current === currentSeq) {
              setActiveModal('island');
              setIsTurnBusy(false);
              broadcastSyncState({ activeModal: 'island' });
            }
          }, speedConfig.bannerDurationMs, currentSeq);
        }
      }
    }

    soundManager.playTurnSwitch();
    setTurnBannerVisible(true);
    registerTimer(() => setTurnBannerVisible(false), speedConfig.bannerDurationMs, currentSeq);

    if (!(!nextPlayer.isAI && nextPlayer.islandTurnsLeft > 0)) {
      setIsTurnBusy(false);
    }

    broadcastSyncState({
      activePlayerIndex: nextIdx,
      activeModal: null,
    });
  };

  // Check Game Over & Bankruptcy
  const checkGameOver = (playerList: Player[]) => {
    const updated = playerList.map(p => {
      if (p.money < 0 && !p.isBankrupt) {
        addLog(p.id, `🚨 ${p.name} 보유 자금 고갈로 파산 탈락했습니다!`, 'bankrupt');
        triggerBroadcast({
          category: 'bankrupt',
          playerId: p.id,
          playerName: p.name,
          playerColor: p.color,
          isAI: p.isAI,
          title: `💥 [${p.name}] 파산 탈락!`,
          detail: '자금 부족으로 모든 자산이 매각되고 게임에서 탈락했습니다.',
          badge: '파산 탈락',
          badgeColor: 'rose',
        });
        return { ...p, isBankrupt: true };
      }
      return p;
    });

    const bankruptIds = updated.filter(p => p.isBankrupt).map(p => p.id);
    if (bankruptIds.length > 0) {
      setCells(prev => {
        const nextCells: Record<number, CellState> = { ...prev };
        let modified = false;
        Object.entries(nextCells).forEach(([idStr, cell]) => {
          if (cell.owner !== null && bankruptIds.includes(cell.owner)) {
            nextCells[Number(idStr)] = {
              owner: null,
              buildings: { hasVilla: false, hasBuilding: false, hasHotel: false, isLandmark: false },
              currentToll: 0,
            };
            modified = true;
          }
        });
        if (modified) cellsRef.current = nextCells;
        return modified ? nextCells : prev;
      });
    }

    setPlayers(updated);
    playersRef.current = updated;

    const remaining = updated.filter(p => !p.isBankrupt);
    if (remaining.length === 1) {
      const winner = remaining[0];
      soundManager.playVictory();
      const result: GameOverResult = {
        winner,
        rankings: [...updated].sort((a, b) => b.totalAssets - a.totalAssets),
        reason: `👑 상대 플레이어 파산 탈락! [${winner.name}] 독점 완승!`,
      };
      setGameOverData(result);
      gameOverDataRef.current = result;
      setShowGameOverModal(true);
      setActiveModal('game_over');
      setIsTurnBusy(false);
      setIsRolling(false);
      setIsTumbling(false);
      broadcastSyncState({ gameOverData: result, activeModal: 'game_over' });
    }
  };

  // Remote Spectator Animation
  const executeRemoteRollAnimation = (
    dice: [number, number],
    isDoubleVal: boolean,
    doubleCountVal: number,
    playerIdx: number
  ) => {
    setIsTurnBusy(true);
    setIsRolling(true);
    setIsTumbling(true);

    const totalTicks = speedConfig.diceRollTicks;
    const tickInterval = speedConfig.diceRollIntervalMs;
    soundManager.playDiceRoll(totalTicks * tickInterval);

    let count = 0;
    const interval = registerInterval(() => {
      setCurrentDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
      count++;
      if (count >= totalTicks) {
        window.clearInterval(interval);
        setCurrentDice(dice);
        setLastDice(dice);
        setIsTumbling(false);
        soundManager.playDiceLand();

        setIsDouble(isDoubleVal);
        setDoubleCount(doubleCountVal);

        const total = dice[0] + dice[1];
        const activeP = playersRef.current[playerIdx];

        if (activeP) {
          addLog(activeP.id, `🎲 ${activeP.name} 주사위 [${dice[0]} + ${dice[1]} = ${total}] 굴림${isDoubleVal ? ' (더블!)' : ''}`, 'roll');
          triggerBroadcast({
            category: 'roll',
            playerId: activeP.id,
            playerName: activeP.name,
            playerColor: activeP.color,
            isAI: activeP.isAI,
            title: `🎲 [${activeP.name}] 주사위 [${dice[0]} + ${dice[1]} = ${total}]${isDoubleVal ? ' 더블! 🎯' : ''}`,
            detail: `${activeP.name}님이 ${total}칸 전진합니다.`,
            badge: isDoubleVal ? `더블 찬스 (${doubleCountVal}회)` : '이동 중',
            badgeColor: isDoubleVal ? 'amber' : 'emerald',
          });
        }

        // Animate token movement step by step
        movePlayerStepByStep(activeP, total, turnSeqRef.current, isDoubleVal, true);
      }
    }, tickInterval);
  };

  // Step by step token movement
  const movePlayerStepByStep = (
    player: Player,
    steps: number,
    currentTurnSeq: number,
    rolledDoubleVal: boolean,
    isRemote: boolean = false
  ) => {
    let currentStep = 0;
    let currentPosition = player.pos;
    const startPos = player.pos;

    const stepInterval = registerInterval(() => {
      if (currentTurnSeq !== turnSeqRef.current) {
        window.clearInterval(stepInterval);
        return;
      }

      currentStep++;
      const nextPos = (currentPosition + 1) % 32;

      // Salary pass check
      if (currentPosition === 31 && nextPos === 0) {
        soundManager.playCashGain();
        addLog(player.id, `🚩 출발점 통과! 월급 +${SALARY_AMOUNT}만 원 지급`, 'event');
        showFloatingEffect(player.id, SALARY_AMOUNT, true);
        triggerBroadcast({
          category: 'salary',
          playerId: player.id,
          playerName: player.name,
          playerColor: player.color,
          isAI: player.isAI,
          title: `🚩 [출발점 통과] 월급 수령 (+${SALARY_AMOUNT}만 원)`,
          detail: `${player.name}님이 출발점을 한 바퀴 돌아 보너스 급여를 수령했습니다!`,
          badge: `월급 +${SALARY_AMOUNT}만`,
          badgeColor: 'emerald',
        });
        setPlayers(prev => {
          const next = prev.map(p => p.id === player.id ? { ...p, money: p.money + SALARY_AMOUNT } : p);
          playersRef.current = next;
          return updateTotalAssets(next, cellsRef.current);
        });
      }

      currentPosition = nextPos;
      soundManager.playTilePass();

      setPlayers(prev => {
        const next = prev.map(p => p.id === player.id ? { ...p, pos: currentPosition, prevPos: (currentPosition - 1 + 32) % 32 } : p);
        playersRef.current = next;
        return next;
      });

      if (currentStep >= steps) {
        window.clearInterval(stepInterval);
        setIsRolling(false);
        soundManager.playTilePass();

        const finalSpace = BOARD_SPACES[currentPosition];

        // If local active player, process tile action and trigger modals
        if (!isRemote) {
          registerTimer(() => {
            handleSpaceAction(player, finalSpace, currentTurnSeq, rolledDoubleVal);
          }, speedConfig.arrivalPauseMs, currentTurnSeq);
        } else {
          setIsTurnBusy(false);
        }
      }
    }, speedConfig.stepIntervalMs);
  };

  // Roll Dice Trigger
  const triggerDiceRoll = () => {
    const activePlayer = playersRef.current[activePlayerIndexRef.current];
    if (!activePlayer || activePlayer.isBankrupt || isTurnBusy || isRolling || isTumbling) return;

    // In multiplayer: only active player can roll!
    if (isMultiplayer && activePlayerIndexRef.current !== myPlayerIndex) return;

    setIsTurnBusy(true);
    setIsRolling(true);
    setIsTumbling(true);

    const currentTurnSeq = turnSeqRef.current;
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const rolledDoubleVal = d1 === d2;
    const nextDoubleCount = rolledDoubleVal ? doubleCountRef.current + 1 : 0;

    const totalTicks = speedConfig.diceRollTicks;
    const tickInterval = speedConfig.diceRollIntervalMs;

    soundManager.playDiceRoll(totalTicks * tickInterval);

    // If multiplayer, broadcast dice roll immediately
    if (isMultiplayer && currentRoom) {
      const socket = getSocket();
      socket.emit('dice_rolled', {
        roomId: currentRoom.id,
        dice: [d1, d2],
        isDouble: rolledDoubleVal,
        doubleCount: nextDoubleCount,
        playerIndex: activePlayerIndexRef.current,
      });
    }

    let count = 0;
    const interval = registerInterval(() => {
      if (currentTurnSeq !== turnSeqRef.current) {
        window.clearInterval(interval);
        return;
      }

      setCurrentDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
      count++;

      if (count >= totalTicks) {
        window.clearInterval(interval);
        setCurrentDice([d1, d2]);
        setLastDice([d1, d2]);
        setIsTumbling(false);
        soundManager.playDiceLand();

        const total = d1 + d2;
        setIsDouble(rolledDoubleVal);
        rolledDoubleRef.current = rolledDoubleVal;
        setDoubleCount(nextDoubleCount);
        doubleCountRef.current = nextDoubleCount;

        if (rolledDoubleVal) {
          soundManager.playDoubleBonus();
          addLog(activePlayer.id, `🎲 ${activePlayer.name} 주사위 [${d1} + ${d2} = ${total}] 더블 굴림! (연속 ${nextDoubleCount}회)`, 'roll');
          triggerBroadcast({
            category: 'roll',
            playerId: activePlayer.id,
            playerName: activePlayer.name,
            playerColor: activePlayer.color,
            isAI: activePlayer.isAI,
            title: `🎲 주사위 [${d1} + ${d2} = ${total}] 더블! (연속 ${nextDoubleCount}회) 🎯`,
            detail: `${activePlayer.name}님이 ${total}칸 전진합니다. (더블 찬스로 한 번 더 굴림!)`,
            badge: `더블 찬스 (${nextDoubleCount}연속)`,
            badgeColor: 'amber',
          });
        } else {
          addLog(activePlayer.id, `🎲 ${activePlayer.name} 주사위 [${d1} + ${d2} = ${total}] 굴림`, 'roll');
          triggerBroadcast({
            category: 'roll',
            playerId: activePlayer.id,
            playerName: activePlayer.name,
            playerColor: activePlayer.color,
            isAI: activePlayer.isAI,
            title: `🎲 [${activePlayer.name}] 주사위 [${d1} + ${d2} = ${total}]`,
            detail: `${activePlayer.name}님이 ${total}칸 전진합니다.`,
            badge: '이동 중',
            badgeColor: 'emerald',
          });
        }

        // Animate movement
        movePlayerStepByStep(activePlayer, total, currentTurnSeq, rolledDoubleVal, false);
      }
    }, tickInterval);
  };

  // Handle Tile Action on Landing
  const handleSpaceAction = (
    player: Player,
    space: SpaceData,
    currentTurnSeq: number,
    rolledDoubleParam: boolean = false
  ) => {
    if (currentTurnSeq !== turnSeqRef.current) return;
    const validatedPlayer: Player = { ...player, pos: space.id };
    const cellState = cellsRef.current[space.id] || {
      owner: null,
      buildings: { hasVilla: false, hasBuilding: false, hasHotel: false, isLandmark: false },
      currentToll: 0,
    };

    // 1. Island
    if (space.type === 'island') {
      soundManager.playTollPenalty();
      addLog(player.id, `🏝️ ${player.name}가 무인도에 조난되었습니다! (3턴 격리)`, 'event');
      triggerBroadcast({
        category: 'island',
        playerId: player.id,
        playerName: player.name,
        playerColor: player.color,
        isAI: player.isAI,
        title: `🏝️ [무인도] 조난 도착!`,
        detail: `${player.name}님이 무인도에 갇혔습니다. 3턴 동안 탈출을 시도해야 합니다.`,
        badge: '무인도 3턴',
        badgeColor: 'indigo',
      });
      setPlayers(prev => {
        const next = prev.map(p => p.id === player.id ? { ...p, islandTurnsLeft: 3 } : p);
        playersRef.current = next;
        return updateTotalAssets(next, cellsRef.current);
      });
      rolledDoubleRef.current = false;
      setDoubleCount(0);
      doubleCountRef.current = 0;
      setIsDouble(false);
      registerTimer(() => endTurn(false, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
      return;
    }

    // 2. Space Travel
    if (space.type === 'space') {
      soundManager.playGoldenKey();
      addLog(player.id, `🛸 ${player.name}가 우주정거장에 도착! 다음 턴 워프 이동이 예약됩니다.`, 'event');
      triggerBroadcast({
        category: 'space_travel',
        playerId: player.id,
        playerName: player.name,
        playerColor: player.color,
        isAI: player.isAI,
        title: `🛸 [우주정거장 콜롬비아] 도착!`,
        detail: '우주선 탑승 완료! 다음 턴 원하는 도시로 즉시 순간이동할 수 있습니다.',
        badge: '워프 예약',
        badgeColor: 'purple',
      });
      setPlayers(prev => {
        const next = prev.map(p => p.id === player.id ? { ...p, spaceTravelQueued: true } : p);
        playersRef.current = next;
        return updateTotalAssets(next, cellsRef.current);
      });
      rolledDoubleRef.current = false;
      registerTimer(() => endTurn(false, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
      return;
    }

    // 3. Social Fund
    if (space.type === 'fund') {
      if (socialFund > 0) {
        soundManager.playCashGain();
        addLog(player.id, `🏦 사회복지기금 접수처에 도착! 누적된 ${socialFund}만 원 전액을 수령합니다!`, 'event');
        triggerBroadcast({
          category: 'fund',
          playerId: player.id,
          playerName: player.name,
          playerColor: player.color,
          isAI: player.isAI,
          title: `🏦 [사회복지기금 접수처] 잭팟 수령! (+${socialFund}만 원)`,
          detail: `누적된 사회복지기금 ${socialFund}만 원 전액을 ${player.name}님이 수령했습니다!`,
          badge: `잭팟 +${socialFund}만`,
          badgeColor: 'emerald',
        });
        showFloatingEffect(player.id, socialFund, true);
        const reward = socialFund;
        setSocialFund(0);
        setPlayers(prev => {
          const next = prev.map(p => p.id === player.id ? { ...p, money: p.money + reward } : p);
          playersRef.current = next;
          return updateTotalAssets(next, cellsRef.current);
        });
      } else {
        addLog(player.id, `🏦 사회복지기금 접수처에 도착했지만 누적 기금이 없습니다.`, 'event');
        triggerBroadcast({
          category: 'fund',
          playerId: player.id,
          playerName: player.name,
          playerColor: player.color,
          isAI: player.isAI,
          title: `🏦 [사회복지기금 접수처] 현재 기금 0원`,
          detail: '모금된 기금이 없어 지급받을 금액이 없습니다.',
          badge: '기금 0원',
          badgeColor: 'slate',
        });
      }
      registerTimer(() => endTurn(rolledDoubleParam, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
      return;
    }

    // 4. Tax
    if (space.type === 'tax') {
      const taxAmount = Math.max(15, Math.floor(player.totalAssets * 0.1));
      soundManager.playTollPenalty();
      addLog(player.id, `💸 국세청 국세 납부! 재산세 ${taxAmount}만 원을 납부했습니다.`, 'toll');
      triggerBroadcast({
        category: 'tax',
        playerId: player.id,
        playerName: player.name,
        playerColor: player.color,
        isAI: player.isAI,
        title: `💸 [국세청] 재산세 납부 (-${taxAmount}만 원)`,
        detail: `총 자산의 10%에 해당하는 세금 ${taxAmount}만 원이 사회복지기금으로 납부되었습니다.`,
        badge: `세금 -${taxAmount}만`,
        badgeColor: 'rose',
      });
      showFloatingEffect(player.id, taxAmount, false);
      setSocialFund(prev => prev + taxAmount);
      setPlayers(prev => {
        const next = prev.map(p => p.id === player.id ? { ...p, money: p.money - taxAmount } : p);
        playersRef.current = next;
        return updateTotalAssets(next, cellsRef.current);
      });
      registerTimer(() => endTurn(rolledDoubleParam, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
      return;
    }

    // 5. Golden Key
    if (space.type === 'golden_key') {
      const card = getRandomGoldenKey();
      setCurrentGoldenKey(card);
      setGoldenKeyContext({
        card,
        player: validatedPlayer,
        currentTurnSeq,
        rolledDouble: rolledDoubleParam,
      });
      soundManager.playGoldenKey();
      setActiveModal('golden_key');
      broadcastSyncState({ activeModal: 'golden_key' });
      return;
    }

    // 6. Start Tile
    if (space.type === 'start') {
      const upgradeable = getUpgradeableCities(BOARD_SPACES, cellsRef.current, player);
      if (upgradeable.length > 0) {
        soundManager.playGoldenKey();
        addLog(player.id, `🏁 출발점에 정밀 착지! 보유 도시 원격 증축 기회가 부여됩니다.`, 'event');
        setActiveModal('start_upgrade');
        broadcastSyncState({ activeModal: 'start_upgrade' });
      } else {
        addLog(player.id, `🏁 출발점에 정밀 착지! (증축 가능한 도시 없음)`, 'event');
        registerTimer(() => endTurn(rolledDoubleParam, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
      }
      return;
    }

    // 7. City / Property Tile
    if (space.type === 'city' || space.type === 'travel') {
      // Unowned Land
      if (cellState.owner === null) {
        soundManager.playTilePass();
        setActiveModal('purchase');
        broadcastSyncState({ activeModal: 'purchase' });
        return;
      }

      // My Land
      if (cellState.owner === player.id) {
        if (!cellState.buildings.isLandmark && !space.isSpecialLand) {
          setActiveModal('purchase');
          broadcastSyncState({ activeModal: 'purchase' });
        } else {
          addLog(player.id, `🏰 내 랜드마크 [${space.name}]에 방문했습니다.`, 'event');
          triggerBroadcast({
            category: 'purchase',
            playerId: player.id,
            playerName: player.name,
            playerColor: player.color,
            isAI: player.isAI,
            title: `🏰 [${space.name}] 내 랜드마크 방문!`,
            detail: '이미 최고 단계 랜드마크가 건설되어 더 이상 증축할 수 없습니다.',
            badge: '랜드마크 보유',
            badgeColor: 'amber',
          });
          registerTimer(() => endTurn(rolledDoubleParam, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
        }
        return;
      }

      // Opponent Land -> Toll Payment
      const landOwner = playersRef.current.find(p => p.id === cellState.owner);
      if (landOwner && !landOwner.isBankrupt) {
        setCurrentTollData({
          space,
          owner: landOwner,
          payer: validatedPlayer,
        });
        soundManager.playTollPenalty();
        setActiveModal('toll');
        broadcastSyncState({ activeModal: 'toll' });
        return;
      }
    }

    // Default Fallback
    registerTimer(() => endTurn(rolledDoubleParam, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
  };

  // Confirm Property Purchase / Upgrade
  const confirmPurchase = (
    buildings: { hasVilla: boolean; hasBuilding: boolean; hasHotel: boolean; isLandmark: boolean },
    cost: number
  ) => {
    const currentSeq = turnSeqRef.current;
    const activeP = playersRef.current[activePlayerIndexRef.current];
    const space = BOARD_SPACES[activeP.pos];
    if (!space) return;

    soundManager.playBuildingBuild(false);
    showFloatingEffect(activeP.id, cost, false);

    const isFirstBuy = cellsRef.current[space.id]?.owner === null;
    const nextToll = calculateToll(space, buildings);

    setCells(prev => {
      const next = {
        ...prev,
        [space.id]: {
          owner: activeP.id,
          buildings,
          currentToll: nextToll,
        },
      };
      cellsRef.current = next;
      return next;
    });

    setPlayers(prev => {
      const next = prev.map(p => p.id === activeP.id ? { ...p, money: p.money - cost } : p);
      playersRef.current = next;
      return updateTotalAssets(next, cellsRef.current);
    });

    if (buildings.isLandmark) {
      soundManager.playBuildingBuild(true);
      addLog(activeP.id, `🏰 ${activeP.name}가 [${space.name}]에 최고급 랜드마크를 완성했습니다!`, 'upgrade');
      triggerBroadcast({
        category: 'landmark',
        playerId: activeP.id,
        playerName: activeP.name,
        playerColor: activeP.color,
        isAI: activeP.isAI,
        title: `👑 [${space.name}] 랜드마크 건설 완료!`,
        detail: `상대방이 인수할 수 없는 완벽한 요새가 세워졌습니다! (통행료: ${nextToll}만 원)`,
        badge: '랜드마크 완공',
        badgeColor: 'amber',
      });
    } else if (isFirstBuy) {
      addLog(activeP.id, `🏢 ${activeP.name}가 [${space.name}] 토지를 매입했습니다. (비용: ${cost}만 원)`, 'buy');
      triggerBroadcast({
        category: 'purchase',
        playerId: activeP.id,
        playerName: activeP.name,
        playerColor: activeP.color,
        isAI: activeP.isAI,
        title: `🏢 [${space.name}] 매입 완료! (-${cost}만 원)`,
        detail: `${activeP.name}님이 소유권을 획득했습니다. (통행료: ${nextToll}만 원)`,
        badge: '부동산 매입',
        badgeColor: 'emerald',
      });
    } else {
      addLog(activeP.id, `🏗️ ${activeP.name}가 [${space.name}] 건물을 증축했습니다. (비용: ${cost}만 원)`, 'buy');
      triggerBroadcast({
        category: 'purchase',
        playerId: activeP.id,
        playerName: activeP.name,
        playerColor: activeP.color,
        isAI: activeP.isAI,
        title: `🏗️ [${space.name}] 건물 증축 완료! (-${cost}만 원)`,
        detail: `통행료가 ${nextToll}만 원으로 인상되었습니다.`,
        badge: '건물 증축',
        badgeColor: 'teal',
      });
    }

    setActiveModal(null);
    broadcastSyncState({ activeModal: null });
    registerTimer(() => endTurn(isDouble, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
  };

  // Pay Toll
  const executePayToll = (space: SpaceData, owner: Player, payer: Player, toll: number) => {
    const currentSeq = turnSeqRef.current;
    if (payer.money < toll) {
      // Need emergency liquidation or bankruptcy
      const debtAmount = toll - payer.money;
      setDebtModalData({
        payer,
        debtAmount,
        totalRequiredAmount: toll,
        recipient: owner,
        reasonText: `[${space.name}] 통행료 ${toll}만 원 지불 부족`,
        rolledDouble: isDouble,
        onSuccess: (updatedPayer, updatedOwner) => {
          setPlayers(prev => {
            const next = prev.map(p => {
              if (p.id === updatedPayer.id) return updatedPayer;
              if (updatedOwner && p.id === updatedOwner.id) return updatedOwner;
              return p;
            });
            playersRef.current = next;
            return updateTotalAssets(next, cellsRef.current);
          });
          setActiveModal(null);
          broadcastSyncState({ activeModal: null });
          registerTimer(() => endTurn(isDouble, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
        },
      });
      setActiveModal('debt');
      broadcastSyncState({ activeModal: 'debt' });
      return;
    }

    // Normal toll deduction
    soundManager.playTollPenalty();
    showFloatingEffect(payer.id, toll, false);
    showFloatingEffect(owner.id, toll, true);

    setPlayers(prev => {
      const next = prev.map(p => {
        if (p.id === payer.id) return { ...p, money: p.money - toll };
        if (p.id === owner.id) return { ...p, money: p.money + toll };
        return p;
      });
      playersRef.current = next;
      return updateTotalAssets(next, cellsRef.current);
    });

    addLog(payer.id, `💸 ${payer.name}가 [${space.name}] 통행료 ${toll}만 원을 [${owner.name}]에게 지불했습니다.`, 'toll');
    triggerBroadcast({
      category: 'toll',
      playerId: payer.id,
      playerName: payer.name,
      playerColor: payer.color,
      isAI: payer.isAI,
      title: `💸 [${space.name}] 통행료 ${toll}만 원 지불`,
      detail: `${payer.name} → ${owner.name} (통행료 정산 완료)`,
      badge: '통행료 지불',
      badgeColor: 'rose',
    });

    setActiveModal(null);
    broadcastSyncState({ activeModal: null });
    registerTimer(() => endTurn(isDouble, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
  };

  // Hostile Takeover (인수)
  const executeTakeover = (
    space: SpaceData,
    owner: Player,
    payer: Player,
    toll: number,
    takeoverCost: number
  ) => {
    const currentSeq = turnSeqRef.current;
    const totalRequired = toll + takeoverCost;

    if (payer.money < totalRequired) {
      alert('인수 자금이 부족합니다.');
      return;
    }

    soundManager.playBuildingBuild(false);
    showFloatingEffect(payer.id, totalRequired, false);
    showFloatingEffect(owner.id, totalRequired, true);

    const cellState = cellsRef.current[space.id];
    const buildings = cellState?.buildings || { hasVilla: false, hasBuilding: false, hasHotel: false, isLandmark: false };
    const nextToll = calculateToll(space, buildings);

    setCells(prev => {
      const next = {
        ...prev,
        [space.id]: {
          owner: payer.id,
          buildings,
          currentToll: nextToll,
        },
      };
      cellsRef.current = next;
      return next;
    });

    setPlayers(prev => {
      const next = prev.map(p => {
        if (p.id === payer.id) return { ...p, money: p.money - totalRequired };
        if (p.id === owner.id) return { ...p, money: p.money + totalRequired };
        return p;
      });
      playersRef.current = next;
      return updateTotalAssets(next, cellsRef.current);
    });

    addLog(payer.id, `🔥 ${payer.name}가 [${owner.name}]의 [${space.name}]을 전격 인수했습니다! (비용: ${takeoverCost}만 원)`, 'buy');
    triggerBroadcast({
      category: 'purchase',
      playerId: payer.id,
      playerName: payer.name,
      playerColor: payer.color,
      isAI: payer.isAI,
      title: `🔥 [${space.name}] 적대적 인수 성공!`,
      detail: `${payer.name}님이 통행료 및 2배 인수비용을 치르고 소유권을 가로챘습니다!`,
      badge: '도시 전격인수',
      badgeColor: 'amber',
    });

    setActiveModal(null);
    broadcastSyncState({ activeModal: null });
    registerTimer(() => endTurn(isDouble, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
  };

  // Free pass card usage
  const handleUseFreePass = (space: SpaceData, owner: Player, payer: Player) => {
    const currentSeq = turnSeqRef.current;
    soundManager.playGoldenKey();
    addLog(payer.id, `🎟️ ${payer.name}가 무료 통과권을 사용하여 [${space.name}] 통행료를 전액 면제받았습니다!`, 'event');
    triggerBroadcast({
      category: 'pass',
      playerId: payer.id,
      playerName: payer.name,
      playerColor: payer.color,
      isAI: payer.isAI,
      title: `🎟️ [무료 통과권 사용] 통행료 면제!`,
      detail: `${payer.name}님이 황금열쇠 무료 패스권으로 위기를 모면했습니다.`,
      badge: '통행료 면제',
      badgeColor: 'emerald',
    });

    setPlayers(prev => {
      const next = prev.map(p => p.id === payer.id ? { ...p, freePassCards: Math.max(0, p.freePassCards - 1) } : p);
      playersRef.current = next;
      return updateTotalAssets(next, cellsRef.current);
    });

    setActiveModal(null);
    broadcastSyncState({ activeModal: null });
    registerTimer(() => endTurn(isDouble, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
  };

  // Apply Golden Key Card
  const applyGoldenKey = () => {
    if (!goldenKeyContext) return;
    const { card, player, currentTurnSeq, rolledDouble } = goldenKeyContext;
    setActiveModal(null);

    // Apply card logic
    if (card.type === 'money_gain' && card.amount) {
      soundManager.playCashGain();
      showFloatingEffect(player.id, card.amount, true);
      setPlayers(prev => {
        const next = prev.map(p => p.id === player.id ? { ...p, money: p.money + card.amount! } : p);
        playersRef.current = next;
        return updateTotalAssets(next, cellsRef.current);
      });
      addLog(player.id, `✨ 황금열쇠 [${card.title}]: +${card.amount}만 원 획득`, 'event');
      registerTimer(() => endTurn(rolledDouble, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
    } else if (card.type === 'money_loss' && card.amount) {
      soundManager.playTollPenalty();
      showFloatingEffect(player.id, card.amount, false);
      setSocialFund(prev => prev + card.amount!);
      setPlayers(prev => {
        const next = prev.map(p => p.id === player.id ? { ...p, money: p.money - card.amount! } : p);
        playersRef.current = next;
        return updateTotalAssets(next, cellsRef.current);
      });
      addLog(player.id, `⚠️ 황금열쇠 [${card.title}]: -${card.amount}만 원 지출 (기금 적립)`, 'event');
      registerTimer(() => endTurn(rolledDouble, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
    } else if (card.type === 'free_pass') {
      soundManager.playGoldenKey();
      setPlayers(prev => {
        const next = prev.map(p => p.id === player.id ? { ...p, freePassCards: p.freePassCards + 1 } : p);
        playersRef.current = next;
        return next;
      });
      addLog(player.id, `🎟️ 황금열쇠 [${card.title}]: 상대 땅 1회 무료 통과권 획득!`, 'event');
      registerTimer(() => endTurn(rolledDouble, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
    } else if (card.type === 'escape_card') {
      soundManager.playGoldenKey();
      setPlayers(prev => {
        const next = prev.map(p => p.id === player.id ? { ...p, hasIslandEscapeCard: p.hasIslandEscapeCard + 1 } : p);
        playersRef.current = next;
        return next;
      });
      addLog(player.id, `🚢 황금열쇠 [${card.title}]: 무인도 탈출선 티켓 획득!`, 'event');
      registerTimer(() => endTurn(rolledDouble, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
    } else if (card.type === 'move_start') {
      soundManager.playCashGain();
      warpToDestination(0);
    } else if (card.type === 'move_island') {
      warpToDestination(8);
    } else if (card.type === 'move_space') {
      warpToDestination(24);
    } else {
      registerTimer(() => endTurn(rolledDouble, currentTurnSeq), speedConfig.modalActionDelayMs, currentTurnSeq);
    }

    broadcastSyncState({ activeModal: null });
  };

  // Warp to Destination (Space Travel or Golden Key teleport)
  const warpToDestination = (destPos: number) => {
    const currentSeq = turnSeqRef.current;
    const activeP = playersRef.current[activePlayerIndexRef.current];
    if (!activeP) return;

    soundManager.playDiceLand();
    addLog(activeP.id, `🚀 ${activeP.name}가 [${BOARD_SPACES[destPos].name}]으로 공간이동했습니다!`, 'event');
    triggerBroadcast({
      category: 'space_travel',
      playerId: activeP.id,
      playerName: activeP.name,
      playerColor: activeP.color,
      isAI: activeP.isAI,
      title: `🛸 [${BOARD_SPACES[destPos].name}] 워프 이동 완료!`,
      detail: `${activeP.name}님이 우주여행 워프 기술로 즉시 목적지에 도착했습니다!`,
      badge: '워프 완료',
      badgeColor: 'purple',
    });

    setPlayers(prev => {
      const next = prev.map(p => p.id === activeP.id ? { ...p, pos: destPos, spaceTravelQueued: false } : p);
      playersRef.current = next;
      return next;
    });

    registerTimer(() => {
      handleSpaceAction(activeP, BOARD_SPACES[destPos], currentSeq, false);
    }, speedConfig.modalActionDelayMs, currentSeq);
  };

  // Start Space Travel selection
  const handleStartSpaceTravel = () => {
    setActiveModal('space_travel');
    broadcastSyncState({ activeModal: 'space_travel' });
  };

  // Start Tile Remote Upgrade
  const handleConfirmStartUpgrade = (spaceId: number, newBuildings: any, cost: number) => {
    confirmPurchase(newBuildings, cost);
  };

  // Island Escape Actions
  const handleUseIslandEscapeCard = (player: Player) => {
    const currentSeq = turnSeqRef.current;
    soundManager.playGoldenKey();
    addLog(player.id, `🚢 ${player.name}가 무인도 탈출 카드를 사용하여 즉시 탈출했습니다!`, 'event');
    setPlayers(prev => {
      const next = prev.map(p => p.id === player.id ? {
        ...p,
        islandTurnsLeft: 0,
        hasIslandEscapeCard: Math.max(0, p.hasIslandEscapeCard - 1),
      } : p);
      playersRef.current = next;
      return next;
    });
    setActiveModal(null);
    broadcastSyncState({ activeModal: null });
    registerTimer(() => endTurn(false, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
  };

  const handlePayIslandBail = (player: Player) => {
    const currentSeq = turnSeqRef.current;
    const fee = 20;
    if (player.money < fee) {
      alert('보석금 20만 원이 부족합니다.');
      return;
    }
    soundManager.playCashGain();
    showFloatingEffect(player.id, fee, false);
    setSocialFund(prev => prev + fee);
    setPlayers(prev => {
      const next = prev.map(p => p.id === player.id ? {
        ...p,
        money: p.money - fee,
        islandTurnsLeft: 0,
      } : p);
      playersRef.current = next;
      return updateTotalAssets(next, cellsRef.current);
    });
    addLog(player.id, `🚤 ${player.name}가 보석금 ${fee}만 원을 납부하고 무인도를 탈출했습니다.`, 'event');
    setActiveModal(null);
    broadcastSyncState({ activeModal: null });
    registerTimer(() => endTurn(false, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
  };

  const handleTryIslandDouble = () => {
    const activeP = playersRef.current[activePlayerIndexRef.current];
    if (!activeP) return;

    setActiveModal(null);
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const currentSeq = turnSeqRef.current;

    soundManager.playDiceLand();
    setCurrentDice([d1, d2]);
    setLastDice([d1, d2]);

    if (d1 === d2) {
      soundManager.playDoubleBonus();
      addLog(activeP.id, `🎯 무인도 주사위 [${d1}, ${d2}] 더블 성공! 즉시 탈출합니다!`, 'event');
      setPlayers(prev => {
        const next = prev.map(p => p.id === activeP.id ? { ...p, islandTurnsLeft: 0 } : p);
        playersRef.current = next;
        return next;
      });
      registerTimer(() => endTurn(true, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
    } else {
      soundManager.playTollPenalty();
      const remainingTurns = Math.max(0, activeP.islandTurnsLeft - 1);
      addLog(activeP.id, `❌ 무인도 탈출 주사위 [${d1}, ${d2}] 실패! (남은 격리: ${remainingTurns}턴)`, 'event');
      setPlayers(prev => {
        const next = prev.map(p => p.id === activeP.id ? { ...p, islandTurnsLeft: remainingTurns } : p);
        playersRef.current = next;
        return next;
      });
      registerTimer(() => endTurn(false, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
    }
    broadcastSyncState({ activeModal: null });
  };

  // Debt & Loan confirmation
  const handleConfirmLoan = () => {
    if (!debtModalData) return;
    const activeP = debtModalData.payer;
    const loanAmount = 100;
    soundManager.playCashGain();
    showFloatingEffect(activeP.id, loanAmount, true);

    const updatedPayer: Player = {
      ...activeP,
      money: activeP.money + loanAmount,
      debt: (activeP.debt || 0) + loanAmount,
      hasUsedLoan: true,
    };

    setPlayers(prev => {
      const next = prev.map(p => p.id === activeP.id ? updatedPayer : p);
      playersRef.current = next;
      return updateTotalAssets(next, cellsRef.current);
    });

    addLog(activeP.id, `🏦 ${activeP.name}가 긴급 대출 ${loanAmount}만 원을 받았습니다.`, 'event');
    debtModalData.onSuccess(updatedPayer, debtModalData.recipient);
  };

  const handleConfirmSellProperties = (salePlans: PropertySalePlan[], totalRefund: number) => {
    if (!debtModalData) return;
    const activeP = debtModalData.payer;
    soundManager.playCashGain();
    showFloatingEffect(activeP.id, totalRefund, true);

    setCells(prev => {
      const next = { ...prev };
      salePlans.forEach(plan => {
        if (plan.sellLand) {
          next[plan.spaceId] = {
            owner: null,
            buildings: { hasVilla: false, hasBuilding: false, hasHotel: false, isLandmark: false },
            currentToll: 0,
          };
        } else {
          const currentCell = next[plan.spaceId];
          if (currentCell) {
            const nextBuildings = { ...currentCell.buildings };
            if (plan.soldBuildings.includes('villa')) nextBuildings.hasVilla = false;
            if (plan.soldBuildings.includes('building')) nextBuildings.hasBuilding = false;
            if (plan.soldBuildings.includes('hotel')) nextBuildings.hasHotel = false;
            if (plan.soldBuildings.includes('landmark')) nextBuildings.isLandmark = false;
            next[plan.spaceId] = {
              ...currentCell,
              buildings: nextBuildings,
              currentToll: calculateToll(BOARD_SPACES[plan.spaceId], nextBuildings),
            };
          }
        }
      });
      cellsRef.current = next;
      return next;
    });

    const updatedPayer: Player = {
      ...activeP,
      money: activeP.money + totalRefund,
    };

    setPlayers(prev => {
      const next = prev.map(p => p.id === activeP.id ? updatedPayer : p);
      playersRef.current = next;
      return updateTotalAssets(next, cellsRef.current);
    });

    addLog(activeP.id, `🏛️ ${activeP.name}가 부동산 ${salePlans.length}건을 매각하여 ${totalRefund}만 원을 확보했습니다.`, 'event');
    debtModalData.onSuccess(updatedPayer, debtModalData.recipient);
  };

  const handleVoluntaryBankruptcy = () => {
    if (!debtModalData) return;
    const bankruptP = debtModalData.payer;
    setActiveModal(null);
    setDebtModalData(null);
    checkGameOver(playersRef.current.map(p => p.id === bankruptP.id ? { ...p, money: -999 } : p));
  };

  const handleRepayDebt = () => {
    const activeP = playersRef.current[activePlayerIndexRef.current];
    if (!activeP || activeP.debt <= 0 || activeP.money < activeP.debt) return;
    const repayAmount = activeP.debt;
    soundManager.playCashGain();
    showFloatingEffect(activeP.id, repayAmount, false);

    setPlayers(prev => {
      const next = prev.map(p => p.id === activeP.id ? {
        ...p,
        money: p.money - repayAmount,
        debt: 0,
        hasUsedLoan: false,
      } : p);
      playersRef.current = next;
      return updateTotalAssets(next, cellsRef.current);
    });
    addLog(activeP.id, `💳 ${activeP.name}가 대출 빚 ${repayAmount}만 원을 전액 상환했습니다.`, 'event');
    broadcastSyncState();
  };

  // Reset Game
  const resetGame = () => {
    clearAllGameTimers();
    if (isMultiplayer && currentRoom) {
      const socket = getSocket();
      socket.emit('restart_game', { roomId: currentRoom.id, newGameState: {} });
    } else {
      handleStartGameFromSetup(gameConfig, ['플레이어 1', '플레이어 2'], ['red', 'blue']);
    }
  };

  const handleExitToLobby = () => {
    clearAllGameTimers();
    turnSeqRef.current++;
    setIsRolling(false);
    setIsTumbling(false);
    setIsTurnBusy(false);
    setActiveModal(null);
    setGameOverData(null);
    gameOverDataRef.current = null;
    setShowGameOverModal(false);
    setDebtModalData(null);

    if (isMultiplayer && currentRoom) {
      const socket = getSocket();
      socket.emit('leave_room', { roomId: currentRoom.id });
      setCurrentRoom(null);
      setIsMultiplayer(false);
    }
    setAppScreen('lobby');
  };

  // Start Game from Local Setup
  const handleStartGameFromSetup = (
    config: GameModeConfig,
    names: string[],
    airplaneColors: AirplaneColorId[]
  ) => {
    clearAllGameTimers();
    turnSeqRef.current++;
    setIsMultiplayer(false);
    setGameConfig(config);

    const newPlayers = createPlayersForMode(
      config.humanCount,
      config.aiCount,
      INITIAL_MONEY,
      names,
      airplaneColors
    );

    const initCells: Record<number, CellState> = {};
    BOARD_SPACES.forEach((s) => {
      initCells[s.id] = {
        owner: null,
        buildings: { hasVilla: false, hasBuilding: false, hasHotel: false, isLandmark: false },
        currentToll: 0,
      };
    });

    setPlayers(newPlayers);
    playersRef.current = newPlayers;
    setCells(initCells);
    cellsRef.current = initCells;
    setActivePlayerIndex(0);
    activePlayerIndexRef.current = 0;
    setTurnCount(1);
    setSocialFund(50);

    if (config.timeLimitMinutes) {
      setRemainingSeconds(config.timeLimitMinutes * 60);
    } else {
      setRemainingSeconds(null);
    }

    setGameOverData(null);
    gameOverDataRef.current = null;
    setShowGameOverModal(false);
    setActiveModal(null);
    setGameLogs([]);

    addLog(0, "✨ 새 로컬 게임이 시작되었습니다!", "event");
    setTurnBannerVisible(true);
    registerTimer(() => setTurnBannerVisible(false), SPEED_CONFIGS[config.speed || 'normal'].bannerDurationMs);
    setAppScreen('playing');
  };

  // Lobby Handlers
  const handleCreateRoom = (customCode?: string, config?: any) => {
    setIsLobbyLoading(true);
    setLobbyError(null);
    const socket = getSocket('964');

    socket.emit('create_room', {
      accessCode: '964',
      customRoomId: customCode,
      playerName: myProfile.name,
      playerColor: myProfile.color,
      config,
    }, (res: any) => {
      setIsLobbyLoading(false);
      if (res?.success) {
        setCurrentRoom(res.room);
        setMyPlayerIndex(0);
        setIsMultiplayer(true);
        setAppScreen('waiting');
      } else {
        setLobbyError(res?.error || '방 생성에 실패했습니다.');
      }
    });
  };

  const handleJoinRoom = (roomId: string) => {
    setIsLobbyLoading(true);
    setLobbyError(null);
    const socket = getSocket('964');

    socket.emit('join_room', {
      accessCode: '964',
      roomId,
      playerName: myProfile.name,
      playerColor: myProfile.color,
    }, (res: any) => {
      setIsLobbyLoading(false);
      if (res?.success) {
        setCurrentRoom(res.room);
        setMyPlayerIndex(res.myPlayerIndex);
        setIsMultiplayer(true);
        setAppScreen('waiting');
      } else {
        setLobbyError(res?.error || '방 입장에 실패했습니다. 코드를 확인해주세요.');
      }
    });
  };

  // Waiting Room Handlers
  const handleToggleReady = () => {
    if (!currentRoom) return;
    const socket = getSocket();
    socket.emit('toggle_ready', { roomId: currentRoom.id });
  };

  const handleStartMultiplayerGame = () => {
    if (!currentRoom) return;
    const socket = getSocket();
    socket.emit('start_game', {
      roomId: currentRoom.id,
      initialGameState: {},
    });
  };

  const handleLeaveWaitingRoom = () => {
    if (currentRoom) {
      const socket = getSocket();
      socket.emit('leave_room', { roomId: currentRoom.id });
    }
    setCurrentRoom(null);
    setIsMultiplayer(false);
    setAppScreen('lobby');
  };

  const handleSendWaitingChat = (text: string) => {
    if (!currentRoom) return;
    const socket = getSocket();
    socket.emit('send_chat', {
      roomId: currentRoom.id,
      text,
      senderName: myProfile.name,
      senderColor: myProfile.color,
    });
  };

  const handleSendInGameReaction = (emoji: string) => {
    if (!currentRoom) return;
    const socket = getSocket();
    socket.emit('send_reaction', {
      roomId: currentRoom.id,
      emoji,
      senderName: myProfile.name,
    });
  };

  const handleUpdateProfile = (name: string, color: AirplaneColorId) => {
    setMyProfile({ name, color });
    if (currentRoom) {
      const socket = getSocket();
      socket.emit('update_profile', { roomId: currentRoom.id, name, color });
    }
  };

  // Gate Screen authentication success
  const handleAuthenticated = (code: string) => {
    saveAccessCode(code);
    setAppScreen('lobby');
  };

  const handleLogoutCode = () => {
    clearAccessCode();
    setAppScreen('gate');
  };

  // Render Gate Screen
  if (appScreen === 'gate') {
    return <GateScreen onAuthenticated={handleAuthenticated} />;
  }

  // Render Lobby
  if (appScreen === 'lobby') {
    return (
      <MultiplayerLobby
        socketConnected={socketConnected}
        playerName={myProfile.name}
        playerColor={myProfile.color}
        onUpdateProfile={handleUpdateProfile}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onStartOfflineMode={() => setAppScreen('setup')}
        onLogoutCode={handleLogoutCode}
        isLoading={isLobbyLoading}
        errorMessage={lobbyError}
      />
    );
  }

  // Render Waiting Room
  if (appScreen === 'waiting' && currentRoom) {
    return (
      <WaitingRoom
        room={currentRoom}
        myPlayerIndex={myPlayerIndex}
        onToggleReady={handleToggleReady}
        onStartGame={handleStartMultiplayerGame}
        onLeaveRoom={handleLeaveWaitingRoom}
        onUpdateProfile={handleUpdateProfile}
        onSendMessage={handleSendWaitingChat}
      />
    );
  }

  // Render Local Setup Screen
  if (appScreen === 'setup') {
    return (
      <GameSetupScreen
        onStartGame={handleStartGameFromSetup}
      />
    );
  }

  // Active player & cell state
  const activePlayer = players[activePlayerIndex] || players[0];
  const activeSpace = BOARD_SPACES[activePlayer.pos];
  const activeCellState = cells[activePlayer.pos] || {
    owner: null,
    buildings: { hasVilla: false, hasBuilding: false, hasHotel: false, isLandmark: false },
    currentToll: 0,
  };

  const isMyTurn = !isMultiplayer || (activePlayerIndex === myPlayerIndex);
  const isRollDisabled = isTurnBusy || isRolling || isTumbling || activePlayer.isAI || activeModal !== null || showGameOverModal || !isMyTurn;

  return (
    <div className="min-h-screen w-full bg-[#08120a] text-slate-100 flex flex-col items-center justify-start lg:justify-center p-2 sm:p-3 overflow-x-hidden relative">
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(74,222,128,0.12),rgba(0,0,0,0.85))] pointer-events-none" />
      <div className="fixed -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-emerald-900/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Cash Particles */}
      <FloatingCashEffect effects={floatingEffects} />

      {/* Multiplayer Realtime HUD Overlay */}
      {isMultiplayer && currentRoom && (
        <InGameMultiplayerHUD
          roomId={currentRoom.id}
          myPlayerIndex={myPlayerIndex}
          players={players}
          activePlayerIndex={activePlayerIndex}
          opponentConnected={opponentConnected}
          messages={currentRoom.messages || []}
          onSendMessage={handleSendWaitingChat}
          onSendReaction={handleSendInGameReaction}
          activeObserverModal={activeObserverModal}
          activeObserverDetail={activeObserverDetail}
          reactions={floatingReactions}
        />
      )}

      {/* Turn Transition Banner */}
      <TurnTransitionBanner
        player={activePlayer}
        turnCount={turnCount}
        visible={turnBannerVisible}
      />

      {/* Floating Victory Modal Reopen */}
      {gameOverData && !showGameOverModal && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 animate-pulse hover:animate-none">
          <button
            type="button"
            onClick={() => setShowGameOverModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl flex items-center gap-2 border-2 border-amber-200 cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-slate-950" />
            <span>🏆 [{gameOverData.winner.name} 승리!] 결과창 다시 열기</span>
          </button>
        </div>
      )}

      {/* Main Grid: Board + Sidebar */}
      <div className="w-full max-w-[1440px] mx-auto flex flex-col lg:flex-row items-center lg:items-center justify-center gap-3 sm:gap-6 z-10">
        {/* Board View */}
        <main className="w-full flex-1 flex flex-col items-center justify-center">
          <Board
            spaces={BOARD_SPACES}
            cells={cells}
            players={players}
            activePlayerIndex={activePlayerIndex}
            onRollDice={triggerDiceRoll}
            onSpaceTravel={handleStartSpaceTravel}
            isRolling={isRolling}
            isTumbling={isTumbling}
            isDiceDisabled={isRollDisabled}
            currentDice={currentDice}
            isDouble={isDouble}
            highlightedCellId={activePlayer.pos}
            isDestinationSelectionActive={activeModal === 'space_travel'}
            selectedDestinationSpace={selectedWarpSpace}
            onConfirmDestination={(destPos) => {
              setSelectedWarpSpace(null);
              warpToDestination(destPos);
            }}
            onCancelDestination={() => {
              setSelectedWarpSpace(null);
            }}
            gameSpeed={currentSpeed}
            broadcast={boardBroadcast}
            onOpenIslandModal={() => isMyTurn && setActiveModal('island')}
            onCellClick={(id) => {
              if (activeModal === 'space_travel' && isMyTurn) {
                if (id !== 20) {
                  soundManager.playTilePass();
                  setSelectedWarpSpace(BOARD_SPACES[id]);
                }
              }
            }}
          />
        </main>

        {/* Sidebar */}
        <Sidebar
          players={players}
          activePlayerIndex={activePlayerIndex}
          gameLogs={gameLogs}
          gameConfig={gameConfig}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onExitToLobby={handleExitToLobby}
          onChangeSpeed={(spd) => setGameConfig(prev => ({ ...prev, speed: spd }))}
          socialFund={socialFund}
          currentTurnCount={turnCount}
          remainingSeconds={remainingSeconds}
          onRepayDebt={handleRepayDebt}
        />
      </div>

      {/* MODALS: Only active player interacts */}
      {isMyTurn && (
        <>
          {/* Purchase Modal */}
          {activeModal === 'purchase' && !activePlayer.isAI && (
            <PurchaseModal
              space={activeSpace}
              cellState={activeCellState}
              player={activePlayer}
              onConfirmPurchase={(buildings, cost) => confirmPurchase(buildings, cost)}
              onSkip={() => {
                const currentSeq = turnSeqRef.current;
                addLog(activePlayer.id, `▶ ${activePlayer.name}가 [${activeSpace.name}] 투자를 보류했습니다.`, 'buy');
                triggerBroadcast({
                  category: 'pass',
                  playerId: activePlayer.id,
                  playerName: activePlayer.name,
                  playerColor: activePlayer.color,
                  isAI: activePlayer.isAI,
                  title: `⏭️ [${activeSpace.name}] 투자 보류 (패스)`,
                  detail: `${activePlayer.name}님이 이번 턴 투자를 건너뛰었습니다.`,
                  badge: '투자 보류',
                  badgeColor: 'slate',
                });
                setActiveModal(null);
                broadcastSyncState({ activeModal: null });
                registerTimer(() => endTurn(isDouble, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
              }}
            />
          )}

          {/* Toll Modal */}
          {activeModal === 'toll' && currentTollData && !activePlayer.isAI && (
            <TollModal
              space={currentTollData.space}
              cellState={cells[currentTollData.space.id] || { owner: null, buildings: { hasVilla: false, hasBuilding: false, hasHotel: false, isLandmark: false }, currentToll: 0 }}
              payer={{ ...currentTollData.payer, pos: currentTollData.space.id }}
              owner={currentTollData.owner}
              onPayToll={() => executePayToll(currentTollData.space, currentTollData.owner, { ...currentTollData.payer, pos: currentTollData.space.id }, (cells[currentTollData.space.id] || { currentToll: 0 }).currentToll)}
              onTakeover={(takeoverCost) => executeTakeover(currentTollData.space, currentTollData.owner, { ...currentTollData.payer, pos: currentTollData.space.id }, (cells[currentTollData.space.id] || { currentToll: 0 }).currentToll, takeoverCost)}
              onUseFreePass={() => handleUseFreePass(currentTollData.space, currentTollData.owner, currentTollData.payer)}
            />
          )}

          {/* Emergency Debt Modal */}
          {activeModal === 'debt' && debtModalData && (
            <EmergencyDebtModal
              payer={debtModalData.payer}
              debtAmount={debtModalData.debtAmount}
              totalRequiredAmount={debtModalData.totalRequiredAmount}
              recipient={debtModalData.recipient}
              reasonText={debtModalData.reasonText}
              spaces={BOARD_SPACES}
              cells={cells}
              onTakeLoan={handleConfirmLoan}
              onSellProperties={handleConfirmSellProperties}
              onBankrupt={handleVoluntaryBankruptcy}
            />
          )}

          {/* Golden Key Modal */}
          {activeModal === 'golden_key' && currentGoldenKey && (
            <GoldenKeyModal
              card={currentGoldenKey}
              onConfirm={() => applyGoldenKey()}
            />
          )}

          {/* Start Tile Remote Upgrade Modal */}
          {activeModal === 'start_upgrade' && !activePlayer.isAI && (
            <StartUpgradeModal
              spaces={BOARD_SPACES}
              cells={cells}
              player={activePlayer}
              onConfirmUpgrade={(spaceId, newBuildings, cost) => handleConfirmStartUpgrade(spaceId, newBuildings, cost)}
              onSkip={() => {
                const currentSeq = turnSeqRef.current;
                addLog(activePlayer.id, `🏁 ${activePlayer.name}가 출발점 원격 증축 기회를 건너뛰었습니다.`, 'event');
                setActiveModal(null);
                broadcastSyncState({ activeModal: null });
                registerTimer(() => endTurn(isDouble, currentSeq), speedConfig.modalActionDelayMs, currentSeq);
              }}
            />
          )}

          {/* Island Modal */}
          {activeModal === 'island' && !activePlayer.isAI && activePlayer.islandTurnsLeft > 0 && (
            <IslandModal
              player={activePlayer}
              onUseEscapeCard={() => handleUseIslandEscapeCard(activePlayer)}
              onPayEscapeFee={() => handlePayIslandBail(activePlayer)}
              onTryDouble={handleTryIslandDouble}
              onClose={() => {
                setActiveModal(null);
                broadcastSyncState({ activeModal: null });
              }}
            />
          )}
        </>
      )}

      {/* Game Over Modal (Visible to all) */}
      {showGameOverModal && gameOverData && (
        <GameOverModal
          winner={gameOverData.winner}
          rankings={gameOverData.rankings}
          reason={gameOverData.reason}
          onRestart={resetGame}
          onExitToLobby={handleExitToLobby}
          onClose={() => {
            setShowGameOverModal(false);
            setActiveModal(null);
            setIsTurnBusy(false);
            setIsRolling(false);
            setIsTumbling(false);
          }}
        />
      )}
    </div>
  );
}
