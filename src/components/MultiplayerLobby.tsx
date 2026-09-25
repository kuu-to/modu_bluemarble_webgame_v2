import React, { useState } from 'react';
import { 
  Users, 
  PlusCircle, 
  LogIn, 
  Settings2, 
  Zap, 
  Clock, 
  Coins, 
  Check, 
  ArrowRight, 
  LogOut,
  Sparkles,
  Gamepad2,
  RefreshCw,
  X
} from 'lucide-react';
import { AirplaneColorId, AIRPLANE_CONFIGS } from '../utils/airplaneConfig';
import { AirplanePiece } from './AirplanePiece';
import { soundManager } from '../utils/audio';
import { SavedGameSession } from '../utils/socket';

interface MultiplayerLobbyProps {
  socketConnected: boolean;
  playerName: string;
  playerColor: AirplaneColorId;
  savedSession?: SavedGameSession | null;
  onReconnectSession?: (session: SavedGameSession) => void;
  onClearSavedSession?: () => void;
  onUpdateProfile: (name: string, color: AirplaneColorId) => void;
  onCreateRoom: (customCode?: string, config?: { speed: 'normal' | 'fast' | 'turbo'; timeLimitMinutes: number; initialMoney: number }) => void;
  onJoinRoom: (roomId: string) => void;
  onStartOfflineMode: () => void;
  onLogoutCode: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  socketConnected,
  playerName,
  playerColor,
  savedSession,
  onReconnectSession,
  onClearSavedSession,
  onUpdateProfile,
  onCreateRoom,
  onJoinRoom,
  onStartOfflineMode,
  onLogoutCode,
  isLoading,
  errorMessage
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [inputRoomCode, setInputRoomCode] = useState<string>(savedSession?.roomId || '');
  const [customRoomCode, setCustomRoomCode] = useState<string>('');
  const [gameSpeed, setGameSpeed] = useState<'normal' | 'fast' | 'turbo'>('normal');
  const [timeLimit, setTimeLimit] = useState<number>(60);
  const [nameInput, setNameInput] = useState<string>(playerName);

  const colors: AirplaneColorId[] = ['red', 'blue', 'yellow', 'white'];

  const handleNameBlur = () => {
    const trimmed = nameInput.trim() || '플레이어 1';
    setNameInput(trimmed);
    onUpdateProfile(trimmed, playerColor);
  };

  const handleColorSelect = (c: AirplaneColorId) => {
    soundManager.playTilePass();
    onUpdateProfile(nameInput.trim() || '플레이어 1', c);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playDiceRoll(200);
    onCreateRoom(customRoomCode.trim() || undefined, {
      speed: gameSpeed,
      timeLimitMinutes: timeLimit,
      initialMoney: 300
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRoomCode.trim()) return;
    soundManager.playDiceRoll(200);
    onJoinRoom(inputRoomCode.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen w-full bg-[#08120a] text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 relative select-none">
      {/* Tabletop Ambient Glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(74,222,128,0.12),rgba(0,0,0,0.85))] pointer-events-none" />
      <div className="fixed -top-20 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar Header */}
      <header className="relative z-10 w-full max-w-4xl flex items-center justify-between py-3 mb-4 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-[0_0_15px_rgba(245,158,11,0.4)] flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-200">
              모두의 부루마블 멀티플레이어
            </h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span>{socketConnected ? '실시간 소켓 서버 연결 완료' : '소켓 서버 연결 중...'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-[11px] text-emerald-300 font-semibold">
            인증 코드: 964 (인증됨)
          </span>
          <button
            type="button"
            onClick={onLogoutCode}
            title="코드 재입력"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-rose-300 border border-slate-700/60 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">코드 변경</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Profile & Room Actions */}
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Column: Player Profile (5 cols) */}
        <div className="md:col-span-5 bg-slate-900/80 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col items-center">
          <h2 className="text-sm font-bold text-slate-300 self-start flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>내 플레이어 설정</span>
          </h2>

          {/* 3D Airplane Preview */}
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl bg-gradient-to-b from-slate-800/60 to-slate-950/90 border border-slate-700/50 flex flex-col items-center justify-center relative shadow-inner mb-4">
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-800/80 text-[10px] text-amber-400 font-bold border border-slate-700">
              {AIRPLANE_CONFIGS[playerColor]?.koreanName}
            </div>
            <AirplanePiece colorId={playerColor} size="xl" animate={true} />
          </div>

          {/* Nickname Input */}
          <div className="w-full mb-4">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              닉네임
            </label>
            <input
              type="text"
              maxLength={10}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameBlur}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-amber-400 text-slate-100 text-sm font-bold outline-none transition-all"
              placeholder="플레이어 이름"
            />
          </div>

          {/* Color Selector */}
          <div className="w-full">
            <label className="block text-[11px] font-semibold text-slate-400 mb-2">
              비행기 색상 선택
            </label>
            <div className="grid grid-cols-4 gap-2">
              {colors.map((c) => {
                const isSelected = playerColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorSelect(c)}
                    className={`h-12 rounded-xl flex items-center justify-center transition-all border cursor-pointer relative ${
                      isSelected
                        ? 'border-amber-400 bg-slate-800 shadow-[0_0_15px_rgba(251,191,36,0.3)] scale-105'
                        : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/50'
                    }`}
                  >
                    <AirplanePiece colorId={c} size="sm" />
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Offline mode option button */}
          <div className="w-full mt-auto pt-6 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onStartOfflineMode}
              className="w-full py-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/40 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🖥️ 1기기 로컬 플레이 (오프라인 모드)</span>
            </button>
          </div>
        </div>

        {/* Right Column: Room Actions (7 cols) */}
        <div className="md:col-span-7 bg-slate-900/80 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col">
          {/* Active Game Reconnect Banner */}
          {savedSession && savedSession.roomId && (
            <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-emerald-950/60 to-slate-900 border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex flex-col sm:flex-row items-center justify-between gap-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black tracking-wider uppercase">
                      진행 중 게임 발견
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-300">
                      방 코드: {savedSession.roomId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    <strong className="text-amber-300">[{savedSession.playerName}]</strong> 님의 게임 세션이 유지되고 있습니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {onReconnectSession && (
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playDiceRoll(200);
                      onReconnectSession(savedSession);
                    }}
                    disabled={isLoading}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-black text-xs shadow-md transition-all hover:scale-105 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isLoading ? '재접속 중...' : '지금 즉시 재접속'}</span>
                  </button>
                )}
                {onClearSavedSession && (
                  <button
                    type="button"
                    onClick={onClearSavedSession}
                    title="세션 종료"
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 border border-slate-700/60 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 mb-5">
            <button
              type="button"
              onClick={() => {
                soundManager.playTilePass();
                setActiveTab('create');
              }}
              className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>방 만들기 (HOST)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playTilePass();
                setActiveTab('join');
              }}
              className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'join'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>방 참가하기 (JOIN)</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 mb-4 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-shake">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'create' ? (
            /* CREATE ROOM FORM */
            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    커스텀 방 코드 (선택사항, 비워두면 자동 생성)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={customRoomCode}
                    onChange={(e) => setCustomRoomCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-amber-400 text-amber-300 font-mono text-sm uppercase tracking-wider outline-none transition-all"
                    placeholder="예: BLUE964, 7777 (자동 생성)"
                  />
                </div>

                {/* Match Options */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span>초기 시작 자금</span>
                    </span>
                    <span className="text-xs font-bold text-amber-400">300만 원 (고정)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>게임 속도</span>
                    </span>
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      {(['normal', 'fast', 'turbo'] as const).map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setGameSpeed(spd)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                            gameSpeed === spd
                              ? 'bg-emerald-500 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {spd === 'normal' ? '보통' : spd === 'fast' ? '빠름' : '초고속'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>제한 시간</span>
                    </span>
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      {[30, 60, 0].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setTimeLimit(mins)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                            timeLimit === mins
                              ? 'bg-blue-500 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {mins === 0 ? '무제한' : `${mins}분`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/30 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    방을 생성한 후 친구에게 초대 코드나 링크를 보내면, 친구가 방에 입장하여 1:1 대전을 시작할 수 있습니다.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all hover:scale-[1.02] cursor-pointer"
              >
                <span>{isLoading ? '방 생성 중...' : '방 생성하고 대기실로 이동'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* JOIN ROOM FORM */
            <form onSubmit={handleJoinSubmit} className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    친구에게 받은 방 코드 (4자리 또는 커스텀 코드)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={inputRoomCode}
                    onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border-2 border-slate-700 focus:border-emerald-400 text-emerald-300 font-mono text-lg uppercase tracking-widest outline-none transition-all"
                    placeholder="예: 4A8B"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs text-slate-400 leading-relaxed">
                  <p className="font-semibold text-slate-300">💡 참여 방법</p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px]">
                    <li>방을 만든 친구에게 4자리 방 코드를 전달받습니다.</li>
                    <li>위 입력란에 방 코드를 입력하고 [방 입장하기] 버튼을 누릅니다.</li>
                    <li>대기실에서 준비 완료를 누르면 방장이 게임을 시작합니다!</li>
                  </ol>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !inputRoomCode.trim()}
                className={`w-full mt-6 py-3.5 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                  inputRoomCode.trim()
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:scale-[1.02]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <span>{isLoading ? '방 찾는 중...' : '방 입장하기'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
