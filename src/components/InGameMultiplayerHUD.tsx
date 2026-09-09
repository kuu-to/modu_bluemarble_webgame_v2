import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Smile, 
  X, 
  Wifi, 
  WifiOff, 
  Crown, 
  Volume2, 
  VolumeX,
  Share2,
  Check
} from 'lucide-react';
import { soundManager } from '../utils/audio';

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
}

interface InGameMultiplayerHUDProps {
  roomId: string;
  myPlayerIndex: number;
  players: Array<{ name: string; color: string; isHost?: boolean }>;
  activePlayerIndex: number;
  opponentConnected: boolean;
  messages: Array<{ id: string; senderName: string; text: string; timestamp: number }>;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  activeObserverModal: string | null;
  activeObserverDetail?: string;
  reactions: FloatingReaction[];
}

export const InGameMultiplayerHUD: React.FC<InGameMultiplayerHUDProps> = ({
  roomId,
  myPlayerIndex,
  players,
  activePlayerIndex,
  opponentConnected,
  messages,
  onSendMessage,
  onSendReaction,
  activeObserverModal,
  activeObserverDetail,
  reactions,
}) => {
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [reactionsOpen, setReactionsOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isMyTurn = activePlayerIndex === myPlayerIndex;
  const me = players[myPlayerIndex] || players[0];
  const opponent = players[myPlayerIndex === 0 ? 1 : 0] || players[1];

  useEffect(() => {
    if (chatOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleEmojiClick = (emoji: string) => {
    onSendReaction(emoji);
    soundManager.playTilePass();
    setReactionsOpen(false);
  };

  const handleCopyCode = () => {
    soundManager.playTilePass();
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const emojiList = ['🎲', '💸', '😱', '👑', '🚀', '😭', '👏', '🔥', '😇', '🍀'];

  return (
    <>
      {/* Top Floating Match Header Pill */}
      <div className="fixed top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-slate-950/90 backdrop-blur-md px-3 sm:px-4 py-1.5 rounded-full border border-slate-800 shadow-2xl">
        {/* Room Code */}
        <button
          type="button"
          onClick={handleCopyCode}
          title="방 코드 복사"
          className="flex items-center gap-1 text-[11px] font-mono text-amber-300 font-bold hover:text-amber-200 transition-colors cursor-pointer"
        >
          <span>방: {roomId}</span>
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3 text-slate-400" />}
        </button>

        <span className="text-slate-700">|</span>

        {/* Turn Status */}
        <div className={`text-xs font-black flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${
          isMyTurn
            ? 'bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.4)] animate-pulse'
            : 'bg-slate-800 text-slate-300'
        }`}>
          <span>{isMyTurn ? '🎯 내 차례입니다!' : `⏳ [${opponent?.name || '상대방'}] 차례`}</span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Opponent connection status */}
        <div className="flex items-center gap-1 text-[11px]">
          {opponentConnected ? (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">상대 접속중</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-400 font-semibold animate-pulse">
              <WifiOff className="w-3 h-3" />
              <span>상대 재접속 대기</span>
            </span>
          )}
        </div>
      </div>

      {/* Live Observer Status for Opponent Turn when opponent is in a modal */}
      {!isMyTurn && activeObserverModal && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 max-w-sm w-[90%] bg-slate-900/95 backdrop-blur-md border border-amber-400/60 rounded-2xl p-2.5 sm:p-3 shadow-2xl animate-fade-in text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-amber-300 font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>상대방이 결정을 진행 중입니다</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            {activeObserverDetail || `[${opponent?.name}] 님이 모달 창에서 선택하고 있습니다...`}
          </p>
        </div>
      )}

      {/* Floating Action Buttons on bottom right */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
        {/* Quick Reactions Toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setReactionsOpen(!reactionsOpen)}
            className="w-11 h-11 rounded-full bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-slate-700 shadow-xl flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
            title="감정표현 이모지"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Reactions Menu Popup */}
          {reactionsOpen && (
            <div className="absolute bottom-14 right-0 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-2.5 shadow-2xl grid grid-cols-5 gap-1.5 w-60 z-50">
              {emojiList.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => handleEmojiClick(em)}
                  className="w-10 h-10 rounded-xl hover:bg-slate-800 flex items-center justify-center text-xl hover:scale-125 transition-transform cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat Toggle Button */}
        <button
          type="button"
          onClick={() => setChatOpen(!chatOpen)}
          className={`w-11 h-11 rounded-full border shadow-xl flex items-center justify-center transition-all hover:scale-110 cursor-pointer ${
            chatOpen
              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.4)]'
              : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
          }`}
          title="채팅창 열기"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {/* Expandable Chat Drawer */}
      {chatOpen && (
        <div className="fixed bottom-18 right-4 z-40 w-80 sm:w-96 max-h-[420px] bg-slate-950/95 backdrop-blur-xl border border-emerald-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-900/80">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-200">실시간 매치 채팅</span>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 h-64 text-xs">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-[11px]">
                채팅 메시지가 없습니다. 대화를 시작해보세요!
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.senderName === me.name;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] text-slate-500 mb-0.5">
                      {isMine ? '나' : m.senderName}
                    </span>
                    <div
                      className={`max-w-[80%] px-3 py-1.5 rounded-2xl leading-snug break-words ${
                        isMine
                          ? 'bg-emerald-600 text-slate-950 font-medium rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Chat Buttons */}
          <div className="px-3 py-1.5 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            {['나이스!', '주사위 사기네 ㅋㅋ', '통행료 아깝다', '다음 턴 기대해라', 'GG'].map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => onSendMessage(phrase)}
                className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 whitespace-nowrap cursor-pointer transition-colors"
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-2.5 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              maxLength={60}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="메시지 입력..."
              className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-400 text-xs text-slate-100 outline-none"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Emoji Reactions Layer */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((rx) => (
          <div
            key={rx.id}
            className="absolute left-1/2 -translate-x-1/2 bottom-24 flex flex-col items-center animate-float-reaction"
          >
            <span className="text-6xl drop-shadow-2xl">{rx.emoji}</span>
            <span className="text-[11px] font-bold text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded-md mt-1 shadow-md border border-amber-400/30">
              {rx.senderName}
            </span>
          </div>
        ))}
      </div>
    </>
  );
};
