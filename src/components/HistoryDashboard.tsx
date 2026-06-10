/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { StudyRecord, UnderstandingRank, ProblemSummary } from '../types';
import { formatTimeJapanese, formatDigitalTime } from '../utils/time';
import { Search, Calendar, Clock, BookOpen, Trash2, ArrowUpDown, ChevronDown, ChevronUp, BarChart3, TrendingDown, RefreshCw, Layers, Award, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HistoryDashboardProps {
  records: StudyRecord[];
  onDeleteRecord: (id: string) => void;
}

export default function HistoryDashboard({ records, onDeleteRecord }: HistoryDashboardProps) {
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedWorkbook, setSelectedWorkbook] = useState<string>('all');
  const [selectedRank, setSelectedRank] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'time-asc' | 'rank-desc'>('date-desc');

  // Selected Problem for Side-by-Side Attempt Comparison
  const [selectedProblemKey, setSelectedProblemKey] = useState<string | null>(null);

  // Group unique values for options
  const genres = useMemo(() => {
    return Array.from(new Set(records.map(r => r.genre))).filter(Boolean);
  }, [records]);

  const workbooks = useMemo(() => {
    return Array.from(new Set(records.map(r => r.workbookName))).filter(Boolean);
  }, [records]);

  // Transform records into grouped problems with attempt histories
  const groupedProblems = useMemo(() => {
    const map: Record<string, StudyRecord[]> = {};
    
    // Group records by lower-case unique signature: genre|workbookName|problemNumber
    records.forEach(r => {
      const key = `${r.genre.trim().toLowerCase()}|${r.workbookName.trim().toLowerCase()}|${r.problemNumber.trim().toLowerCase()}`;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(r);
    });

    const summaries: Record<string, ProblemSummary> = {};
    
    Object.keys(map).forEach(key => {
      // Sort history chronologically from past to present (oldest first)
      const sortedHistory = [...map[key]].sort((a, b) => a.createdAt - b.createdAt);
      const lastAttempt = sortedHistory[sortedHistory.length - 1];
      
      summaries[key] = {
        genre: lastAttempt.genre,
        workbookName: lastAttempt.workbookName,
        problemNumber: lastAttempt.problemNumber,
        attemptsCount: sortedHistory.length,
        lastAttempt,
        history: sortedHistory
      };
    });

    return summaries;
  }, [records]);

  // Calculate specific attempt index for each record to display "N回目" dynamically
  const recordWithAttemptCount = useMemo(() => {
    // Collect records sorted from oldest to newest to compute continuous sequence
    const chronological = [...records].sort((a, b) => a.createdAt - b.createdAt);
    const trackingCounters: Record<string, number> = {};
    
    // Map of recordId -> attempt number
    const recordAttemptsMap: Record<string, number> = {};
    
    chronological.forEach(r => {
      const key = `${r.genre.trim().toLowerCase()}|${r.workbookName.trim().toLowerCase()}|${r.problemNumber.trim().toLowerCase()}`;
      if (!trackingCounters[key]) {
        trackingCounters[key] = 0;
      }
      trackingCounters[key] += 1;
      recordAttemptsMap[r.id] = trackingCounters[key];
    });

    return recordAttemptsMap;
  }, [records]);

  // Filtered and sorted individual records
  const processedRecords = useMemo(() => {
    let result = [...records];

    // Search term check
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.genre.toLowerCase().includes(term) ||
        r.workbookName.toLowerCase().includes(term) ||
        r.problemNumber.toLowerCase().includes(term) ||
        (r.memo && r.memo.toLowerCase().includes(term))
      );
    }

    // Filters
    if (selectedGenre !== 'all') {
      result = result.filter(r => r.genre === selectedGenre);
    }
    if (selectedWorkbook !== 'all') {
      result = result.filter(r => r.workbookName === selectedWorkbook);
    }
    if (selectedRank !== 'all') {
      result = result.filter(r => r.understandingRank === selectedRank);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'date-desc') return b.createdAt - a.createdAt;
      if (sortBy === 'date-asc') return a.createdAt - b.createdAt;
      if (sortBy === 'time-asc') return a.timeTaken - b.timeTaken;
      if (sortBy === 'rank-desc') {
        const rankPriority: Record<string, number> = { 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
        return (rankPriority[b.understandingRank] || 0) - (rankPriority[a.understandingRank] || 0);
      }
      return 0;
    });

    return result;
  }, [records, searchTerm, selectedGenre, selectedWorkbook, selectedRank, sortBy]);

  const getRankBadgeColor = (rank: UnderstandingRank) => {
    switch (rank) {
      case 'S': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'A': return 'bg-red-100 text-red-800 border-red-200';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'D': return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getRankExplanation = (rank: UnderstandingRank) => {
    switch (rank) {
      case 'S': return '非の打ち所がないほど完璧！';
      case 'A': return '正解したが少し不安';
      case 'B': return 'あともう少しで正解だった...';
      case 'C': return '解き方は分かるが出力できなかった';
      case 'D': return 'さっぱり不明';
    }
  };

  // Compare selected problem histories side-by-side
  const selectedProblemSummary = useMemo(() => {
    if (!selectedProblemKey) return null;
    return groupedProblems[selectedProblemKey] || null;
  }, [selectedProblemKey, groupedProblems]);

  return (
    <div className="space-y-6">
      {/* Overview Cards & Stats */}
      {records.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold block">総学習回数</span>
              <span className="text-xl font-bold font-display text-slate-800">{records.length} <span className="text-xs font-normal">回</span></span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold block">解いた問題数 (ユニーク)</span>
              <span className="text-xl font-bold font-display text-slate-800">
                {Object.keys(groupedProblems).length} <span className="text-xs font-normal">問</span>
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold block">解き直し状況（2回目以降）</span>
              <span className="text-xl font-bold font-display text-slate-800">
                {records.length - Object.keys(groupedProblems).length} <span className="text-xs font-normal">件</span>
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold block">最高ランク S-A の割合</span>
              <span className="text-xl font-bold font-display text-slate-800">
                {Math.round((records.filter(r => r.understandingRank === 'S' || r.understandingRank === 'A').length / records.length) * 100) || 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Panel grid: left side list/filter, right side deep comparison detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column - search / filter / list */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Filtering Header Box */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
              <h2 className="font-display font-bold text-lg text-slate-800 flex items-center gap-2">
                <span>学習履歴一覧</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-sans font-medium">
                  該当 {processedRecords.length} 件
                </span>
              </h2>
              
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="問題集名, 番号, メモを検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/40 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Select tags row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-slate-100 pt-3">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-500">ジャンル</span>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <option value="all">すべて</option>
                  {genres.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-500">問題集名</span>
                <select
                  value={selectedWorkbook}
                  onChange={(e) => setSelectedWorkbook(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <option value="all">すべて</option>
                  {workbooks.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-500">理解度</span>
                <select
                  value={selectedRank}
                  onChange={(e) => setSelectedRank(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <option value="all">すべて</option>
                  <option value="S">Sランク (完ペキ)</option>
                  <option value="A">Aランク (スムーズ)</option>
                  <option value="B">Bランク (少し迷った)</option>
                  <option value="C">Cランク (要解説理解)</option>
                  <option value="D">Dランク (要復習)</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-500">並び替え</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <option value="date-desc">学習日 (新しい順)</option>
                  <option value="date-asc">学習日 (古い順)</option>
                  <option value="time-asc">タイム (速い順)</option>
                  <option value="rank-desc">理解度 (高い順)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Record Items Cards List */}
          {processedRecords.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-10 text-center text-slate-400 space-y-3 shadow-xs">
              <Search className="w-10 h-10 mx-auto text-slate-300 opacity-60" />
              <p className="font-semibold text-sm">該当する記録が見つかりませんでした。</p>
              <p className="text-xs text-slate-400">検索文字やフィルター設定を変更してみてください。</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1.5">
              {processedRecords.map((record) => {
                const problemKey = `${record.genre.trim().toLowerCase()}|${record.workbookName.trim().toLowerCase()}|${record.problemNumber.trim().toLowerCase()}`;
                const isSelected = selectedProblemKey === problemKey;
                const problemGroup = groupedProblems[problemKey];
                const totalAttempts = problemGroup ? problemGroup.attemptsCount : 1;
                const currentAttemptNum = recordWithAttemptCount[record.id] || 1;

                return (
                  <motion.div
                    key={record.id}
                    layoutId={`record-${record.id}`}
                    className={`bg-white border text-sm rounded-2xl p-4.5 transition-all duration-300 ${
                      isSelected 
                        ? 'ring-2 ring-emerald-500/80 border-emerald-500 shadow-sm' 
                        : 'border-slate-200/80 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      
                      {/* Left: Info */}
                      <div className="space-y-2 flex-grow">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2.5 py-0.5 rounded-md">
                            {record.genre}
                          </span>
                          <span className="text-slate-400 text-xs">/</span>
                          <span className="text-slate-700 text-xs font-semibold">{record.workbookName}</span>
                          
                          {/* Attempt count tag */}
                          {totalAttempts > 1 ? (
                            <span className="bg-amber-100/70 border border-amber-200 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {currentAttemptNum}回目 / 全{totalAttempts}回
                            </span>
                          ) : (
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                              初挑戦
                            </span>
                          )}
                        </div>

                        {/* Title and Problem Number */}
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-indigo-900 font-display font-extrabold text-base">
                            {record.problemNumber}
                          </span>
                        </div>

                        {/* Date and Time metrics */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {record.learningDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>タイム:</span>
                            <span className="font-mono font-bold text-slate-800">
                              {formatDigitalTime(record.timeTaken)}
                            </span>
                          </span>
                          {record.targetTime && (
                            <span className="flex items-center gap-1 bg-slate-100 text-indigo-700 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                              <span>目標: {record.targetTime}分</span>
                              {(() => {
                                const targetSec = record.targetTime * 60;
                                const diffSec = targetSec - record.timeTaken;
                                return (
                                  <span className={`ml-1 font-mono font-extrabold ${diffSec >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ({diffSec >= 0 ? `-${formatDigitalTime(diffSec)}` : `+${formatDigitalTime(Math.abs(diffSec))}`})
                                  </span>
                                );
                              })()}
                            </span>
                          )}
                        </div>

                        {/* Memo */}
                        {record.memo && (
                          <p className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100/60 leading-relaxed italic mt-1.5">
                            {record.memo}
                          </p>
                        )}
                      </div>

                      {/* Right: Rank visual and interactive triggers */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4 shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
                        {/* Circle Rank */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 sm:hidden">理解度:</span>
                          <span 
                            className={`w-10 h-10 rounded-full font-bold flex items-center justify-center border font-display text-base shadow-2xs ${getRankBadgeColor(record.understandingRank)}`}
                            title={getRankExplanation(record.understandingRank)}
                          >
                            {record.understandingRank}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {/* Compare trigger button */}
                          <button
                            type="button"
                            onClick={() => setSelectedProblemKey(isSelected ? null : problemKey)}
                            className={`text-xs px-3 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer border ${
                              isSelected 
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 font-semibold' 
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>{isSelected ? '比較を閉じる' : '学習推移を比較'}</span>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            id={`btn-delete-${record.id}`}
                            onClick={() => onDeleteRecord(record.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                            title="学習データを削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column - deep attempt history comparison ( 前回結果との推移を自動比較 ) */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedProblemSummary ? (
              <motion.div
                key={selectedProblemKey || 'no-comparisons'}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white border border-slate-200/95 rounded-3xl p-5 shadow-md space-y-5"
              >
                {/* Header */}
                <div className="border-b border-slate-100 pb-3 flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100/50 px-2 py-0.5 rounded-md font-bold">
                      {selectedProblemSummary.genre}
                    </span>
                    <h3 className="font-display font-extrabold text-base text-slate-900 mt-1">
                      {selectedProblemSummary.workbookName}
                    </h3>
                    <p className="text-xl font-display font-extrabold text-indigo-600">
                      {selectedProblemSummary.problemNumber}
                    </p>
                  </div>
                  
                  {/* Close comparisons */}
                  <button
                    onClick={() => setSelectedProblemKey(null)}
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer text-xs"
                  >
                    閉じる
                  </button>
                </div>

                {/* Growth indicator stats */}
                {selectedProblemSummary.history.length > 1 && (() => {
                  const first = selectedProblemSummary.history[0];
                  const last = selectedProblemSummary.history[selectedProblemSummary.history.length - 1];
                  const timeSavedSec = first.timeTaken - last.timeTaken;
                  const improvementPct = first.timeTaken > 0 
                    ? Math.round((timeSavedSec / first.timeTaken) * 100) 
                    : 0;

                  return (
                    <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                        <TrendingDown className="w-4 h-4 text-emerald-600" />
                        <span>初回からのタイム削減傾向</span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-extrabold font-display text-emerald-700">
                          {timeSavedSec > 0 ? `-${formatDigitalTime(timeSavedSec)}` : `+${formatDigitalTime(Math.abs(timeSavedSec))}`}
                        </span>
                        {improvementPct > 0 && (
                          <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                            {improvementPct}% 速くなりました！
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        初回({formatDigitalTime(first.timeTaken)}) ➔ 今回({formatDigitalTime(last.timeTaken)})
                      </p>
                    </div>
                  );
                })()}

                {/* Timeline flow chart */}
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-slate-500 flex items-center gap-1">
                    <span>⏳ 解き直しの進捗タイムライン</span>
                    <span className="text-[10px] font-normal text-slate-400">({selectedProblemSummary.attemptsCount}回解いています)</span>
                  </h4>

                  <div className="relative pl-5 border-l-2 border-dashed border-indigo-200/80 space-y-5 py-1">
                    {selectedProblemSummary.history.map((h, i) => {
                      const isLast = i === selectedProblemSummary.history.length - 1;
                      const hasPrev = i > 0;
                      let timeDiffText = '';
                      let timeImproved = false;

                      if (hasPrev) {
                        const prev = selectedProblemSummary.history[i - 1];
                        const diff = prev.timeTaken - h.timeTaken;
                        if (diff > 0) {
                          timeDiffText = `-${formatDigitalTime(diff)} 短縮`;
                          timeImproved = true;
                        } else if (diff < 0) {
                          timeDiffText = `+${formatDigitalTime(Math.abs(diff))} 増加`;
                        } else {
                          timeDiffText = 'タイム変動なし';
                        }
                      }

                      return (
                        <div key={h.id} className="relative">
                          {/* Timeline dot */}
                          <span className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center font-bold text-[8px] z-10 ${
                            isLast 
                              ? 'bg-indigo-600 border-indigo-100 ring-4 ring-indigo-50' 
                              : 'bg-white border-indigo-400'
                          }`} />
                          
                          <div className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                            isLast 
                              ? 'bg-slate-50 border-slate-300 shadow-3xs' 
                              : 'bg-slate-50/50 border-slate-200/70'
                          }`}>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-extrabold text-slate-700">第 {i + 1} 回目</span>
                              <span className="font-mono text-slate-500">{h.learningDate}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500 text-[10px]">タイム:</span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {formatDigitalTime(h.timeTaken)}
                                  </span>
                                </div>
                                {h.targetTime && (
                                  <div className="text-[10px] text-indigo-700 font-semibold">
                                    目標: {h.targetTime}分 (
                                    {(() => {
                                      const targetSec = h.targetTime * 60;
                                      const diffSec = targetSec - h.timeTaken;
                                      return (
                                        <span className={diffSec >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                          {diffSec >= 0 ? `${formatDigitalTime(diffSec)} 短縮` : `${formatDigitalTime(Math.abs(diffSec))} 超過`}
                                        </span>
                                      );
                                    })()}
                                    )
                                  </div>
                                )}
                              </div>

                              {/* Rank indicator */}
                              <span 
                                className={`px-2 py-0.5 rounded-md font-bold font-display border text-[10px] ${getRankBadgeColor(h.understandingRank)}`}
                                title={getRankExplanation(h.understandingRank)}
                              >
                                {h.understandingRank} ({h.understandingRank === 'S' || h.understandingRank === 'A' ? '合格' : '復習要'})
                              </span>
                            </div>

                            {/* Diff from previous attempt */}
                            {hasPrev && (
                              <div className={`text-[10px] font-semibold flex items-center gap-1 mt-1 ${
                                timeImproved ? 'text-emerald-700' : 'text-slate-500'
                              }`}>
                                <span>前回比較:</span>
                                <span>{timeDiffText}</span>
                              </div>
                            )}

                            {h.memo && (
                              <div className="bg-white/60 p-2 rounded-lg text-slate-500 text-[10px] border border-slate-100 mt-1 italic">
                                <span>「{h.memo}」</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action recommendations or summary */}
                <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 text-xs space-y-2 text-indigo-900 leading-relaxed">
                  <div className="flex items-center gap-1 font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-indigo-600" />
                    <span>次回のアドバイス</span>
                  </div>
                  {(() => {
                    const last = selectedProblemSummary.history[selectedProblemSummary.history.length - 1];
                    if (last.understandingRank === 'S') {
                      return <p>現在の理解度は<b>Sランク（完璧）</b>です！時間を空けて、1週間後や忘れた頃にもう一度解いて長期記憶に定着させましょう。</p>;
                    } else if (last.understandingRank === 'A') {
                      return <p>現在の理解度は<b>Aランク（スムーズ）</b>です！次回はよりスピーディに、迷いゼロで解く<b>Sランク</b>を目標にしましょう。</p>;
                    } else {
                      return <p>現在の理解度は<b>{last.understandingRank}ランク（復習が必要）</b>となっています。解説のポイント（メモ項目など）を見直した上で、近いうちに必ず再挑戦してミスを克服しましょう！</p>;
                    }
                  })()}
                </div>
              </motion.div>
            ) : (
              <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 text-center text-slate-400 space-y-4">
                <BarChart3 className="w-10 h-10 mx-auto text-slate-300 opacity-60" />
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-700 text-sm">問題別の推移比較</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    履歴一覧の<b>「学習推移を比較」</b>ボタンをクリックすると、その問題の複数回にわたるスピード変化や理解度の向上履歴が直感的なタイムラインでここに並び、自動比較されます。
                  </p>
                </div>
                

              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
