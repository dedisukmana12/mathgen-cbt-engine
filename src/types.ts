// Copyright (c) 2026 Dedi Sukmana - ASF (Autonomous Solution Factory). Proprietary; all rights reserved.
export type QuestionType = '1' | '2' | '3' | '4' | '5';

export type DifficultyLevel =
  | 'Very Easy'
  | 'Easy'
  | 'Intermediate'
  | 'Advanced'
  | 'Very Advanced'
  | 'Mixed';

export type SpecificDifficulty = Exclude<DifficultyLevel, 'Mixed'>;

export interface QuestionParams {
  educationLevel: string;
  major: string;
  subject: string;
  topic: string;
  grade: string;
  semester: string;
  curriculum: string;
  numQuestions: number;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  language: 'Bahasa Indonesia' | 'English';
  numOptions: number;
}

export interface CBTQuestion {
  no: number;
  soal: string;
  jenis: string;
  opsi?: string;
  jawaban: string;
  kunci?: string;
  baris?: string;
  kolom?: string;
  tingkat_kesulitan?: string;
  pembahasan?: string;
}

export interface QuestionGroup {
  id: string;
  params: QuestionParams;
  questions: CBTQuestion[];
  timestamp: number;
}
