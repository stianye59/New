/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UnderstandingRank = 'S' | 'A' | 'B' | 'C' | 'D';

export interface StudyRecord {
  id: string;
  genre: string;
  workbookName: string;
  problemNumber: string;
  learningDate: string; // YYYY-MM-DD
  timeTaken: number; // in seconds
  targetTime?: number; // target time in minutes (optional, max 180)
  understandingRank: UnderstandingRank;
  memo?: string;
  createdAt: number; // unix timestamp for sorting
}

export interface ProblemKey {
  genre: string;
  workbookName: string;
  problemNumber: string;
}

export interface ProblemSummary {
  genre: string;
  workbookName: string;
  problemNumber: string;
  attemptsCount: number;
  lastAttempt: StudyRecord;
  history: StudyRecord[];
}
