/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StudyRecord, ProblemSummary } from './types';
import RecordForm from './components/RecordForm';
import HistoryDashboard from './components/HistoryDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { BookMarked, History, RefreshCw, PenTool, Database, Sparkles, HelpCircle, BarChart3, Clock, AlertCircle, Cloud, CloudOff, LogOut, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithPopup, signOut, googleProvider, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { safeStorage } from './utils/storage';
import { Analytics } from '@vercel/analytics/react';

// Beautiful seed data to show features on first load
const SEED_RECORDS: StudyRecord[] = [
  {
    id: 'seed-1',
    genre: '数学I',
    workbookName: '青チャート 数学I+A',
    problemNumber: '例題24 (2次関数の最大値)',
    learningDate: '2026-06-01',
    timeTaken: 420, // 7m 00s
    targetTime: 10, // 10m
    understandingRank: 'C',
    memo: '平方完成のやり方をど忘れ。解説と公式をしっかり見直した。',
    createdAt: new Date('2026-06-01T10:00:00Z').getTime()
  },
  {
    id: 'seed-2',
    genre: '数学I',
    workbookName: '青チャート 数学I+A',
    problemNumber: '例題24 (2次関数の最大値)',
    learningDate: '2026-06-05',
    timeTaken: 240, // 4m 00s
    targetTime: 5, // 5m
    understandingRank: 'B',
    memo: '自力で平方完成してグラフを描けた！ただ、端点での値評価に時間を取られた。',
    createdAt: new Date('2026-06-05T14:30:00Z').getTime()
  },
  {
    id: 'seed-3',
    genre: '数学I',
    workbookName: '青チャート 数学I+A',
    problemNumber: '例題24 (2次関数の最大値)',
    learningDate: '2026-06-08',
    timeTaken: 120, // 2m 00s
    targetTime: 3, // 3m
    understandingRank: 'S',
    memo: '完璧！迷うことなく一瞬で解を導け、計算も大幅に短縮できた！',
    createdAt: new Date('2026-06-08T09:15:00Z').getTime()
  },
  {
    id: 'seed-4',
    genre: '英語',
    workbookName: 'システム英単語',
    problemNumber: 'Stage 1 (No.1-50)',
    learningDate: '2026-06-02',
    timeTaken: 180, // 3m 00s
    targetTime: 4, // 4m
    understandingRank: 'B',
    memo: '数問、思い出すまでに5秒以上かかった単語があった。',
    createdAt: new Date('2026-06-02T16:00:00Z').getTime()
  },
  {
    id: 'seed-5',
    genre: '英語',
    workbookName: 'システム英単語',
    problemNumber: 'Stage 1 (No.1-50)',
    learningDate: '2026-06-07',
    timeTaken: 95, // 1m 35s
    targetTime: 2, // 2m
    understandingRank: 'A',
    memo: 'テンポよく訳せた。1問だけスペルミスあり。次は満点狙い。',
    createdAt: new Date('2026-06-07T11:20:00Z').getTime()
  },
  {
    id: 'seed-6',
    genre: 'プログラミング',
    workbookName: 'LeetCode',
    problemNumber: 'Q1 (Two Sum)',
    learningDate: '2026-06-03',
    timeTaken: 600, // 10m 00s
    targetTime: 8, // 8m (fail)
    understandingRank: 'A',
    memo: 'ハッシュマップを使用したO(N)解法でクリア。境界条件の確認を忘れずに。',
    createdAt: new Date('2026-06-03T21:45:00Z').getTime()
  }
];

export default function App() {
  const [records, setRecords] = useState<StudyRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'analytics'>('create');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Firebase auth & sync states
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [syncingFirestore, setSyncingFirestore] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName = weekdays[date.getDay()];
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}（${dayName}）${hh}:${min}:${ss}`;
  };
  
  // Real-time Auth Listening & Cloud Synchronizing
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        setSyncingFirestore(true);
        try {
          // 1. Sync & Pull User preferences (Genre and Workbook suggestions list)
          const prefDocRef = doc(db, 'users', currentUser.uid, 'preferences', 'main');
          const prefDocSnap = await getDoc(prefDocRef);
          if (prefDocSnap.exists()) {
            const data = prefDocSnap.data();
            if (data.customGenres) {
              safeStorage.setItem('custom_genres_list', JSON.stringify(data.customGenres));
            }
            if (data.customWorkbooks) {
              safeStorage.setItem('custom_workbooks_list', JSON.stringify(data.customWorkbooks));
            }
          } else {
            // First-time fallback sync
            const localGenres = safeStorage.getItem('custom_genres_list');
            const localWorkbooks = safeStorage.getItem('custom_workbooks_list');
            const genres = localGenres ? JSON.parse(localGenres) : ['数学I', '現代文', '英語', 'プログラミング'];
            const workbooks = localWorkbooks ? JSON.parse(localWorkbooks) : ['青チャート数学I+A', 'システム英単語', 'LeetCode'];
            await setDoc(prefDocRef, {
              userId: currentUser.uid,
              customGenres: genres,
              customWorkbooks: workbooks,
              updatedAt: Date.now()
            });
          }

          // 2. Real-time Firebase Firestore synchronizer for study records
          const recordsColRef = collection(db, 'users', currentUser.uid, 'records');
          const unsubscribeRecords = onSnapshot(recordsColRef, async (snapshot) => {
            const fbRecords: StudyRecord[] = [];
            snapshot.forEach((snapDoc) => {
              fbRecords.push(snapDoc.data() as StudyRecord);
            });

            // Sort by createdAt ascending natively
            const sortedRecords = fbRecords.sort((a, b) => a.createdAt - b.createdAt);

            if (snapshot.empty) {
              // Upload existing local offline data to Cloud on first auth registration
              const rawLocal = safeStorage.getItem('study_tracker_records');
              if (rawLocal) {
                try {
                  const localRecs: StudyRecord[] = JSON.parse(rawLocal);
                  if (localRecs.length > 0) {
                    const batch = writeBatch(db);
                    localRecs.forEach((r) => {
                      const rDoc = doc(db, 'users', currentUser.uid, 'records', r.id);
                      batch.set(rDoc, {
                        ...r,
                        userId: currentUser.uid
                      });
                    });
                    await batch.commit();
                  }
                } catch (e) {
                  console.error('Error migrating offline records', e);
                }
              }
            } else {
              setRecords(sortedRecords);
            }
            setSyncingFirestore(false);
          }, (err) => {
            handleFirestoreError(err, OperationType.LIST, `users/${currentUser.uid}/records`);
            setSyncingFirestore(false);
          });

          return () => {
            unsubscribeRecords();
          };
        } catch (error) {
          console.error("Connection synchronization error", error);
          setSyncingFirestore(false);
        }
      } else {
        // Safe Guest Mode: load backup records
        const raw = safeStorage.getItem('study_tracker_records');
        if (raw) {
          try {
            setRecords(JSON.parse(raw));
          } catch (e) {
            setRecords(SEED_RECORDS);
          }
        } else {
          setRecords(SEED_RECORDS);
          safeStorage.setItem('study_tracker_records', JSON.stringify(SEED_RECORDS));
        }
        setSyncingFirestore(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Save changes helper (synced to state & local-cache fallback)
  const saveRecords = (updatedRecords: StudyRecord[]) => {
    setRecords(updatedRecords);
    safeStorage.setItem('study_tracker_records', JSON.stringify(updatedRecords));
  };

  // Safe elegant custom dialog overlay config
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const requestConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    isDanger = false,
    confirmText = 'はい',
    cancelText = 'キャンセル'
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      confirmText,
      cancelText,
      isDanger,
    });
  };

  // Auth Operations
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error('Sign-in failed', e);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Sign-out failed', e);
    }
  };

  // Create record
  const handleSaveRecord = async (newVal: Omit<StudyRecord, 'id' | 'createdAt'>) => {
    const freshRecord: StudyRecord = {
      ...newVal,
      id: `rc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now()
    };

    if (user) {
      try {
        const recordDocRef = doc(db, 'users', user.uid, 'records', freshRecord.id);
        await setDoc(recordDocRef, {
          ...freshRecord,
          userId: user.uid
        });

        // Sync local customized suggestions back to user preference endpoint
        const localGenres = safeStorage.getItem('custom_genres_list');
        const localWorkbooks = safeStorage.getItem('custom_workbooks_list');
        const genres = localGenres ? JSON.parse(localGenres) : [];
        const workbooks = localWorkbooks ? JSON.parse(localWorkbooks) : [];
        const prefDocRef = doc(db, 'users', user.uid, 'preferences', 'main');
        await setDoc(prefDocRef, {
          userId: user.uid,
          customGenres: genres,
          customWorkbooks: workbooks,
          updatedAt: Date.now()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/records/${freshRecord.id}`);
      }
    } else {
      const nextArr = [...records, freshRecord];
      saveRecords(nextArr);
    }
  };

  // Delete record
  const handleDeleteRecord = (id: string) => {
    requestConfirmation(
      '記録の削除確認',
      'この学習記録を本当に削除しますか？この操作は取り消せません。',
      async () => {
        if (user) {
          try {
            const recordDocRef = doc(db, 'users', user.uid, 'records', id);
            await deleteDoc(recordDocRef);
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/records/${id}`);
          }
        } else {
          const filtered = records.filter(r => r.id !== id);
          saveRecords(filtered);
        }
      },
      true,
      '削除する'
    );
  };

  // Reset helper
  const handleResetRecords = () => {
    requestConfirmation(
      '全学習履歴の初期化',
      '保存されているすべての学習記録を初期化（完全に削除）しますか？（※追加されたジャンル・問題集は保持されます）',
      async () => {
        if (user) {
          try {
            const recordsColRef = collection(db, 'users', user.uid, 'records');
            const snap = await getDocs(recordsColRef);
            const batch = writeBatch(db);
            snap.forEach((d) => {
              batch.delete(d.ref);
            });
            await batch.commit();
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/records`);
          }
        }

        saveRecords([]);
      },
      true,
      '初期化する'
    );
  };

  // Load Seed data
  const handleLoadSeedRecords = () => {
    requestConfirmation(
      'サンプルデータの追加',
      '検証用のデモ・サンプルデータを追加しますか？(現在の履歴に追加されます)',
      async () => {
        const generatedSeed = SEED_RECORDS.map(r => ({
          ...r,
          id: `rc-seed-copy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: Date.now() + Math.floor(Math.random() * 1000)
        }));

        if (user) {
          try {
            const batch = writeBatch(db);
            generatedSeed.forEach((r) => {
              const rDocRef = doc(db, 'users', user.uid, 'records', r.id);
              batch.set(rDocRef, {
                ...r,
                userId: user.uid
              });
            });
            await batch.commit();
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/records`);
          }
        } else {
          const merged = [...records, ...generatedSeed];
          saveRecords(merged);
        }
      },
      false,
      'デモデータを追加'
    );
  };

  // Export records helper
  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `study_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // High density dynamic sidebar calculations
  const getMostRecentValues = () => {
    if (records.length === 0) {
      return { genre: '（未登録）', workbookName: '（未登録）' };
    }
    const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt);
    return {
      genre: sorted[0].genre,
      workbookName: sorted[0].workbookName
    };
  };

  const contextInfo = getMostRecentValues();

  // Statistics calculations for today (2026-06-09) and overall if empty
  const todayStr = '2026-06-09';
  const todayRecords = records.filter(r => r.learningDate === todayStr);

  const stats = {
    todayCount: todayRecords.length,
    targetAchievementRate: (() => {
      const recordsWithTarget = records.filter(r => r.targetTime !== undefined && r.targetTime !== null && Number(r.targetTime) > 0);
      if (recordsWithTarget.length === 0) return null;
      const metCount = recordsWithTarget.filter(r => r.timeTaken <= Number(r.targetTime) * 60).length;
      return Math.round((metCount / recordsWithTarget.length) * 100);
    })(),
    totalCount: records.length,
    uniquesCount: new Set(records.map(r => `${r.genre}|${r.workbookName}|${r.problemNumber}`)).size
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row font-sans">
      
      {/* High Density Left Sidebar: Session Info & Persistent stats */}
      <aside className="w-full lg:w-72 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-950">
        
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
            <h1 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Study Tracker Pro</h1>
          </div>
          <p className="text-lg font-bold font-display tracking-tight text-white flex items-center justify-between">
            <span>学習進捗管理</span>
          </p>
        </div>
        
        {/* Sidebar Sections */}
        <div className="p-6 flex-1 space-y-8 overflow-y-auto custom-scrollbar">

          {/* Section: Cloud Sync & Authentication */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>クラウド同期</span>
              <span>
                {user ? (
                  <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-900/50">ON</span>
                ) : (
                  <span className="text-[9px] text-amber-500 font-bold bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-900/20">OFF</span>
                )}
              </span>
            </h2>
            {user ? (
              <div className="bg-slate-850 rounded-xl p-3 border border-slate-800 space-y-2.5 shadow-md">
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'User'} 
                      className="w-8 h-8 rounded-full border border-indigo-500" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-650 flex items-center justify-center text-xs font-bold text-white uppercase border border-indigo-500">
                      {(user.displayName || user.email || 'U').slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-100 truncate">{user.displayName || 'ユーザー'}</p>
                    <p className="text-[10px] text-slate-400 truncate font-mono">{user.email}</p>
                  </div>
                </div>
                
                <div id="sync-active-badge" className="text-[10px] bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between font-mono">
                  <span className="text-slate-400">ステータス</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    {syncingFirestore ? (
                      <>
                        <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                        同期中
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        クラウド同期中
                      </>
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  id="btn-google-signout"
                  onClick={handleSignOut}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer text-center"
                >
                  <LogOut className="w-3 h-3 text-slate-400" />
                  <span>ログアウト</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-850/40 rounded-xl p-4 border border-slate-850 space-y-3">
                <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                  Googleログインすると、学習データを自動的にクラウド保存し、別端末ともリアルタイム同期できます。
                </p>
                
                {authLoading ? (
                  <div className="flex items-center justify-center py-1">
                    <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                  </div>
                ) : (
                  <button
                    type="button"
                    id="btn-google-signin"
                    onClick={handleSignIn}
                    className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-900 text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 transition-all cursor-pointer text-center"
                  >
                    <svg className="w-4 h-4 mr-0.5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 15.01 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.8 2.95C6.18 7.37 8.87 5.04 12 5.04z" />
                      <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.47h6.46c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.97 3.39-4.88 3.39-8.53z" />
                      <path fill="#FBBC05" d="M5.3 10.45A7.16 7.16 0 015 12c0 .54.08 1.07.24 1.58l-3.8 2.95C.52 15.11 0 13.62 0 12s.52-3.11 1.44-4.53l3.86 2.98z" />
                      <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-3.9 1.09-3.13 0-5.82-2.33-6.77-5.46l-3.8 2.95C3.4 20.35 7.35 23 12 23z" />
                    </svg>
                    <span>Googleで同期を開始</span>
                  </button>
                )}
              </div>
            )}
          </section>
          
          {/* Section: Current Context */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800 pb-1">
              自動引継ぎ中のコンテキスト
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1 font-semibold">前回選択した問題のジャンル</label>
                <div className="bg-slate-800 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700/80 truncate font-mono" title={contextInfo.genre}>
                  {contextInfo.genre}
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1 font-semibold">前回選択した問題集名/教材名</label>
                <div className="bg-slate-800 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700/80 truncate font-mono" title={contextInfo.workbookName}>
                  {contextInfo.workbookName}
                </div>
              </div>
            </div>
          </section>

          {/* Section: Today's High-Density statistics */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800 pb-1">
              学習統計
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700/60">
                <p className="text-[10px] text-slate-400 mb-1 font-semibold">完了数(本日)</p>
                <p className="text-lg font-bold font-mono text-blue-400">{stats.todayCount} <span className="text-[10px] text-slate-400 font-normal">問</span></p>
              </div>
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700/60">
                <p className="text-[10px] text-slate-400 mb-1 font-semibold">目標達成率</p>
                <p className="text-lg font-bold font-mono text-emerald-400">
                  {stats.targetAchievementRate !== null ? `${stats.targetAchievementRate}%` : '---'}
                </p>
              </div>
            </div>

            <div className="bg-slate-800/10 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400">累計学習回数</span>
                <span className="font-mono font-bold text-slate-200">{stats.totalCount}回</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400">重複を除く問題数</span>
                <span className="font-mono font-bold text-slate-200">{stats.uniquesCount}問</span>
              </div>
            </div>
          </section>

          {/* Section: Actions & Utilities */}
          <section className="space-y-2.5">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800 pb-1">
              データツール
            </h2>
            <div className="space-y-2">
              <button
                type="button"
                id="btn-admin-demo-load-sidebar"
                onClick={handleLoadSeedRecords}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer text-left"
                title="サンプルの学習記録を再現します"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>デモデータを追加</span>
              </button>

              <button
                type="button"
                id="btn-admin-reset-sidebar"
                onClick={handleResetRecords}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-rose-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-2 border border-slate-800 hover:border-rose-900 transition-all cursor-pointer text-left"
              >
                <Database className="w-3.5 h-3.5 text-rose-500" />
                <span>全記録をリセット</span>
              </button>
            </div>
          </section>

        </div>

        {/* Sync Footer */}
        <div className="p-4 bg-slate-950 text-[10px] text-slate-600 border-t border-slate-850 flex justify-between items-center font-mono">
          <span>最終同期: {todayStr} 14:45</span>
          <span className="text-emerald-500 font-bold flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            CONNECTED
          </span>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Main Content Header / Navigation */}
        <header className="h-auto lg:h-16 bg-indigo-900 border-b border-indigo-950 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-8 py-4 sm:py-0 gap-4 shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-950/80 border border-indigo-800 rounded-full shadow-2xs transition-all duration-150">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
              <Clock className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="text-xs font-bold text-white font-mono tracking-tight leading-none">
                {formatDateTime(currentTime)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* View Switching Tabs */}
            <div className="bg-indigo-950/60 p-1 rounded-xl flex items-center border border-indigo-800/60 w-full sm:w-auto">
              <button
                type="button"
                id="tab-btn-create"
                onClick={() => setActiveTab('create')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'create'
                    ? 'bg-white text-indigo-950 shadow-sm border border-white font-bold'
                    : 'text-indigo-300 hover:text-white hover:bg-indigo-900/50'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>新規学習の記録</span>
              </button>

              <button
                type="button"
                id="tab-btn-list"
                onClick={() => setActiveTab('list')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'list'
                    ? 'bg-white text-indigo-950 shadow-sm border border-white font-bold'
                    : 'text-indigo-300 hover:text-white hover:bg-indigo-900/50'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>履歴・自動比較</span>
              </button>



              <button
                type="button"
                id="tab-btn-analytics"
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-white text-indigo-950 shadow-sm border border-white font-bold'
                    : 'text-indigo-300 hover:text-white hover:bg-indigo-900/50'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>統計・進捗分析</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area Section */}
        <div className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto w-full max-w-7xl mx-auto space-y-6">
          
          {/* Intro Tip banner for first-time onboarding users */}
          {records.length === 6 && (
            <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-4.5 flex items-start gap-3 shadow-3xs text-slate-800">
              <span className="text-lg">💡</span>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-amber-900">お試し用のデータ連携機能のご紹介</h4>
                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  青チャートの「例題24 (2次関数の最大値)」などの実データがすでに登録されています。
                  左のサイドバーには本日の学習件数や進捗がリアルタイム表示されます。
                  上部で同じ問題を入力して「自動4回目カウント」や過去データのグラフ比較をお試しいただけます。
                </p>
              </div>
            </div>
          )}

        <AnimatePresence mode="wait">
          {activeTab === 'create' && (
            <motion.div
              key={user ? `create-tab-auth-${user.uid}` : 'create-tab-guest'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <RecordForm records={records} onSaveRecord={handleSaveRecord} />
            </motion.div>
          )}
          {activeTab === 'list' && (
            <motion.div
              key="list-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <HistoryDashboard records={records} onDeleteRecord={handleDeleteRecord} />
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AnalyticsDashboard records={records} />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>

      {/* Beautiful Custom Confirmation Dialog Modal (100% iframe stable) */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-900/65 backdrop-blur-[2px]"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', duration: 0.25 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200/80 p-5 space-y-4"
            >
              <div className="flex gap-3">
                <div className={`p-2 rounded-xl h-fit shrink-0 ${confirmDialog.isDanger ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="text-sm font-bold text-slate-900">{confirmDialog.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  {confirmDialog.cancelText || 'キャンセル'}
                </button>
                <button
                  type="button"
                  id="confirm-modal-action-btn"
                  onClick={() => {
                    confirmDialog.onConfirm();
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all cursor-pointer ${
                    confirmDialog.isDanger
                      ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                  }`}
                >
                  {confirmDialog.confirmText || 'はい'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Analytics />
    </div>
  );
}
