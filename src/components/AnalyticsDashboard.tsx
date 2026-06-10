/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { StudyRecord, UnderstandingRank } from '../types';
import { formatTimeJapanese } from '../utils/time';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  Calendar, Clock, Award, BarChart3, PieChart as PieIcon, TrendingUp, 
  HelpCircle, Filter, BookOpen, ChevronRight, Sparkles 
} from 'lucide-react';

interface AnalyticsDashboardProps {
  records: StudyRecord[];
}

// Help parse local YYYY-MM-DD dates robustly to timestamps for range calculations
const parseLocalDate = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
  }
  return 0;
};

const RANK_VALUES: Record<UnderstandingRank, number> = {
  'S': 5,
  'A': 4,
  'B': 3,
  'C': 2,
  'D': 1
};

const RANK_LABELS: Record<UnderstandingRank, string> = {
  'S': 'S: 非の打ち所がないほど完璧！',
  'A': 'A: 正解したが少し不安',
  'B': 'B: あともう少しで正解だった...',
  'C': 'C: 解き方は分かるが出力できなかった',
  'D': 'D: さっぱり不明'
};

const RANK_COLORS: Record<UnderstandingRank, string> = {
  'S': '#a855f7', // purple-500
  'A': '#ef4444', // red-500
  'B': '#3b82f6', // blue-500
  'C': '#eab308', // yellow-500
  'D': '#64748b'  // slate-500 (slightly dark grey)
};

export default function AnalyticsDashboard({ records }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'all'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  // Unified Anchor Date for calculations (Treated as 2026-06-09 based on metadata)
  const anchorDateStr = '2026-06-09';
  const anchorTimestamp = parseLocalDate(anchorDateStr);

  // Genres option list
  const genresList = useMemo(() => {
    return Array.from(new Set(records.map(r => r.genre))).filter(Boolean);
  }, [records]);

  // Filter records by timeRange & selectedGenre
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // Filter by genre
    if (selectedGenre !== 'all') {
      result = result.filter(r => r.genre === selectedGenre);
    }

    // Filter by date range
    if (timeRange === '7days') {
      const sevenDaysAgo = anchorTimestamp - 7 * 24 * 60 * 60 * 1000;
      result = result.filter(r => parseLocalDate(r.learningDate) >= sevenDaysAgo);
    } else if (timeRange === '30days') {
      const thirtyDaysAgo = anchorTimestamp - 30 * 24 * 60 * 60 * 1000;
      result = result.filter(r => parseLocalDate(r.learningDate) >= thirtyDaysAgo);
    }

    // Sort chronologically
    return result.sort((a, b) => parseLocalDate(a.learningDate) - parseLocalDate(b.learningDate));
  }, [records, timeRange, selectedGenre]);

  // Overall range statistics
  const stats = useMemo(() => {
    if (filteredRecords.length === 0) {
      return { totalTimeSec: 0, avgTimeSec: 0, totalAttempts: 0, avgRankScore: 0, uniqueProblems: 0 };
    }

    const totalTimeSec = filteredRecords.reduce((sum, r) => sum + r.timeTaken, 0);
    const avgTimeSec = Math.round(totalTimeSec / filteredRecords.length);
    const totalAttempts = filteredRecords.length;
    
    // Average rank score
    const rankSum = filteredRecords.reduce((sum, r) => sum + RANK_VALUES[r.understandingRank], 0);
    const avgRankScore = rankSum / filteredRecords.length;

    // Unique problems in filtered range
    const uniqueKeys = new Set(filteredRecords.map(r => `${r.genre}|${r.workbookName}|${r.problemNumber}`));

    return {
      totalTimeSec,
      avgTimeSec,
      totalAttempts,
      avgRankScore,
      uniqueProblems: uniqueKeys.size
    };
  }, [filteredRecords]);

  // Chart Data 1: Chronological Study Time & Daily Average
  const dailyTimeData = useMemo(() => {
    const dailyMap: Record<string, { date: string; timeMin: number; count: number }> = {};
    
    // Pre-populate last 7 days keys if 7-day filter is active to prevent empty gaps
    if (timeRange === '7days') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(anchorTimestamp - i * 24 * 60 * 60 * 1000);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dailyMap[dateStr] = { date: dateStr.slice(5), timeMin: 0, count: 0 };
      }
    }

    filteredRecords.forEach(r => {
      const dateKey = r.learningDate;
      const displayKey = dateKey.slice(5); // Format MM-DD for display
      const timeInMinutes = Math.round((r.timeTaken / 60) * 10) / 10;

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: displayKey, timeMin: 0, count: 0 };
      }
      dailyMap[dateKey].timeMin += timeInMinutes;
      dailyMap[dateKey].count += 1;
    });

    return Object.keys(dailyMap)
      .sort((a, b) => parseLocalDate(a) - parseLocalDate(b))
      .map(key => {
        const item = dailyMap[key];
        return {
          date: item.date,
          '学習時間 (分)': Math.round(item.timeMin * 10) / 10,
          '問題回答数': item.count
        };
      });
  }, [filteredRecords, timeRange]);

  // Chart Data 2: Rank Distribution (S, A, B, C, D count)
  const rankDistributionData = useMemo(() => {
    const counts: Record<UnderstandingRank, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    filteredRecords.forEach(r => {
      counts[r.understandingRank] += 1;
    });

    return (['S', 'A', 'B', 'C', 'D'] as UnderstandingRank[]).map(rank => ({
      name: `${rank}ランク`,
      value: counts[rank],
      color: RANK_COLORS[rank],
      description: RANK_LABELS[rank]
    })).filter(item => item.value > 0);
  }, [filteredRecords]);

  // Chart Data 3: Genre-wise Time Share
  const genreShareData = useMemo(() => {
    const shareMap: Record<string, number> = {};
    filteredRecords.forEach(r => {
      if (!shareMap[r.genre]) {
        shareMap[r.genre] = 0;
      }
      shareMap[r.genre] += Math.round(r.timeTaken / 60);
    });

    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    return Object.keys(shareMap).map((genre, index) => ({
      name: genre,
      value: shareMap[genre],
      color: colors[index % colors.length]
    })).sort((a, b) => b.value - a.value);
  }, [filteredRecords]);

  // Chart Data 4: Daily Average Understanding Score (Line Graph)
  const understandingTrendData = useMemo(() => {
    const dailyMap: Record<string, { sum: number; count: number }> = {};
    
    filteredRecords.forEach(r => {
      const dateKey = r.learningDate;
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { sum: 0, count: 0 };
      }
      dailyMap[dateKey].sum += RANK_VALUES[r.understandingRank];
      dailyMap[dateKey].count += 1;
    });

    return Object.keys(dailyMap)
      .sort((a, b) => parseLocalDate(a) - parseLocalDate(b))
      .map(key => {
        const displayKey = key.slice(5); // Format MM-DD
        const avg = Math.round((dailyMap[key].sum / dailyMap[key].count) * 100) / 100;
        return {
          date: displayKey,
          '理解度平均 (5点満点)': avg
        };
      });
  }, [filteredRecords]);

  // Function to translate understanding scores to labels
  const getAverageRankLabel = (score: number) => {
    if (score >= 4.5) return 'S (完ペキ級)';
    if (score >= 3.8) return 'A (極めて良好)';
    if (score >= 2.8) return 'B (概ね良好)';
    if (score >= 1.8) return 'C (サポート要)';
    return 'D (重点的な復習推奨)';
  };

  const formattedHours = (seconds: number) => {
    if (seconds === 0) return '0分';
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h > 0) return `${h}時間${m}分`;
    return `${m}分`;
  };

  if (records.length === 0) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center text-slate-400 space-y-4 shadow-xs">
        <BarChart3 className="w-12 h-12 mx-auto text-slate-300 opacity-60 animate-bounce" />
        <h3 className="text-base font-bold text-slate-800">学習データの分析グラフ</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          まずは学習記録を登録するか、サイドバーの「<b>デモデータを追加</b>」ボタンをクリックしてテスト用進捗レコードを読み込んでください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Dynamic Interactive Filter Panel */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-slate-800">プログレス・統計分析</h2>
            <p className="text-[11px] text-slate-400 font-medium">指定期間における全体の勉強量・理解度の推移をダッシュボード化</p>
          </div>
        </div>

        {/* Filters Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Picker */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/40">
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                timeRange === 'all' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              全期間
            </button>
            <button
              onClick={() => setTimeRange('30days')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                timeRange === '30days' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              過去30日
            </button>
            <button
              onClick={() => setTimeRange('7days')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                timeRange === '7days' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              過去7日
            </button>
          </div>

          {/* Genre Specific Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 py-1 px-2.5 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase">ジャンル別</span>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="text-[11px] font-bold bg-transparent border-0 outline-hidden text-slate-700 py-0.5 cursor-pointer max-w-[120px] truncate focus:ring-0"
            >
              <option value="all">すべて表示</option>
              {genresList.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overview Analytics Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-3xs space-y-1">
          <div className="flex items-center gap-2 justify-between">
            <span className="text-[11px] text-slate-400 font-bold">総学習時間</span>
            <span className="p-1 px-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded">タイム</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-extrabold font-mono text-slate-800 tracking-tight">
              {formattedHours(stats.totalTimeSec)}
            </span>
          </div>
          <p className="text-[9px] text-slate-400 leading-none">該当期間内の実測タイム計</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-3xs space-y-1">
          <div className="flex items-center gap-2 justify-between">
            <span className="text-[11px] text-slate-400 font-bold">平均理解度</span>
            <span className="p-1 px-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded">理解レベル</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-extrabold text-emerald-600 font-mono">
              {stats.avgRankScore === 0 ? '-' : `${stats.avgRankScore.toFixed(2)}`}
            </span>
            <span className="text-[10px] text-slate-400">/ 5点</span>
          </div>
          <p className="text-[9px] text-emerald-700/80 font-semibold truncate" title={getAverageRankLabel(stats.avgRankScore)}>
            {stats.avgRankScore === 0 ? 'データなし' : getAverageRankLabel(stats.avgRankScore)}
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-3xs space-y-1">
          <div className="flex items-center gap-2 justify-between">
            <span className="text-[11px] text-slate-400 font-bold">総学習回数</span>
            <span className="p-1 px-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded">回数</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-extrabold font-mono text-slate-800">
              {stats.totalAttempts}
            </span>
            <span className="text-xs text-slate-400">回解いた</span>
          </div>
          <p className="text-[9px] text-slate-400 leading-none">反復学習回数を含む延べ件数</p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-3xs space-y-1">
          <div className="flex items-center gap-2 justify-between">
            <span className="text-[11px] text-slate-400 font-bold">重複なし問題数</span>
            <span className="p-1 px-1.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded">問題数</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-extrabold font-mono text-slate-800">
              {stats.uniqueProblems}
            </span>
            <span className="text-xs text-slate-400">問の単体</span>
          </div>
          <p className="text-[9px] text-slate-400 leading-none">
            {stats.totalAttempts > 0 
              ? `解き直し率: ${Math.round(((stats.totalAttempts - stats.uniqueProblems) / stats.totalAttempts) * 100)}%` 
              : '0%'}
          </p>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="bg-white border border-slate-200 p-8 text-center rounded-3xl text-slate-400">
          <p className="text-xs font-semibold">選択されたフィルター条件に適合する学習履歴が見当たりません。</p>
          <p className="text-[10px] text-slate-400 mt-1">フィルターの指定を変更するか、新規の学習データを登録してください。</p>
        </div>
      ) : (
        /* Visual Graph Layout */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Daily Study Time (Bar Chart) */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>日別の学習時間と問題量</span>
              </h3>
              <p className="text-[10px] text-slate-400">各日付ごとに完了した問題の勉強時間（分）と問題数</p>
            </div>

            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTimeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    labelStyle={{ fontWeight: 'bold', fontSize: '11px', color: '#cbd5e1' }}
                    itemStyle={{ fontSize: '11px', color: '#38bdf8' }}
                  />
                  <Bar dataKey="学習時間 (分)" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Daily Understanding average progress over time (Line Chart) */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>日付別の理解度評価平均</span>
              </h3>
              <p className="text-[10px] text-slate-400">学習回ごとの理解度（S=5, A=4, B=3, C=2, D=1）の平均スコア推移</p>
            </div>

            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={understandingTrendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    labelStyle={{ fontWeight: 'bold', fontSize: '11px', color: '#cbd5e1' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="理解度平均 (5点満点)" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ fill: '#10b981', strokeWidth: 1, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Understanding Rank Distribution (Pie/Donut Chart) */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>理解度ランクの分布割合</span>
              </h3>
              <p className="text-[10px] text-slate-400">現在のフィルター範囲に含まれる全学習レコードにおけるランク比率</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 h-64">
              <div className="w-1/2 h-full min-h-[160px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rankDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {rankDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Embedded count text inside center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">全レコード</span>
                  <span className="text-xl font-extrabold text-slate-700 font-mono mt-0.5">{stats.totalAttempts}件</span>
                </div>
              </div>

              {/* Dynamic Legend */}
              <div className="flex-1 space-y-2 w-full text-xs">
                {rankDistributionData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-slate-800 text-[11px]">{item.name}</span>
                    </div>
                    <div className="text-right flex items-baseline gap-1.5">
                      <span className="font-mono font-bold text-slate-700">{item.value}件</span>
                      <span className="text-[10px] text-slate-400">
                        ({Math.round((item.value / stats.totalAttempts) * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart 4: Genre / Subject Share Breakdown (Horizontal Bar Chart) */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>ジャンル別学習時間のシェア</span>
              </h3>
              <p className="text-[10px] text-slate-400">どのジャンル・科目の勉強に最も時間を費やしたかの内訳比較 (時間: 分)</p>
            </div>

            {selectedGenre !== 'all' ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2 border border-dashed border-slate-200 rounded-2xl">
                <Sparkles className="w-6 h-6 text-indigo-400/80" />
                <p className="text-xs font-bold text-slate-700">個別ジャンルにフィルターされています</p>
                <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
                  フィルターで「すべて表示」を選択すると、全ジャンルの学習時間配分の割合がグラフィカルにここに比較表示されます。
                </p>
                <button
                  onClick={() => setSelectedGenre('all')}
                  className="mt-2 text-[10px] px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 rounded-lg cursor-pointer font-bold"
                >
                  すべて表示に戻す
                </button>
              </div>
            ) : genreShareData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                ジャンル時間の計算に必要なデータが未登録です。
              </div>
            ) : (
              <div className="h-64 overflow-y-auto custom-scrollbar pr-1 flex flex-col justify-center space-y-4">
                {genreShareData.map((genre, index) => {
                  const maxVal = Math.max(...genreShareData.map(g => g.value)) || 1;
                  const percentWidth = Math.round((genre.value / maxVal) * 100);
                  const totalSumTime = genreShareData.reduce((sum, g) => sum + g.value, 0) || 1;
                  const overallPct = Math.round((genre.value / totalSumTime) * 100);

                  return (
                    <div key={index} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-xs mt-0.5 shrink-0" style={{ backgroundColor: genre.color }} />
                          <span className="font-bold text-slate-800">{genre.name}</span>
                        </div>
                        <div className="flex items-baseline gap-2 text-slate-500 text-[11px]">
                          <span className="font-mono font-bold text-slate-700">{genre.value}分</span>
                          <span>占有率: {overallPct}%</span>
                        </div>
                      </div>

                      {/* Bar indicator */}
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${percentWidth}%`,
                            backgroundColor: genre.color
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Helper Guide block */}
      <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-start gap-3">
        <span className="text-base text-blue-500 mt-0.5 font-bold">💡</span>
        <div className="text-xs space-y-1 text-slate-600 leading-relaxed font-semibold">
          <h4 className="font-bold text-blue-900 text-xs">統計データの活用アドバイス</h4>
          <p>
            「日別の学習時間」から日々の継続モチベーションを評価し、「理解度評価平均」の推移ラインが右肩上がりに向上しているか観察しましょう。
            各科目ジャンルでのバランスを整えながら、苦手ランク（C・D）の比率を減らし、合格水準（S・A）を増やしていくことで、反復学習の効果をリアルタイムに実感できます。
          </p>
        </div>
      </div>

    </div>
  );
}
