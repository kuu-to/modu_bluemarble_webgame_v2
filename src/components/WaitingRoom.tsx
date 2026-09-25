import React, { useState, useRef, useEffect } from 'react';
import { 
  Crown, 
  Copy, 
  Check, 
  Share2, 
  LogOut, 
  Send, 
  Sparkles, 
  Zap, 
  Clock, 
  Coins, 
  MessageSquare,
  Play
} from 'lucide-react';
import { AirplaneColorId, AIRPLANE_CONFIGS } from '../utils/airplaneConfig';
import { AirplanePiece } from './AirplanePiece';
import { soundManager } from '../utils/audio';

export interface WaitingRoomPlayer {
  token?: string;
  socketId: string;
  name: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
  playerIndex: 0 | 1;
  connected: boolean;
}

export interface WaitingRoomData {
  id: string;
  createdAt: number;
  status: 'waiting' | 'in_game' | 'game_over';
  players: WaitingRoomPlayer[];
  config: {
    speed: 'normal' | 'fast' | 'turbo';
    timeLimitMinutes: number;
    initialMoney: number;
  };
  messages: Array<{
    id: string;
    senderName: string;
    senderColor: string;
    text: string;
    timestamp: number;
  }>;
}

interface WaitingRoomProps {
  room: WaitingRoomData;
  myPlayerIndex: number;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onUpdateProfile: (name: string, color: AirplaneColorId) => void;
  onSendMessage: (text: string) => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  room,
  myPlayerIndex,
  onToggleReady,
  onStartGame,
  onLeaveRoom,
  onUpdateProfile,
  onSendMessage
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const me = room.players.find(p => p.playerIndex === myPlayerIndex) || room.players[myPlayerIndex] || room.players[0];
  const opponent = room.players.find(p => p.playerIndex !== myPlayerIndex);
  const isHost = me?.isHost;

  const colors: AirplaneColorId[] = ['red', 'blue', 'yellow', 'white'];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room.messages]);

  const handleCopyCode = () => {
    soundManager.playTilePass();
    const textToCopy = room.id;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    soundManager.playTilePass();
    const url = `${window.location.origin}${window.location.pathname}?room=${room.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleQuickChat = (phrase: string) => {
    onSendMessage(phrase);
  };

  const handleSelectColor = (c: AirplaneColorId) => {
    soundManager.playTilePass();
    onUpdateProfile(me.name, c);
  };

  const canStart = isHost && room.players.length === 2 && (opponent?.isReady || true);

  return (
    <div className="min-h-screen w-full bg-[#08120a] text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 relative select-none">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(74,222,128,0.12),rgba(0,0,0,0.85))] pointer-events-none" />
      <div className="fixed -top-20 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Waiting Room Card Container */}
      <div className="relative z-10 w-full max-w-4xl bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-4 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-5">
        {/* Top Header: Room ID & Copy Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border-2 border-amber-400/80 text-amber-300 font-mono text-base sm:text-lg font-black tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
              <span>방 코드:</span>
              <span className="text-white text-xl">{room.id}</span>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="방 코드 복사"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '복사됨!' : '코드 복사'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="초대 링크 복사"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">초대 링크</span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Match config info pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <Zap className="w-3 h-3" />
                {room.config.speed === 'normal' ? '보통 속도' : room.config.speed === 'fast' ? '빠른 속도' : '초고속'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-400">
                <Clock className="w-3 h-3" />
                {room.config.timeLimitMinutes === 0 ? '무제한' : `${room.config.timeLimitMinutes}분`}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-400">
                <Coins className="w-3 h-3" />
                300만 원
              </span>
            </div>

            <button
              type="button"
              onClick={onLeaveRoom}
              className="p-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="대기실 나가기"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">나가기</span>
            </button>
          </div>
        </div>

        {/* 2-Player Match Slots */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Player 1 Slot (Host) */}
          {room.players[0] ? (
            <div className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col justify-between relative bg-slate-950/80 ${
              me.playerIndex === 0
                ? 'border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                : 'border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>방장 (플레이어 1)</span>
                </span>
                {me.playerIndex === 0 && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                    나 (ME)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 my-2">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700/60 flex items-center justify-center relative shadow-inner">
                  <AirplanePiece colorId={room.players[0].color} size="lg" animate={true} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                    <span>{room.players[0].name}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {AIRPLANE_CONFIGS[room.players[0].color as AirplaneColorId]?.koreanName || '비행기'}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
                    <Check className="w-3 h-3" />
                    <span>준비 완료</span>
                  </div>
                </div>
              </div>

              {/* Color picker for Player 0 if it's me */}
              {me.playerIndex === 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">내 비행기 색상 변경:</div>
                  <div className="flex items-center gap-2">
                    {colors.map(c => {
                      const isTaken = opponent?.color === c;
                      const isSelected = me.color === c;
                      return (
                        <button
                          key={c}
                          disabled={isTaken}
                          onClick={() => handleSelectColor(c)}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-amber-400 bg-slate-800 scale-105 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                              : isTaken
                              ? 'border-slate-800 bg-slate-950 opacity-30 cursor-not-allowed'
                              : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800'
                          }`}
                        >
                          <AirplanePiece colorId={c} size="xs" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Player 2 Slot (Guest) */}
          {room.players[1] ? (
            <div className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col justify-between relative bg-slate-950/80 ${
              me.playerIndex === 1
                ? 'border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : 'border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[11px] font-black">
                  게스트 (플레이어 2)
                </span>
                {me.playerIndex === 1 && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                    나 (ME)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 my-2">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700/60 flex items-center justify-center relative shadow-inner">
                  <AirplanePiece colorId={room.players[1].color} size="lg" animate={true} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                    <span>{room.players[1].name}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {AIRPLANE_CONFIGS[room.players[1].color as AirplaneColorId]?.koreanName || '비행기'}
                  </p>
                  <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                    room.players[1].isReady
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-950/80 text-amber-300 border-amber-500/30 animate-pulse'
                  }`}>
                    {room.players[1].isReady ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    <span>{room.players[1].isReady ? '준비 완료 (READY)' : '준비 중...'}</span>
                  </div>
                </div>
              </div>

              {/* Color picker for Player 1 if it's me */}
              {me.playerIndex === 1 && (
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">내 비행기 색상 변경:</div>
                  <div className="flex items-center gap-2">
                    {colors.map(c => {
                      const isTaken = room.players[0]?.color === c;
                      const isSelected = me.color === c;
                      return (
                        <button
                          key={c}
                          disabled={isTaken}
                          onClick={() => handleSelectColor(c)}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-emerald-400 bg-slate-800 scale-105 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                              : isTaken
                              ? 'border-slate-800 bg-slate-950 opacity-30 cursor-not-allowed'
                              : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800'
                          }`}
                        >
                          <AirplanePiece colorId={c} size="xs" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Empty Slot: Waiting for Friend */
            <div className="p-6 rounded-2xl border-2 border-dashed border-slate-700/80 bg-slate-950/40 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-500 mb-3 animate-pulse">
                <Clock className="w-8 h-8 text-amber-400/60" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">친구 입장 대기 중...</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                방 코드 <span className="font-mono text-amber-300 font-bold">{room.id}</span> 또는 초대 링크를 친구에게 보내주세요!
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all hover:scale-105"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>초대 링크 복사</span>
              </button>
            </div>
          )}
        </div>

        {/* Real-time In-Room Chat Area */}
        <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 sm:p-4 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs font-bold text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>대기실 채팅</span>
            </span>
            <span className="text-[11px] text-slate-500">실시간 대화</span>
          </div>

          {/* Messages display */}
          <div className="h-32 sm:h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
            {room.messages.map((m) => (
              <div key={m.id} className="leading-snug">
                <span className={`font-bold mr-1.5 ${
                  m.senderName === '시스템'
                    ? 'text-amber-400'
                    : m.senderName === me.name
                    ? 'text-emerald-300'
                    : 'text-blue-300'
                }`}>
                  [{m.senderName}]
                </span>
                <span className="text-slate-200">{m.text}</span>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Chat Chips */}
          <div className="flex items-center gap-1.5 py-2 overflow-x-auto text-[11px]">
            {['준비 완료! 🎲', '가보자고! 🔥', '살살하자 ㅎㅎ 😇', '행운을 빌어! 🍀', '내가 이긴다 👑'].map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => handleQuickChat(phrase)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 whitespace-nowrap cursor-pointer transition-colors"
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Chat input form */}
          <form onSubmit={handleSendChat} className="flex items-center gap-2 mt-1">
            <input
              type="text"
              maxLength={60}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="대기실 메시지 입력..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-400 text-xs text-slate-100 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold transition-all cursor-pointer"
            >
              <Send className="w-4 h-4 text-slate-950" />
            </button>
          </form>
        </div>

        {/* Bottom Action Bar: Ready or Start Game */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            {isHost ? (
              <span>
                {room.players.length < 2
                  ? '⏳ 친구가 입장하면 게임을 시작할 수 있습니다.'
                  : !opponent?.isReady
                  ? '⏳ 친구(게스트)가 준비를 완료하면 시작하세요.'
                  : '✨ 모든 참가자 준비 완료! 이제 게임을 시작하세요.'}
              </span>
            ) : (
              <span>
                {me.isReady
                  ? '✅ 준비 완료되었습니다! 방장이 게임을 시작할 때까지 잠시 대기하세요.'
                  : '👉 [준비 완료] 버튼을 누르면 방장이 게임을 시작합니다.'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* If Guest: Toggle Ready */}
            {!isHost && (
              <button
                type="button"
                onClick={onToggleReady}
                className={`w-full sm:w-48 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  me.isReady
                    ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{me.isReady ? '준비 취소' : '준비 완료 (READY)'}</span>
              </button>
            )}

            {/* If Host: Start Game button */}
            {isHost && (
              <button
                type="button"
                disabled={!canStart}
                onClick={onStartGame}
                className={`w-full sm:w-56 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  canStart
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.6)] animate-pulse hover:scale-105'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>게임 시작 (START GAME)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
