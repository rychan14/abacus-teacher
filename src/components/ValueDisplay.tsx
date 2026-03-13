import React from 'react';

interface ValueDisplayProps {
  value: number;
  columns: { heavenBead: boolean; earthBeads: number }[];
  remainder?: number | null;
}

export const ValueDisplay: React.FC<ValueDisplayProps> = ({ value, columns, remainder }) => {
  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      <div className="text-[8px] font-bold tracking-[0.4em] uppercase text-orange-500/20">
        Abacus Master
      </div>

      <div className="flex gap-1 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 shadow-inner">
        {columns.map((col, i) => {
          const digit = (col.heavenBead ? 5 : 0) + col.earthBeads;
          const placeValue = Math.pow(10, columns.length - 1 - i);
          return (
            <div key={i} className="flex flex-col items-center w-7">
              <div
                className={`text-lg font-mono font-bold transition-colors duration-300 ${
                  digit > 0 ? 'text-orange-400' : 'text-zinc-700'
                }`}
              >
                {digit}
              </div>
              <div className="text-[7px] font-mono text-zinc-600">
                {placeValue >= 1000 ? `${placeValue / 1000}k` : placeValue}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-4xl font-mono font-bold text-orange-400 tracking-tighter drop-shadow-[0_0_10px_rgba(251,146,60,0.3)]">
          {value.toLocaleString()}
        </div>
        {remainder !== null && remainder !== undefined && (
          <div className="text-xl font-mono font-bold text-zinc-500">
            rem {remainder}
          </div>
        )}
      </div>
    </div>
  );
};
