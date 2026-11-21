CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  questions_json TEXT NOT NULL,
  total_points INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  allow_retry INTEGER NOT NULL DEFAULT 0,
  created_by_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  discord_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  rg TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  score REAL NOT NULL,
  total_points INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  UNIQUE(exam_id, discord_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id, submitted_at DESC);
