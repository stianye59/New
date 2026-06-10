/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Check, Clock } from 'lucide-react';
import { formatDigitalTime } from '../utils/time';

interface StopwatchProps {
  onApplyTime: (seconds: number) => void;
  initialTime?: number;
}

export default function Stopwatch({ onApplyTime, initialTime = 0 }: StopwatchProps) {
  const [time, setTime] = useState<number>(initialTime);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  const handleStartPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
  };

  const handleApply = () => {
    onApplyTime(time);
  };

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-between shadow-sm transition-all duration-300 hover:shadow-md">
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <Clock className="w-4 h-4 text-slate-400" />
        <span>学習タイマー (Stopwatch)</span>
      </div>
      
      {/* Digital Display */}
      <div className="relative flex items-center justify-center py-2">
        <span 
          className={`font-mono text-3xl font-bold tracking-tight transition-colors duration-300 ${
            isRunning ? 'text-emerald-600 animate-pulse' : 'text-slate-700'
          }`}
        >
          {formatDigitalTime(time)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 w-full mt-2">
        <button
          type="button"
          onClick={handleStartPause}
          id="btn-stopwatch-toggle"
          className={`flex-1 py-1.5 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all duration-200 cursor-pointer ${
            isRunning 
              ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' 
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>一時停止</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>計測開始</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleReset}
          id="btn-stopwatch-reset"
          disabled={time === 0}
          className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
          title="リセット"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleApply}
          id="btn-stopwatch-apply"
          disabled={time === 0}
          className="flex-1 py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
          title="フォームに入力時間を反映"
        >
          <Check className="w-3.5 h-3.5" />
          <span>タイムを適用</span>
        </button>
      </div>
    </div>
  );
}
