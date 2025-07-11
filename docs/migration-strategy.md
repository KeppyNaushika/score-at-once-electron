# スキーマ移行戦略・実行計画

## 🎯 移行戦略の概要

### 基本方針
1. **無停止移行**: プロダクションレベルのアプリケーションを停止せずに移行
2. **段階的移行**: リスクを最小化する3段階のフェーズ分け
3. **完全ロールバック**: 各段階で完全に元に戻せる仕組み
4. **データ整合性保証**: 移行中のデータ損失を完全に防止

## 📋 Phase 1: 低リスク改善（1-2日）

### 1.1 Enum型の導入

#### 作業内容
- String型フィールドをEnum型に変更
- 既存データの値を新しいEnum値にマッピング
- 型定義ファイルの更新

#### 移行スクリプト
```sql
-- 1. 新しいEnum値の追加
ALTER TABLE User ADD COLUMN role_new TEXT;
UPDATE User SET role_new = 
  CASE 
    WHEN role = 'admin' THEN 'ADMIN'
    WHEN role = 'teacher' THEN 'TEACHER'
    WHEN role = 'student' THEN 'STUDENT'
    ELSE 'TEACHER'
  END;

-- 2. 古いカラムの削除と新しいカラムの名前変更
ALTER TABLE User DROP COLUMN role;
ALTER TABLE User RENAME COLUMN role_new TO role;
```

#### ロールバック戦略
```sql
-- 元の値に戻す
ALTER TABLE User ADD COLUMN role_old TEXT;
UPDATE User SET role_old = 
  CASE 
    WHEN role = 'ADMIN' THEN 'admin'
    WHEN role = 'TEACHER' THEN 'teacher'
    WHEN role = 'STUDENT' THEN 'student'
    ELSE 'teacher'
  END;
ALTER TABLE User DROP COLUMN role;
ALTER TABLE User RENAME COLUMN role_old TO role;
```

### 1.2 インデックスの追加

#### 作業内容
- 高頻度クエリのパフォーマンス向上
- 複合インデックスの最適化
- 使用されていないインデックスの削除

#### 移行スクリプト
```sql
-- 採点関連の高速検索インデックス
CREATE INDEX idx_answer_sheet_project_status ON AnswerSheet(projectId, status);
CREATE INDEX idx_question_score_sheet_status ON QuestionScore(answerSheetId, status);
CREATE INDEX idx_student_project ON ScoreRecord(studentId, projectId);

-- 時系列データの最適化
CREATE INDEX idx_answer_sheet_created ON AnswerSheet(createdAt);
CREATE INDEX idx_question_score_created ON QuestionScore(createdAt);
```

#### ロールバック戦略
```sql
-- 追加したインデックスを削除
DROP INDEX idx_answer_sheet_project_status;
DROP INDEX idx_question_score_sheet_status;
DROP INDEX idx_student_project;
DROP INDEX idx_answer_sheet_created;
DROP INDEX idx_question_score_created;
```

### 1.3 型定義の統一

#### 作業内容
- Float型をDecimal型に統一
- 数値精度の向上
- 計算結果の一貫性確保

#### 移行スクリプト
```sql
-- Float型フィールドをDecimal型に変更
ALTER TABLE QuestionScore ADD COLUMN partialScore_new DECIMAL(10,2);
UPDATE QuestionScore SET partialScore_new = CAST(partialScore AS DECIMAL(10,2));
ALTER TABLE QuestionScore DROP COLUMN partialScore;
ALTER TABLE QuestionScore RENAME COLUMN partialScore_new TO partialScore;
```

## 📋 Phase 2: 中リスク改善（2-3日）

### 2.1 ClassTeachersテーブルの正規化

#### 作業内容
- 自動生成されたテーブルを適切な設計に変更
- A、Bカラムを意味のある名前に変更
- 関連コードの更新

#### 移行スクリプト
```sql
-- 1. 新しいClassTeacherテーブルの作成
CREATE TABLE ClassTeacher (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6)))),
  classId TEXT NOT NULL,
  teacherId TEXT NOT NULL,
  role TEXT DEFAULT 'TEACHER',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (classId) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (teacherId) REFERENCES User(id) ON DELETE CASCADE
);

-- 2. 既存データの移行
INSERT INTO ClassTeacher (classId, teacherId)
SELECT A, B FROM _ClassTeachers;

-- 3. 古いテーブルの削除
DROP TABLE _ClassTeachers;

-- 4. インデックスの追加
CREATE UNIQUE INDEX idx_class_teacher_unique ON ClassTeacher(classId, teacherId);
CREATE INDEX idx_class_teacher_class ON ClassTeacher(classId);
CREATE INDEX idx_class_teacher_teacher ON ClassTeacher(teacherId);
```

#### ロールバック戦略
```sql
-- 1. 古いテーブル構造の復元
CREATE TABLE _ClassTeachers (
  A TEXT NOT NULL,
  B TEXT NOT NULL,
  FOREIGN KEY (A) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (B) REFERENCES User(id) ON DELETE CASCADE
);

-- 2. データの復元
INSERT INTO _ClassTeachers (A, B)
SELECT classId, teacherId FROM ClassTeacher;

-- 3. 新しいテーブルの削除
DROP TABLE ClassTeacher;

-- 4. インデックスの復元
CREATE UNIQUE INDEX _ClassTeachers_AB_unique ON _ClassTeachers(A, B);
CREATE INDEX _ClassTeachers_B_index ON _ClassTeachers(B);
```

## 📋 Phase 3: 高リスク改善（3-5日）

### 3.1 QuestionGroup関連の簡素化

#### 作業内容
- 4テーブル構造を2テーブル構造に簡素化
- QuestionSet + Question の設計に変更
- 関連コードの大幅な変更

#### 移行スクリプト
```sql
-- 1. 新しいテーブル構造の作成
CREATE TABLE QuestionSet (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6)))),
  projectId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  order INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
);

CREATE TABLE Question (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6)))),
  questionSetId TEXT NOT NULL,
  layoutRegionId TEXT NOT NULL,
  label TEXT NOT NULL,
  points DECIMAL(10,2) DEFAULT 0,
  order INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (questionSetId) REFERENCES QuestionSet(id) ON DELETE CASCADE,
  FOREIGN KEY (layoutRegionId) REFERENCES LayoutRegion(id) ON DELETE CASCADE
);

-- 2. 既存データの移行
INSERT INTO QuestionSet (id, projectId, name, createdAt, updatedAt)
SELECT id, projectId, name, createdAt, updatedAt FROM QuestionGroup;

INSERT INTO Question (questionSetId, layoutRegionId, label, points, order)
SELECT 
  qgi.questionGroupId as questionSetId,
  sd.layoutRegionId,
  qgi.name as label,
  lr.points,
  qgi.order
FROM QuestionGroupItem qgi
JOIN SubtotalDefinition sd ON qgi.id = sd.questionGroupItemId
JOIN LayoutRegion lr ON sd.layoutRegionId = lr.id;

-- 3. 古いテーブルの削除
DROP TABLE QuestionSubtotalAssignment;
DROP TABLE SubtotalDefinition;
DROP TABLE QuestionGroupItem;
DROP TABLE QuestionGroup;
```

#### ロールバック戦略
```sql
-- 完全なデータ復元スクリプト
-- (バックアップからの復元が推奨)
```

## 🛡️ 安全性確保の仕組み

### 1. 自動バックアップシステム
```bash
#!/bin/bash
# 移行前自動バックアップ
BACKUP_DIR="./data/migration-backups"
mkdir -p $BACKUP_DIR

# 各フェーズ前のバックアップ
cp ./data/database.db "$BACKUP_DIR/database_phase1_$(date +%Y%m%d_%H%M%S).db"
```

### 2. 整合性チェック
```sql
-- 移行後のデータ整合性チェック
SELECT 
  'User' as table_name,
  COUNT(*) as count,
  COUNT(DISTINCT id) as unique_count
FROM User
UNION ALL
SELECT 
  'Project' as table_name,
  COUNT(*) as count,
  COUNT(DISTINCT id) as unique_count
FROM Project;
```

### 3. 移行状態の監視
```typescript
// 移行進捗の監視
interface MigrationProgress {
  phase: 1 | 2 | 3
  step: string
  progress: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  errors: string[]
}
```

## ⏱️ 時間見積もり

### Phase 1（低リスク）: 1-2日
- 準備・バックアップ: 0.5日
- Enum型導入: 0.5日
- インデックス追加: 0.5日
- 型定義統一: 0.5日

### Phase 2（中リスク）: 2-3日
- ClassTeachers正規化: 1日
- 関連コード更新: 1日
- テスト・検証: 1日

### Phase 3（高リスク）: 3-5日
- QuestionGroup簡素化: 2日
- 大幅コード変更: 2日
- 包括的テスト: 1日

**総所要時間: 6-10日**

## 🚨 緊急時対応

### 1. 即座のロールバック
```bash
# 緊急ロールバック
cp ./data/migration-backups/database_phase1_YYYYMMDD_HHMMSS.db ./data/database.db
```

### 2. 部分的復旧
```sql
-- 特定テーブルのみの復旧
.restore backup_database.db User
.restore backup_database.db Project
```

### 3. 監視・アラート
```typescript
// 移行中の監視
const migrationMonitor = {
  checkDataIntegrity: () => { /* 整合性チェック */ },
  alertOnFailure: (error: Error) => { /* 失敗時アラート */ },
  autoRollback: (phase: number) => { /* 自動ロールバック */ }
}
```

この移行戦略により、現在のプロダクションレベルのアプリケーションを安全に、段階的に改善することができます。