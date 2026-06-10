/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, FolderOpen, Hash, Calendar, Flame, AlertCircle, RefreshCw, Send, CheckCircle2, Clock, ChevronDown, X, Plus, Trash2, Edit3, Check } from 'lucide-react';
import { StudyRecord, UnderstandingRank } from '../types';
import { parseToSeconds, formatTimeJapanese, formatDigitalTime } from '../utils/time';
import { motion, AnimatePresence } from 'motion/react';
import { safeStorage } from '../utils/storage';

interface RecordFormProps {
  records: StudyRecord[];
  onSaveRecord: (newRecord: Omit<StudyRecord, 'id' | 'createdAt'>) => void;
}

export default function RecordForm({ records, onSaveRecord }: RecordFormProps) {
  // Load most recent record entry for automatic preservation
  const getMostRecentValues = () => {
    if (records.length === 0) {
      return { genre: '', workbookName: '' };
    }
    // Sort by createdAt descending
    const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt);
    return {
      genre: sorted[0].genre,
      workbookName: sorted[0].workbookName
    };
  };

  const defaults = getMostRecentValues();

  // Form State
  const [genre, setGenre] = useState<string>('');
  const [workbookName, setWorkbookName] = useState<string>('');
  const [problemNumber, setProblemNumber] = useState<string>('');
  const [learningDate, setLearningDate] = useState<string>(
    new Date().toLocaleDateString('sv-SE') // Localized YYYY-MM-DD
  );
  
  // Time Inputs: Manual mode splits into minutes & seconds
  const [timeMin, setTimeMin] = useState<string>('');
  const [timeSec, setTimeSec] = useState<string>('');

  // Target time (minutes) up to 180 min
  const [targetTime, setTargetTime] = useState<string>('');
  
  // Grade
  const [understandingRank, setUnderstandingRank] = useState<UnderstandingRank>('A');
  // Optional Memo
  const [memo, setMemo] = useState<string>('');
  
  // Form notifications
  const [successMsg, setSuccessMsg] = useState<boolean>(false);

  // Deleted suggestions states (to enable editing/deleting options from selection lists)
  const [deletedGenres, setDeletedGenres] = useState<string[]>(() => {
    try {
      return JSON.parse(safeStorage.getItem('deleted_genres') || '[]');
    } catch {
      return [];
    }
  });

  const [deletedWorkbooks, setDeletedWorkbooks] = useState<string[]>(() => {
    try {
      return JSON.parse(safeStorage.getItem('deleted_workbooks') || '[]');
    } catch {
      return [];
    }
  });

  // User custom lists of selectable options (Genres and Workbooks)
  const [genresList, setGenresList] = useState<string[]>(() => {
    let deleted: string[] = [];
    try {
      deleted = JSON.parse(safeStorage.getItem('deleted_genres') || '[]');
    } catch {}

    try {
      const stored = safeStorage.getItem('custom_genres_list');
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        return parsed.filter(g => !deleted.includes(g));
      }
    } catch {}
    
    // Default fallback: unique genres in existing records, or some defaults if records is empty
    const fromRecords = Array.from(new Set(records.map(r => r.genre).filter(Boolean)))
      .filter(g => !deleted.includes(g));
    const defaults = ['数学I', '現代文', '英語', 'プログラミング'].filter(g => !deleted.includes(g));
    return fromRecords.length > 0 ? fromRecords : defaults;
  });

  const [workbooksList, setWorkbooksList] = useState<string[]>(() => {
    let deleted: string[] = [];
    try {
      deleted = JSON.parse(safeStorage.getItem('deleted_workbooks') || '[]');
    } catch {}

    try {
      const stored = safeStorage.getItem('custom_workbooks_list');
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        return parsed.filter(w => !deleted.includes(w));
      }
    } catch {}
    
    const fromRecords = Array.from(new Set(records.map(r => r.workbookName).filter(Boolean)))
      .filter(w => !deleted.includes(w));
    const defaults = ['青チャート数学I+A', 'システム英単語', 'LeetCode'].filter(w => !deleted.includes(w));
    return fromRecords.length > 0 ? fromRecords : defaults;
  });

  // Automatically update the lists in localStorage when they change
  useEffect(() => {
    safeStorage.setItem('custom_genres_list', JSON.stringify(genresList));
  }, [genresList]);

  useEffect(() => {
    safeStorage.setItem('custom_workbooks_list', JSON.stringify(workbooksList));
  }, [workbooksList]);

  // Dynamically merge any newly loaded unique subjects/workbooks from records updates (extremely robust for Firestore async load)
  useEffect(() => {
    if (records.length > 0) {
      const uniqueGr = Array.from(new Set(records.map(r => r.genre).filter(Boolean)))
        .filter(g => !deletedGenres.includes(g));
      if (uniqueGr.length > 0) {
        setGenresList(prev => {
          const merged = [...prev];
          uniqueGr.forEach(g => {
            if (!merged.some(m => m.toLowerCase() === g.toLowerCase())) {
              merged.push(g);
            }
          });
          return merged;
        });
      }
      const uniqueWb = Array.from(new Set(records.map(r => r.workbookName).filter(Boolean)))
        .filter(w => !deletedWorkbooks.includes(w));
      if (uniqueWb.length > 0) {
        setWorkbooksList(prev => {
          const merged = [...prev];
          uniqueWb.forEach(w => {
            if (!merged.some(m => m.toLowerCase() === w.toLowerCase())) {
              merged.push(w);
            }
          });
          return merged;
        });
      }
    }
  }, [records, deletedGenres, deletedWorkbooks]);

  // Inline edit states for Genre management
  const [isEditingGenres, setIsEditingGenres] = useState<boolean>(false);
  const [editingGenreIndex, setEditingGenreIndex] = useState<number | null>(null);
  const [tempGenreName, setTempGenreName] = useState<string>('');
  const [newGenreInput, setNewGenreInput] = useState<string>('');
  const [showNewGenreForm, setShowNewGenreForm] = useState<boolean>(false);

  // Inline edit states for Workbook management
  const [isEditingWorkbooks, setIsEditingWorkbooks] = useState<boolean>(false);
  const [editingWorkbookIndex, setEditingWorkbookIndex] = useState<number | null>(null);
  const [tempWorkbookName, setTempWorkbookName] = useState<string>('');
  const [newWorkbookInput, setNewWorkbookInput] = useState<string>('');
  const [showNewWorkbookForm, setShowNewWorkbookForm] = useState<boolean>(false);

  // Auto-fill trackers
  const hasAutoFilledOnMount = useRef<boolean>(false);

  // Dropdown visibility states
  const [showGenreDropdown, setShowGenreDropdown] = useState<boolean>(false);
  const [showWorkbookDropdown, setShowWorkbookDropdown] = useState<boolean>(false);

  // Refs for tracking click outside
  const genreDropdownRef = useRef<HTMLDivElement>(null);
  const workbookDropdownRef = useRef<HTMLDivElement>(null);

  // Sync to localStorage and remove from active list
  const deleteGenreSuggestion = (g: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = [...deletedGenres, g];
    setDeletedGenres(updated);
    safeStorage.setItem('deleted_genres', JSON.stringify(updated));

    const updatedList = genresList.filter(item => item !== g);
    setGenresList(updatedList);
    if (genre === g) {
      setGenre(updatedList[0] || '');
    }
  };

  const deleteWorkbookSuggestion = (w: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = [...deletedWorkbooks, w];
    setDeletedWorkbooks(updated);
    safeStorage.setItem('deleted_workbooks', JSON.stringify(updated));

    const updatedList = workbooksList.filter(item => item !== w);
    setWorkbooksList(updatedList);
    if (workbookName === w) {
      setWorkbookName(updatedList[0] || '');
    }
  };

  // Close dropdowns on outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(event.target as Node)) {
        setShowGenreDropdown(false);
      }
      if (workbookDropdownRef.current && !workbookDropdownRef.current.contains(event.target as Node)) {
        setShowWorkbookDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-fill from most recent records on mount, or fallback to first items of custom list
  useEffect(() => {
    if (!hasAutoFilledOnMount.current) {
      if (records.length > 0) {
        const recent = getMostRecentValues();
        if (recent.genre) setGenre(recent.genre);
        if (recent.workbookName) setWorkbookName(recent.workbookName);
      }
      // Fallback selection to the first items of custom selection lists if still empty
      setGenre(prev => prev.trim() ? prev : (genresList[0] || ''));
      setWorkbookName(prev => prev.trim() ? prev : (workbooksList[0] || ''));
      hasAutoFilledOnMount.current = true;
    }
  }, [records, genresList, workbooksList]);

  // Keep synced to the first item of selection lists whenever they become completely empty
  // (e.g. after selection lists change, or active input becomes empty when unfocused)
  useEffect(() => {
    const activeEl = document.activeElement;
    if (activeEl?.id !== 'input-genre' && !genre.trim() && genresList.length > 0) {
      setGenre(genresList[0]);
    }
  }, [genre, genresList]);

  useEffect(() => {
    const activeEl = document.activeElement;
    if (activeEl?.id !== 'input-workbook-name' && !workbookName.trim() && workbooksList.length > 0) {
      setWorkbookName(workbooksList[0]);
    }
  }, [workbookName, workbooksList]);

  // Ref to track the last auto-filled problem key to prevent overwriting user's manual edits
  const lastAutoFilledKeyRef = useRef<string>('');

  // Automatically pre-fill the previously set target time when combination exists
  useEffect(() => {
    const trimmedGenre = genre.trim();
    const trimmedWorkbook = workbookName.trim();
    const trimmedProblem = problemNumber.trim();

    if (!trimmedGenre || !trimmedWorkbook || !trimmedProblem) {
      lastAutoFilledKeyRef.current = '';
      return;
    }

    const key = `${trimmedGenre.toLowerCase()}|${trimmedWorkbook.toLowerCase()}|${trimmedProblem.toLowerCase()}`;
    
    // Only auto-fill if the active user selection transitions to a completely new key
    if (lastAutoFilledKeyRef.current !== key) {
      const keyAttempts = records
        .filter(r => {
          const rKey = `${r.genre.trim().toLowerCase()}|${r.workbookName.trim().toLowerCase()}|${r.problemNumber.trim().toLowerCase()}`;
          return rKey === key;
        })
        .sort((a, b) => b.createdAt - a.createdAt); // newest first

      if (keyAttempts.length > 0) {
        // Find if a prior target time was specified
        const lastWithTarget = keyAttempts.find(r => r.targetTime !== undefined && r.targetTime !== null && r.targetTime !== 0);
        if (lastWithTarget && lastWithTarget.targetTime) {
          setTargetTime(lastWithTarget.targetTime.toString());
        }
      }
      lastAutoFilledKeyRef.current = key;
    }
  }, [genre, workbookName, problemNumber, records]);

  // Extract unique items for quick suggestion chips
  const uniqueGenres = Array.from(new Set(records.map(r => r.genre).filter(Boolean)))
    .filter(g => !deletedGenres.includes(g));
  const uniqueWorkbooks = Array.from(new Set(records.map(r => r.workbookName).filter(Boolean)))
    .filter(w => !deletedWorkbooks.includes(w));

  const filteredGenres = uniqueGenres.filter(g => 
    g.toLowerCase().includes(genre.trim().toLowerCase())
  );
  const filteredWorkbooks = uniqueWorkbooks.filter(w => 
    w.toLowerCase().includes(workbookName.trim().toLowerCase())
  );

  // Calculate matching attempts for the current input combination
  const currentKey = `${genre.trim().toLowerCase()}|${workbookName.trim().toLowerCase()}|${problemNumber.trim().toLowerCase()}`;
  const previousAttempts = problemNumber.trim() ? records.filter(r => {
    const key = `${r.genre.trim().toLowerCase()}|${r.workbookName.trim().toLowerCase()}|${r.problemNumber.trim().toLowerCase()}`;
    return key === currentKey;
  }).sort((a, b) => a.createdAt - b.createdAt) : []; // oldest to newest

  const isRepeatedProblem = previousAttempts.length > 0;
  const nextAttemptCount = previousAttempts.length + 1;
  const lastAttempt = isRepeatedProblem ? previousAttempts[previousAttempts.length - 1] : null;

  // Preset Date Helper Buttons
  const setPresetDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setLearningDate(d.toLocaleDateString('sv-SE'));
  };

  const getRankConfig = (rank: UnderstandingRank) => {
    switch (rank) {
      case 'S': return { bg: 'bg-purple-50 border-purple-300 text-purple-800 hover:bg-purple-100', active: 'bg-purple-600 text-white border-purple-600 ring-4 ring-purple-100', label: 'S', desc: '非の打ち所なし！', detail: '非の打ち所がないほど完璧！' };
      case 'A': return { bg: 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100', active: 'bg-red-600 text-white border-red-600 ring-4 ring-red-100', label: 'A', desc: '正解したが不安', detail: '正解したが少し不安' };
      case 'B': return { bg: 'bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100', active: 'bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100', label: 'B', desc: 'あともう少し…', detail: 'あともう少しで正解だった...' };
      case 'C': return { bg: 'bg-yellow-50 border-yellow-300 text-yellow-800 hover:bg-yellow-100', active: 'bg-yellow-500 text-white border-yellow-500 ring-4 ring-yellow-100', label: 'C', desc: '解き方は分かる', detail: '解き方は分かるが出力できなかった' };
      case 'D': return { bg: 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200', active: 'bg-slate-600 text-white border-slate-600 ring-4 ring-slate-200', label: 'D', desc: 'さっぱり不明', detail: 'さっぱり不明' };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!genre.trim() || !workbookName.trim() || !problemNumber.trim()) {
      return;
    }

    const totalSeconds = parseToSeconds(timeMin, timeSec);
    const targetMin = targetTime.trim() ? parseInt(targetTime, 10) : undefined;

    onSaveRecord({
      genre: genre.trim(),
      workbookName: workbookName.trim(),
      problemNumber: problemNumber.trim(),
      learningDate,
      timeTaken: totalSeconds,
      targetTime: targetMin,
      understandingRank,
      memo: memo.trim() || undefined
    });

    // Auto-add new entries to selection lists if not already there
    const trimmedGenre = genre.trim();
    if (trimmedGenre && !genresList.some(g => g.toLowerCase() === trimmedGenre.toLowerCase())) {
      setGenresList(prev => [...prev, trimmedGenre]);
    }
    const trimmedWorkbook = workbookName.trim();
    if (trimmedWorkbook && !workbooksList.some(w => w.toLowerCase() === trimmedWorkbook.toLowerCase())) {
      setWorkbooksList(prev => [...prev, trimmedWorkbook]);
    }

    // Reset Form (Keeping genre and workbookName as they are automatically saved for next inputs)
    setProblemNumber('');
    setTimeMin('');
    setTimeSec('');
    setTargetTime('');
    setMemo('');
    setSuccessMsg(true);
    
    setTimeout(() => {
      setSuccessMsg(false);
    }, 3000);
  };

  const todayStr = new Date().toLocaleDateString('sv-SE');
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('sv-SE');
  })();
  const dayBeforeYesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toLocaleDateString('sv-SE');
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Input Form Column */}
      <div className="lg:col-span-2 space-y-6">
        <form id="study-record-form" onSubmit={handleSubmit} className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-6 relative overflow-hidden">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-800">学習結果を記録</h2>
              <p className="text-xs text-slate-500 mt-1">問題のジャンルや問題集は、前回の内容が自動的に引き継がれます。</p>
            </div>
            
            <AnimatePresence>
              {successMsg && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-emerald-100 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>記録を保存しました！</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-5">
            {/* Genre Input */}
            <div ref={genreDropdownRef} className="relative">
              <label htmlFor="input-genre" className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>問題のジャンル <span className="text-red-500 font-bold">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="input-genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  onBlur={(e) => {
                    if (!e.target.value.trim() && genresList.length > 0) {
                      setGenre(genresList[0]);
                    }
                  }}
                  placeholder="例: 数学I、現代文、Pythonプログラミング"
                  required
                  autoComplete="off"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm font-semibold text-slate-800"
                />
              </div>

              {/* Custom Genre Quick Selection below input field */}
              <div id="genre-custom-selection-container" className="mt-2 text-left">
                <div className="flex items-center justify-between mb-1 py-0.5">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">ジャンルをワンクリックで選択</span>
                </div>

                <div translate="no" className="flex flex-wrap gap-1.5 items-center notranslate">
                  {!isEditingGenres ? (
                    <>
                      {(() => {
                        const displayGenres = [...genresList];
                        const trimmedGenre = genre.trim();
                        if (trimmedGenre && !displayGenres.some(g => g.trim().toLowerCase() === trimmedGenre.toLowerCase())) {
                          displayGenres.push(genre);
                        }
                        return displayGenres.map((g) => {
                          const isActive = genre.trim() === g.trim();
                          const isNewOption = !genresList.some(item => item.trim().toLowerCase() === g.trim().toLowerCase());
                          return (
                            <div
                              key={g}
                              className={`inline-flex items-center gap-1 text-[11px] pl-2.5 pr-1.5 py-1 rounded-full border transition-all font-semibold ${
                                isActive
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-800'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setGenre(g)}
                                className="focus:outline-hidden cursor-pointer"
                              >
                                {g}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (isNewOption) {
                                    setGenre('');
                                  } else {
                                    deleteGenreSuggestion(g, e);
                                  }
                                }}
                                className={`rounded-full p-0.5 hover:bg-black/10 transition-colors cursor-pointer ${
                                  isActive ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                                }`}
                                title={isNewOption ? "クリア" : "消去"}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        });
                      })()}
                      {genresList.length === 0 && !genre.trim() && (
                        <p className="text-[11px] text-slate-400 italic">ジャンルを入力または選択してください</p>
                      )}
                    </>
                  ) : (
                    <>
                      {genresList.map((g, index) => {
                        if (editingGenreIndex === index) {
                          return (
                            <div key={index} className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg p-1">
                              <input
                                type="text"
                                value={tempGenreName}
                                onChange={(e) => setTempGenreName(e.target.value)}
                                className="px-1.5 py-0.5 text-[11px] bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-24 font-normal"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (tempGenreName.trim()) {
                                      const updated = [...genresList];
                                      updated[index] = tempGenreName.trim();
                                      setGenresList(updated);
                                      if (genre === genresList[index]) {
                                        setGenre(tempGenreName.trim());
                                      }
                                    }
                                    setEditingGenreIndex(null);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (tempGenreName.trim()) {
                                    const updated = [...genresList];
                                    updated[index] = tempGenreName.trim();
                                    setGenresList(updated);
                                    if (genre === genresList[index]) {
                                      setGenre(tempGenreName.trim());
                                    }
                                  }
                                  setEditingGenreIndex(null);
                                }}
                                className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded-sm hover:bg-emerald-50 transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingGenreIndex(null)}
                                className="text-slate-400 hover:text-slate-500 p-0.5 rounded-sm hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div key={g} className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
                            <span className="text-[11px] font-semibold">{g}</span>
                            <div className="flex items-center ml-1 border-l border-slate-200 pl-1 gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingGenreIndex(index);
                                  setTempGenreName(g);
                                }}
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded-sm transition-colors cursor-pointer"
                                title="名称変更"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const targetToDelete = genresList[index];
                                  deleteGenreSuggestion(targetToDelete);
                                }}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded-sm transition-colors cursor-pointer"
                                title="削除"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {showNewGenreForm ? (
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg p-1">
                          <input
                            type="text"
                            value={newGenreInput}
                            onChange={(e) => setNewGenreInput(e.target.value)}
                            placeholder="新規項目名"
                            className="px-1.5 py-0.5 text-[11px] bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-24 font-normal"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newGenreInput.trim()) {
                                  setGenresList([...genresList, newGenreInput.trim()]);
                                  setNewGenreInput('');
                                  setShowNewGenreForm(false);
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newGenreInput.trim()) {
                                setGenresList([...genresList, newGenreInput.trim()]);
                                setNewGenreInput('');
                                setShowNewGenreForm(false);
                              }
                            }}
                            className="text-indigo-600 hover:text-indigo-700 p-0.5 rounded-sm hover:bg-indigo-50 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewGenreInput('');
                              setShowNewGenreForm(false);
                            }}
                            className="text-slate-400 hover:text-slate-500 p-0.5 rounded-sm hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowNewGenreForm(true)}
                          className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>新規追加</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Workbook Name Input */}
            <div ref={workbookDropdownRef} className="relative">
              <label htmlFor="input-workbook-name" className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>問題集名 / 教材名 <span className="text-red-500 font-bold">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="input-workbook-name"
                  value={workbookName}
                  onChange={(e) => setWorkbookName(e.target.value)}
                  onBlur={(e) => {
                    if (!e.target.value.trim() && workbooksList.length > 0) {
                      setWorkbookName(workbooksList[0]);
                    }
                  }}
                  placeholder="例: 青チャート数学I+A、システム英単語、LeetCode"
                  required
                  autoComplete="off"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm font-semibold text-slate-800"
                />
              </div>

              {/* Custom Workbook Quick Selection below input field */}
              <div id="workbook-custom-selection-container" className="mt-2 text-left">
                <div className="flex items-center justify-between mb-1 py-0.5">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">教材をワンクリックで選択</span>
                </div>

                <div translate="no" className="flex flex-wrap gap-1.5 items-center notranslate">
                  {!isEditingWorkbooks ? (
                    <>
                      {(() => {
                        const displayWorkbooks = [...workbooksList];
                        const trimmedWorkbook = workbookName.trim();
                        if (trimmedWorkbook && !displayWorkbooks.some(w => w.trim().toLowerCase() === trimmedWorkbook.toLowerCase())) {
                          displayWorkbooks.push(workbookName);
                        }
                        return displayWorkbooks.map((w) => {
                          const isActive = workbookName.trim() === w.trim();
                          const isNewOption = !workbooksList.some(item => item.trim().toLowerCase() === w.trim().toLowerCase());
                          return (
                            <div
                              key={w}
                              className={`inline-flex items-center gap-1 text-[11px] pl-2.5 pr-1.5 py-1 rounded-full border transition-all font-semibold ${
                                isActive
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-800'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setWorkbookName(w)}
                                className="focus:outline-hidden cursor-pointer"
                              >
                                {w}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (isNewOption) {
                                    setWorkbookName('');
                                  } else {
                                    deleteWorkbookSuggestion(w, e);
                                  }
                                }}
                                className={`rounded-full p-0.5 hover:bg-black/10 transition-colors cursor-pointer ${
                                  isActive ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                                }`}
                                title={isNewOption ? "クリア" : "消去"}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        });
                      })()}
                      {workbooksList.length === 0 && !workbookName.trim() && (
                        <p className="text-[11px] text-slate-400 italic">教材を入力または選択してください</p>
                      )}
                    </>
                  ) : (
                    <>
                      {workbooksList.map((w, index) => {
                        if (editingWorkbookIndex === index) {
                          return (
                            <div key={index} className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg p-1">
                              <input
                                type="text"
                                value={tempWorkbookName}
                                onChange={(e) => setTempWorkbookName(e.target.value)}
                                className="px-1.5 py-0.5 text-[11px] bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-24 font-normal"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (tempWorkbookName.trim()) {
                                      const updated = [...workbooksList];
                                      updated[index] = tempWorkbookName.trim();
                                      setWorkbooksList(updated);
                                      if (workbookName === workbooksList[index]) {
                                        setWorkbookName(tempWorkbookName.trim());
                                      }
                                    }
                                    setEditingWorkbookIndex(null);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (tempWorkbookName.trim()) {
                                    const updated = [...workbooksList];
                                    updated[index] = tempWorkbookName.trim();
                                    setWorkbooksList(updated);
                                    if (workbookName === workbooksList[index]) {
                                      setWorkbookName(tempWorkbookName.trim());
                                    }
                                  }
                                  setEditingWorkbookIndex(null);
                                }}
                                className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded-sm hover:bg-emerald-50 transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingWorkbookIndex(null)}
                                className="text-slate-400 hover:text-slate-500 p-0.5 rounded-sm hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div key={w} className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
                            <span className="text-[11px] font-semibold">{w}</span>
                            <div className="flex items-center ml-1 border-l border-slate-200 pl-1 gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingWorkbookIndex(index);
                                  setTempWorkbookName(w);
                                }}
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded-sm transition-colors cursor-pointer"
                                title="名称変更"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const targetToDelete = workbooksList[index];
                                  deleteWorkbookSuggestion(targetToDelete);
                                }}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded-sm transition-colors cursor-pointer"
                                title="削除"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {showNewWorkbookForm ? (
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg p-1">
                          <input
                            type="text"
                            value={newWorkbookInput}
                            onChange={(e) => setNewWorkbookInput(e.target.value)}
                            placeholder="新規教材名"
                            className="px-1.5 py-0.5 text-[11px] bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-24 font-normal"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newWorkbookInput.trim()) {
                                  setWorkbooksList([...workbooksList, newWorkbookInput.trim()]);
                                  setNewWorkbookInput('');
                                  setShowNewWorkbookForm(false);
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newWorkbookInput.trim()) {
                                setWorkbooksList([...workbooksList, newWorkbookInput.trim()]);
                                setNewWorkbookInput('');
                                setShowNewWorkbookForm(false);
                              }
                            }}
                            className="text-indigo-600 hover:text-indigo-700 p-0.5 rounded-sm hover:bg-indigo-50 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewWorkbookInput('');
                              setShowNewWorkbookForm(false);
                            }}
                            className="text-slate-400 hover:text-slate-500 p-0.5 rounded-sm hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowNewWorkbookForm(true)}
                          className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>新規追加</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Problem Number Input */}
            <div>
              <label htmlFor="input-problem-number" className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>問題番号 / 箇所 <span className="text-red-500 font-bold">*</span></span>
              </label>
              <input
                type="text"
                id="input-problem-number"
                value={problemNumber}
                onChange={(e) => setProblemNumber(e.target.value)}
                placeholder="例：問題１"
                required
                className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm font-semibold text-slate-800"
              />
            </div>

            {/* Date Field row */}
            <div>
              {/* Learning Date */}
              <label htmlFor="input-learning-date" className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>学習日 <span className="text-red-500 font-bold">*</span></span>
              </label>
              <input
                type="date"
                id="input-learning-date"
                value={learningDate}
                onChange={(e) => setLearningDate(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm text-slate-700"
              />
              <div className="flex gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => setPresetDate(0)}
                  className={`text-[10px] px-2.5 py-0.5 rounded border transition-all cursor-pointer font-bold ${
                    learningDate === todayStr
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  今日
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDate(1)}
                  className={`text-[10px] px-2.5 py-0.5 rounded border transition-all cursor-pointer font-bold ${
                    learningDate === yesterdayStr
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  昨日
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDate(2)}
                  className={`text-[10px] px-2.5 py-0.5 rounded border transition-all cursor-pointer font-bold ${
                    learningDate === dayBeforeYesterdayStr
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  一昨日
                </button>
              </div>
            </div>

            {/* Understanding level Rank */}
            <div>
              <span className="block text-xs font-semibold text-slate-600 mb-2.5 flex items-center gap-1.5">
                <span>🎯 理解度のランクを選択</span>
              </span>
              <div className="grid grid-cols-5 gap-2">
                {(['S', 'A', 'B', 'C', 'D'] as UnderstandingRank[]).map((r) => {
                  const active = understandingRank === r;
                  const cfg = getRankConfig(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setUnderstandingRank(r)}
                      id={`btn-rank-${r}`}
                      className={`py-3 px-1.5 rounded-2xl border text-center flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${
                        active ? cfg.active : cfg.bg
                      }`}
                    >
                      <span className="text-lg font-bold tracking-tight">{cfg.label}</span>
                      <span className="text-[9px] mt-1.5 font-semibold opacity-90 truncate max-w-full">
                        {cfg.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-slate-500 text-[11px] mt-2.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 italic transition-all">
                選択したランク: <strong>{understandingRank}</strong> - {getRankConfig(understandingRank).detail}
              </p>
            </div>

            {/* Optional Memo */}
            <div>
              <label htmlFor="input-memo" className="block text-xs font-semibold text-slate-600 mb-2">
                ✏️ 学習メモ・気づき (任意)
              </label>
              <textarea
                id="input-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例：○○で手が止まってしまった。"
                rows={2}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm"
              />
            </div>
          </div>

        </form>
      </div>

      {/* Side Utilities (Manual Time & Target Setting, Real-time Comparison Preview) */}
      <div className="space-y-6">
        {/* Manual Time & Target Input Dedicated Card */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-indigo-500" />
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">⏱️ タイム・目標タイム</h3>
            </div>
          </div>

          <div className="space-y-4">
            {/* 実際に解いたタイム */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600">
                <span>① 解いたタイム <span className="text-red-500">*</span></span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center bg-white border border-slate-200 rounded-lg px-3 py-2 w-full transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-600 font-mono">
                  <input
                    type="number"
                    min="0"
                    id="input-time-min"
                    value={timeMin}
                    onChange={(e) => setTimeMin(e.target.value)}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val && !isNaN(parseInt(val))) {
                        setTimeMin(parseInt(val, 10).toString().padStart(2, '0'));
                      }
                    }}
                    placeholder="00"
                    required
                    className="w-16 text-center bg-transparent border-0 focus:outline-hidden focus:ring-0 text-base font-bold text-slate-800 placeholder-slate-300"
                  />
                  <span className="text-slate-400 font-bold text-lg select-none px-1.5">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    id="input-time-sec"
                    value={timeSec}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                        setTimeSec(val);
                      }
                    }}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val && !isNaN(parseInt(val))) {
                        setTimeSec(parseInt(val, 10).toString().padStart(2, '0'));
                      }
                    }}
                    placeholder="00"
                    required
                    className="w-16 text-center bg-transparent border-0 focus:outline-hidden focus:ring-0 text-base font-bold text-slate-800 placeholder-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* 目標タイム */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="block text-[11px] font-bold text-slate-600">
                  <span>② 目標タイム (任意)</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">最大180分</span>
              </div>
              
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 w-full transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-600">
                <input
                  type="number"
                  min="1"
                  max="180"
                  id="input-target-time"
                  value={targetTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setTargetTime('');
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num >= 1 && num <= 180) {
                        setTargetTime(num.toString());
                      } else if (num > 180) {
                        setTargetTime('180');
                      }
                    }
                  }}
                  placeholder="未設定"
                  className="w-full text-right bg-transparent border-0 focus:outline-hidden focus:ring-0 text-sm font-bold text-slate-800"
                />
                <span className="text-xs text-slate-500 ml-1.5 font-semibold shrink-0">分</span>
              </div>

              {/* Goal preset pills */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[5, 10, 15, 30, 45, 60, 90, 120, 180].map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setTargetTime(t.toString())}
                    className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      targetTime === t.toString()
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-200/60 hover:bg-slate-200 text-slate-600 font-medium'
                    }`}
                  >
                    {t}分
                  </button>
                ))}
                {targetTime && (
                  <button
                    type="button"
                    onClick={() => setTargetTime('')}
                    className="text-[10px] px-2 py-0.5 bg-slate-200 hover:bg-rose-100 hover:text-rose-600 text-slate-500 font-medium rounded cursor-pointer"
                  >
                    解除
                  </button>
                )}
              </div>
            </div>

            {/* Dynamic comparing results indicator */}
            {timeMin && targetTime && (() => {
              const actualSec = parseToSeconds(timeMin, timeSec);
              const targetSec = parseInt(targetTime, 10) * 60;
              const diffSec = targetSec - actualSec;
              const diffAbsStr = formatDigitalTime(Math.abs(diffSec));

              return (
                <div className={`p-3 rounded-xl text-xs flex items-start gap-1.5 border leading-relaxed ${
                  diffSec >= 0 
                    ? 'bg-emerald-50/70 border-emerald-100 text-emerald-800' 
                    : 'bg-rose-50/70 border-rose-100 text-rose-800'
                }`}>
                  <span className="text-sm shrink-0">{diffSec >= 0 ? '🎉' : '⏱️'}</span>
                  <div>
                    {diffSec >= 0 ? (
                      <span><strong>目標達成！</strong> 目標より <strong className="font-mono text-emerald-600">{diffAbsStr}</strong> 早く解き終えました。</span>
                    ) : (
                      <span>目標タイムを <strong className="font-mono text-rose-600">{diffAbsStr}</strong> 超過しています。次回スピードアップ！</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 記録保存ボタン */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 flex items-center justify-center shadow-xs">
          <button
            type="submit"
            id="btn-save-record"
            form="study-record-form"
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>記録を保存する</span>
          </button>
        </div>

        {/* Real-time previous attempts detection */}
        <AnimatePresence mode="wait">
          {problemNumber.trim() ? (
            <motion.div
              key={isRepeatedProblem ? `${genre}-${workbookName}-${problemNumber}-repeated` : 'new-card'}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className={`rounded-2xl p-5 border text-sm transition-all shadow-xs ${
                isRepeatedProblem 
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {isRepeatedProblem ? (
                  <Flame className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                )}
                
                <div className="space-y-3 w-full">
                  <div>
                    <h3 className="font-bold text-sm">
                      {isRepeatedProblem ? (
                        <span>
                          学習回数を自動カウント: <span className="text-lg text-amber-700 underline font-display decoration-2">{nextAttemptCount}回目</span> の学習
                        </span>
                      ) : (
                        <span>今回の問題は初めて記録します</span>
                      )}
                    </h3>
                    <p className="text-xs mt-1 text-slate-500 leading-relaxed font-semibold">
                      {genre && workbookName ? `「${genre}」の『${workbookName}』` : 'ジャンル名・問題集名'}の【{problemNumber}】について
                    </p>
                  </div>



                  {isRepeatedProblem ? (
                    <p className="text-[11px] text-amber-800 bg-amber-100/50 px-2.5 py-1.5 rounded-lg border border-amber-100 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-amber-600 animate-spin-slow" />
                      <span>保存すると自動で回数がカウントされ、進捗履歴に登録されます。</span>
                    </p>
                  ) : (
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      問題集を解き進めて同じ番号を再挑戦した際、自動で「何回目か」をカウントして記録を重ねていきます。
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-center text-slate-400">
              <BookOpen className="w-7 h-7 mx-auto mb-2 opacity-50 text-slate-400" />
              <p className="font-medium text-xs">問題番号を入力すると、自動的な学習回数の判定と前回比較がここを連動して表示されます。</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
