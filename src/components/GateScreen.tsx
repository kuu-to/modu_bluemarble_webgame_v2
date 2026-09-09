import React, { useState, useRef, useEffect } from 'react';
import { Lock, ShieldCheck, Dice5, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface GateScreenProps {
  onAuthenticated: (code: string) => void;
}

export const GateScreen: React.FC<GateScreenProps> = ({ onAuthenticated }) => {
  const [digits, setDigits] = useState<string[]>(['', '', '']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    // Focus first input on mount
    inputRefs[0].current?.focus();
  }, []);

  const triggerVerification = (codeToVerify: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    // Prompt specifies: "코드는 964야"
    if (codeToVerify === '964') {
      soundManager.playVictory();
      setTimeout(() => {
        onAuthenticated('964');
      }, 400);
    } else {
      soundManager.playTollPenalty();
      setShake(true);
      setErrorMsg('인증 코드가 일치하지 않습니다. 올바른 3자리 코드를 입력해주세요.');
      setIsSubmitting(false);
      setTimeout(() => setShake(false), 600);
      setDigits(['', '', '']);
      inputRefs[0].current?.focus();
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    const char = val.slice(-1);
    if (!/^\d*$/.test(char)) return;

    const nextDigits = [...digits];
    nextDigits[index] = char;
    setDigits(nextDigits);
    setErrorMsg(null);

    if (char && index < 2) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto verify when 3rd digit entered
    if (char && index === 2 && nextDigits[0] && nextDigits[1]) {
      const fullCode = `${nextDigits[0]}${nextDigits[1]}${char}`;
      triggerVerification(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'Enter') {
      const fullCode = digits.join('');
      if (fullCode.length === 3) {
        triggerVerification(fullCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{3}$/.test(pasted)) {
      const arr = pasted.split('');
      setDigits(arr);
      triggerVerification(pasted);
    }
  };

  const handleKeypadPress = (num: string) => {
    soundManager.playTilePass();
    const nextDigits = [...digits];
    const emptyIndex = nextDigits.findIndex(d => d === '');
    if (emptyIndex !== -1) {
      nextDigits[emptyIndex] = num;
      setDigits(nextDigits);
      if (emptyIndex === 2 && nextDigits[0] && nextDigits[1]) {
        triggerVerification(`${nextDigits[0]}${nextDigits[1]}${num}`);
      } else if (emptyIndex < 2) {
        inputRefs[emptyIndex + 1].current?.focus();
      }
    }
  };

  const handleKeypadBackspace = () => {
    soundManager.playTilePass();
    const nextDigits = [...digits];
    for (let i = 2; i >= 0; i--) {
      if (nextDigits[i] !== '') {
        nextDigits[i] = '';
        setDigits(nextDigits);
        inputRefs[i].current?.focus();
        break;
      }
    }
  };

  const handleKeypadClear = () => {
    setDigits(['', '', '']);
    inputRefs[0].current?.focus();
  };

  return (
    <div className="min-h-screen w-full bg-[#08120a] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(74,222,128,0.12),rgba(0,0,0,0.85))] pointer-events-none" />
      <div className="fixed -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div
        className={`relative z-10 w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center transition-transform duration-300 ${
          shake ? 'animate-bounce border-rose-500/80 shadow-[0_0_30px_rgba(244,63,94,0.4)]' : ''
        }`}
      >
        {/* Top Game Badge & Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-400 p-0.5 shadow-[0_0_25px_rgba(16,185,129,0.5)] mb-4 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Dice5 className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-200 tracking-tight text-center">
          모두의 부루마블
        </h1>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-400 font-semibold tracking-wider uppercase bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>비공개 2인 실시간 멀티플레이어</span>
        </div>

        <p className="text-slate-400 text-xs sm:text-sm text-center mt-3 leading-relaxed">
          친구와 둘만의 대전을 위해 보안 인증 코드를 입력하세요.
          <br />
          <span className="text-slate-500 text-[11px]">(올바른 코드를 입력해야 접속할 수 있습니다)</span>
        </p>

        {/* 3-Digit PIN Input Boxes */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 my-6">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={inputRefs[idx]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={idx === 0 ? handlePaste : undefined}
              className={`w-14 h-16 sm:w-16 sm:h-20 text-center text-3xl font-black rounded-2xl border-2 transition-all outline-none bg-slate-950/80 ${
                digit
                  ? 'border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                  : 'border-slate-700 text-slate-100 focus:border-emerald-400 focus:shadow-[0_0_15px_rgba(52,211,153,0.3)]'
              }`}
            />
          ))}
        </div>

        {/* Error Feedback */}
        {errorMsg && (
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold bg-rose-950/50 border border-rose-800/40 rounded-xl px-3 py-2 mb-4 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Enter Button */}
        <button
          type="button"
          disabled={isSubmitting || digits.join('').length !== 3}
          onClick={() => triggerVerification(digits.join(''))}
          className={`w-full py-3.5 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
            digits.join('').length === 3
              ? 'bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:scale-[1.02]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>{isSubmitting ? '인증 확인 중...' : '인증하고 접속하기'}</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>

        {/* Numeric On-Screen Keypad for quick mobile & desktop touch */}
        <div className="w-full max-w-[280px] grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-slate-800/80">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeypadPress(num)}
              className="h-11 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 font-bold text-base transition-colors active:scale-95 border border-slate-700/40 cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleKeypadClear}
            className="h-11 rounded-xl bg-slate-800/40 hover:bg-slate-700/50 text-slate-400 text-xs font-semibold transition-colors active:scale-95 border border-slate-700/30 cursor-pointer"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress('0')}
            className="h-11 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 font-bold text-base transition-colors active:scale-95 border border-slate-700/40 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleKeypadBackspace}
            className="h-11 rounded-xl bg-slate-800/40 hover:bg-slate-700/50 text-slate-400 text-xs font-semibold transition-colors active:scale-95 border border-slate-700/30 cursor-pointer"
          >
            지우기
          </button>
        </div>

        {/* Bottom hint */}
        <div className="mt-5 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400/70" />
          <span>보안된 2인 프라이빗 소켓 방으로 안전하게 연결됩니다.</span>
        </div>
      </div>
    </div>
  );
};
