import React, { useState, useEffect } from 'react';
import { Delete, RotateCcw, Check, Hash } from 'lucide-react';
import { playBeadSound, triggerHaptic } from '../lib/feedback';

type Op = '+' | '-' | '×' | '÷' | null;

interface CalculatorUIProps {
  onCompute: (a: number, op: Op, b: number) => void;
  onReset: () => void;
  displayValue: number;
  error: string | null;
  remainder: number | null;
}

const OP_BUTTONS: { label: string; op: Op }[] = [
  { label: '+', op: '+' },
  { label: '−', op: '-' },
  { label: '×', op: '×' },
  { label: '÷', op: '÷' },
];

const BTN_BASE =
  'py-4 cursor-pointer rounded-2xl font-mono font-bold ' +
  'transition-all duration-100 select-none active:scale-90 flex items-center justify-center';

const KEY_TO_OP: Record<string, Op> = {
  '+': '+',
  '-': '-',
  '*': '×',
  'x': '×',
  '/': '÷',
};

export const CalculatorUI: React.FC<CalculatorUIProps> = ({
  onCompute,
  onReset,
  displayValue,
  error,
  remainder,
}) => {
  const [input, setInput] = useState('');
  const [pendingOp, setPendingOp] = useState<Op>(null);
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [waitingForSecond, setWaitingForSecond] = useState(false);

  const currentDisplay = () =>
    waitingForSecond
      ? input === '' ? '0' : input
      : input === '' ? String(displayValue) : input;

  const handleDigit = (d: string) => {
    triggerHaptic(5);
    playBeadSound(600 + Number(d) * 20, 0.03);
    setInput((prev) => (prev.length >= 8 ? prev : prev + d));
    setWaitingForSecond(false);
  };

  const handleOp = (op: Op) => {
    triggerHaptic(15);
    playBeadSound(800, 0.05);
    const val = input !== '' ? Number(input) : displayValue;
    if (input !== '') {
      onCompute(val, null, 0);
    }
    setFirstOperand(val);
    setPendingOp(op);
    setWaitingForSecond(true);
    setInput('');
  };

  const handleEquals = () => {
    triggerHaptic([10, 5, 10]);
    playBeadSound(1000, 0.08);
    if (pendingOp === null || firstOperand === null) return;
    const second = input !== '' ? Number(input) : 0;
    onCompute(firstOperand!, pendingOp!, second);
    setPendingOp(null);
    setFirstOperand(null);
    setWaitingForSecond(false);
    setInput('');
  };

  const handleClear = () => {
    triggerHaptic(30);
    playBeadSound(400, 0.05);
    setInput('');
    setPendingOp(null);
    setFirstOperand(null);
    setWaitingForSecond(false);
    onReset();
  };

  const handleBackspace = () => {
    triggerHaptic(5);
    setInput((prev) => prev.slice(0, -1));
  };

  const handleSet = () => {
    triggerHaptic(20);
    playBeadSound(1200, 0.05);
    if (input === '') return;
    onCompute(Number(input), null, 0);
    setInput('');
    setWaitingForSecond(false);
    setPendingOp(null);
    setFirstOperand(null);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (KEY_TO_OP[e.key]) handleOp(KEY_TO_OP[e.key]);
      else if (e.key === 'Enter' || e.key === '=') handleEquals();
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Escape') handleClear();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [input, pendingOp, firstOperand, waitingForSecond]);

  return (
    <div className="w-full max-w-md mx-auto font-mono">
      {/* Display - More compact for mobile */}
      <div className="bg-black/40 border border-white/5 rounded-xl px-4 py-2 mb-3 text-right min-h-[60px] flex flex-col justify-end shadow-inner">
        <div className="text-[8px] uppercase font-bold text-zinc-600 tracking-[0.2em] mb-auto text-left flex items-center gap-1.5">
          <Hash size={7} /> {error ? 'Error' : 'Ready'}
        </div>
        <div className="text-[9px] text-zinc-500 tracking-wider min-h-[0.7rem] mb-0.5 font-medium">
          {firstOperand !== null
            ? `${firstOperand} ${pendingOp ?? ''}`
            : pendingOp
            ? `${displayValue} ${pendingOp}`
            : ''}
        </div>
        <div
          className={`text-2xl font-bold tracking-tighter leading-none transition-colors duration-300 ${
            error ? 'text-red-500' : 'text-orange-400'
          }`}
        >
          {error ? 'ERR' : currentDisplay()}
          {remainder !== null && !error && (
            <span className="text-xs text-zinc-500 ml-2 font-medium tracking-normal">
              R{remainder}
            </span>
          )}
        </div>
      </div>

      {/* Operator row - Smaller buttons */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {OP_BUTTONS.map(({ label, op }) => (
          <button
            key={label}
            onClick={() => handleOp(op)}
            className={`${BTN_BASE} py-2.5 text-lg ${
              pendingOp === op
                ? 'bg-orange-500 text-zinc-950 shadow-lg shadow-orange-500/30'
                : 'bg-zinc-800/80 text-orange-400 hover:bg-zinc-700/80 border border-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Number grid - Compact */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'].map((d) => (
          <button
            key={d}
            onClick={() => handleDigit(d)}
            className={`${BTN_BASE} py-2.5 bg-zinc-800/50 text-zinc-100 hover:bg-zinc-700/50 text-xl border border-white/5`}
          >
            {d}
          </button>
        ))}
        <button
          onClick={handleBackspace}
          className={`${BTN_BASE} py-2.5 bg-zinc-800/50 text-zinc-500 hover:bg-zinc-700/50 border border-white/5`}
        >
          <Delete size={18} />
        </button>
        <button
          onClick={handleSet}
          className={`${BTN_BASE} py-2.5 bg-zinc-800/50 text-orange-500 hover:bg-zinc-700/50 border border-white/5`}
        >
          <Check size={18} />
        </button>
      </div>

      {/* Action row */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={handleClear}
          className={`${BTN_BASE} py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 text-[9px] tracking-widest`}
        >
          <RotateCcw size={12} className="mr-1" /> RESET
        </button>
        <button
          onClick={handleEquals}
          className={`${BTN_BASE} py-2.5 bg-orange-500 text-zinc-950 font-black text-xl hover:bg-orange-400 shadow-xl shadow-orange-500/20`}
        >
          =
        </button>
      </div>
    </div>
  );
};
