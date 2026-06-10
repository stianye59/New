import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StudyRecord } from '../types';
import { X, FileText, Download, Check, AlertCircle, Loader2, Calendar, BookOpen, Clock, Award } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: StudyRecord[];
}

export default function ExportModal({ isOpen, onClose, records }: ExportModalProps) {
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedWorkbook, setSelectedWorkbook] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Extract unique genres (memoized to keep reference stable)
  const genres = useMemo(() => {
    return Array.from(new Set(records.map(r => r.genre))).filter(Boolean).sort();
  }, [records]);

  // Extract unique workbooks for the selected genre
  const workbooksForGenre = useMemo(() => {
    if (!selectedGenre) return [];
    return Array.from(
      new Set(records.filter(r => r.genre === selectedGenre).map(r => r.workbookName))
    ).filter(Boolean).sort();
  }, [records, selectedGenre]);

  // Initialize selections only when the modal is opened
  useEffect(() => {
    if (isOpen) {
      if (genres.length > 0) {
        const initialGenre = genres[0];
        setSelectedGenre(initialGenre);
        
        const workbooks = Array.from(
          new Set(records.filter(r => r.genre === initialGenre).map(r => r.workbookName))
        ).filter(Boolean).sort();
        
        if (workbooks.length > 0) {
          setSelectedWorkbook(workbooks[0]);
        } else {
          setSelectedWorkbook('');
        }
      } else {
        setSelectedGenre('');
        setSelectedWorkbook('');
      }
    }
  }, [isOpen, genres, records]);

  // Handle explicit genre selection change with instant workbook synchronization
  const handleGenreChange = (genre: string) => {
    setSelectedGenre(genre);
    const workbooks = Array.from(
      new Set(records.filter(r => r.genre === genre).map(r => r.workbookName))
    ).filter(Boolean).sort();
    
    if (workbooks.length > 0) {
      setSelectedWorkbook(workbooks[0]);
    } else {
      setSelectedWorkbook('');
    }
  };

  if (!isOpen) return null;

  // Filter records based on active selection
  const filteredRecords = records.filter(
    r => r.genre === selectedGenre && r.workbookName === selectedWorkbook
  ).sort((a, b) => b.createdAt - a.createdAt); // Newest first

  // Format utility functions
  const formatSeconds = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}分${String(secs).padStart(2, '0')}秒`;
  };

  const getRankColor = (rank: string) => {
    switch (rank) {
      case 'S': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'A': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'B': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'C': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  // Calculate statistics for the filtered group
  const totalAttempts = filteredRecords.length;
  const totalStudyTime = filteredRecords.reduce((sum, r) => sum + r.timeTaken, 0);
  const avgStudyTime = totalAttempts > 0 ? Math.round(totalStudyTime / totalAttempts) : 0;
  
  const recordsWithTarget = filteredRecords.filter(r => r.targetTime && r.targetTime > 0);
  const targetAchievedCount = recordsWithTarget.filter(r => {
    if (!r.targetTime) return false;
    return r.timeTaken <= r.targetTime * 60;
  }).length;
  const targetAchievementRate = recordsWithTarget.length > 0 
    ? Math.round((targetAchievedCount / recordsWithTarget.length) * 100) 
    : null;

  const ranksCount = filteredRecords.reduce((acc, r) => {
    acc[r.understandingRank] = (acc[r.understandingRank] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topRank = (['S', 'A', 'B', 'C', 'D'] as const).find(r => ranksCount[r] && ranksCount[r] > 0) || 'なし';

  const handleDownloadPdf = async () => {
    if (!reportRef.current || filteredRecords.length === 0) return;
    setIsGenerating(true);

    try {
      // Create high-resolution canvas
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210; // A4 layout width in mm
      const pageHeight = 295; // A4 layout height in mm with safety margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      // Wrap onto next page if the rendering runs taller than A4 height
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const formattedWorkbook = selectedWorkbook.replace(/[\s\W]+/g, '_');
      pdf.save(`StudyReport_${selectedGenre}_${formattedWorkbook}.pdf`);
      
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3500);
    } catch (err) {
      console.error('Failed to generate PDF Report', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Background Overlay */}
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 transition-opacity bg-slate-900/60 backdrop-blur-xs" 
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Trick browser into centering modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block w-full max-w-md overflow-hidden text-left align-middle transition-all transform bg-slate-50 rounded-2xl shadow-2xl sm:my-8 sm:align-middle border border-slate-200">
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-indigo-950 border-b border-indigo-900">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-800 rounded-lg text-white">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white" id="modal-title">
                  PDFレポート書き出し
                </h3>
                <p className="text-[10px] text-indigo-200/85 font-medium">
                  実績証明書をPDFファイルとしてダウンロードします。
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 text-indigo-300 hover:text-white hover:bg-indigo-900 rounded-lg transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Form Adjustments */}
            <div className="bg-white p-4.5 rounded-xl border border-slate-200/60 shadow-2xs space-y-3.5">
              {/* Genre Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  ジャンル選択
                </label>
                {genres.length > 0 ? (
                  <select
                    value={selectedGenre}
                    onChange={(e) => handleGenreChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                  >
                    {genres.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>学習記録が登録されていません</span>
                  </div>
                )}
              </div>

              {/* Workbook Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  問題集名/教材名選択
                </label>
                {workbooksForGenre.length > 0 ? (
                  <select
                    value={selectedWorkbook}
                    onChange={(e) => setSelectedWorkbook(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                  >
                    {workbooksForGenre.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 bg-slate-100 text-slate-500 rounded-lg text-xs leading-none font-medium">
                    問題集がありません
                  </div>
                )}
              </div>
            </div>

            {/* Summary Stats Panel */}
            {filteredRecords.length > 0 && (
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 space-y-2.5 shadow-sm font-mono text-[10.5px]">
                <p className="text-[9.5px] text-slate-400 font-bold border-b border-slate-800 pb-1.5 uppercase font-sans">
                  抽出合計：{filteredRecords.length}件の記録
                </p>
                <div className="flex justify-between">
                  <span className="text-slate-400">総学習セッション数</span>
                  <span className="font-bold text-white">{totalAttempts} 回</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">合計学習タイム</span>
                  <span className="font-bold text-white">{formatSeconds(totalStudyTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">平均学習タイム</span>
                  <span className="font-bold text-white">{formatSeconds(avgStudyTime)}</span>
                </div>
                {targetAchievementRate !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">目標達成率</span>
                    <span className="font-extrabold text-emerald-400">{targetAchievementRate}%</span>
                  </div>
                )}
                <div className="flex justify-between text-rose-300">
                  <span className="text-slate-400">最高理解度</span>
                  <span className="font-extrabold text-rose-400">{topRank}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1.5">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGenerating || filteredRecords.length === 0}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                  isGenerating || filteredRecords.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300/30'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 shadow-sm'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>PDFファイルを生成中...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>書き出す</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-250 hover:bg-slate-50 transition-all shadow-3xs cursor-pointer text-center"
              >
                キャンセル
              </button>
            </div>

            {/* Toast for Completed Success */}
            {showSuccessToast && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-800 animate-fade-in shadow-2xs">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-tight">
                  <p className="font-bold text-emerald-900">PDF生成完了！</p>
                  <p className="text-slate-500 mt-0.5">ダウンロードフォルダをご確認ください。</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden container: Rendering A4 PDF content off-screen so html2canvas compiles gracefully without disturbing UI layout */}
      <div 
        className="absolute pointer-events-none select-none overflow-hidden" 
        style={{ left: '-9999px', top: '-9999px', width: '210mm' }}
      >
        {filteredRecords.length > 0 && (
          <div 
            ref={reportRef} 
            id="pdf-render-root"
            className="bg-white p-10 text-slate-800 font-sans"
            style={{ width: '210mm', minHeight: '297mm' }}
          >
            {/* Document Header Panel */}
            <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-5 mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-900 text-white font-extrabold text-xs px-2.5 py-0.5 rounded tracking-wide uppercase font-mono">
                    Study Analytics
                  </span>
                </div>
                <h1 className="text-xl font-black text-indigo-950 tracking-tight">学習履歴・進捗証明書</h1>
                <p className="text-[10px] text-slate-400 font-mono">REPORT ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold text-slate-700">Study Tracker Pro</p>
                <p className="text-slate-500 text-[10px] mt-0.5">生成日: 2026年06月09日</p>
              </div>
            </div>

            {/* Selected context outline */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">対象ジャンル</span>
                <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  {selectedGenre}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">問題集名/テキスト名</span>
                <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5 truncate" title={selectedWorkbook}>
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  {selectedWorkbook}
                </span>
              </div>
            </div>

            {/* Summary Metrics Block */}
            <div className="grid grid-cols-4 gap-3.5 mb-6">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 text-center">
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">総学習回数</p>
                <p className="text-lg font-black text-indigo-950 mt-1 font-mono">{totalAttempts}<span className="text-[11px] font-bold ml-0.5">回</span></p>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 text-center">
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">累計タイム</p>
                <p className="text-lg font-black text-indigo-950 mt-1 font-mono">
                  {Math.round(totalStudyTime / 60)}<span className="text-[11px] font-bold ml-0.5">分</span>
                </p>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 text-center">
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">最高理解度</p>
                <p className="text-lg font-black text-rose-600 mt-1 font-mono">{topRank}</p>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 text-center">
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">目標達成率</p>
                <p className="text-lg font-black text-emerald-600 mt-1 font-mono">
                  {targetAchievementRate !== null ? `${targetAchievementRate}%` : '---'}
                </p>
              </div>
            </div>

            {/* Detailed list rendering */}
            <div className="space-y-3.5">
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>詳細な学習記録一覧</span>
                <span className="text-[10px] text-slate-400 font-mono font-normal">計 {filteredRecords.length} セッション</span>
              </h4>

              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                    <th className="py-2.5 w-24">学習日</th>
                    <th className="py-2.5">問題番号 / 項目</th>
                    <th className="py-2.5 w-32 text-right">解いたタイム</th>
                    <th className="py-2.5 w-24 text-center">理解度</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((r) => {
                    const isAchieved = r.targetTime ? r.timeTaken <= r.targetTime * 60 : null;
                    return (
                      <tr key={r.id} className="text-slate-700">
                        <td className="py-3 font-mono font-medium text-slate-500">{r.learningDate}</td>
                        <td className="py-3 pr-4">
                          <p className="font-bold text-slate-800">{r.problemNumber}</p>
                          {r.memo && (
                            <p className="text-[10px] text-slate-400 italic mt-0.5">
                              メモ: {r.memo}
                            </p>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="font-mono">
                            <span className="font-bold text-slate-800">{formatSeconds(r.timeTaken)}</span>
                            {r.targetTime && (
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                目標: {r.targetTime}分 ({isAchieved ? (
                                  <span className="text-emerald-500 font-bold">達成</span>
                                ) : (
                                  <span className="text-rose-500">未達成</span>
                                )})
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-block px-2 text-[10px] py-0.5 rounded font-extrabold border ${getRankColor(r.understandingRank)}`}>
                            {r.understandingRank}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer decorative line */}
            <div className="mt-14 pt-4 border-t border-slate-150 text-center text-[9px] text-slate-400 flex justify-between items-center">
              <span>Study Tracker Pro - 学習達成証明書</span>
              <span>© 2026 All Rights Saved.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
