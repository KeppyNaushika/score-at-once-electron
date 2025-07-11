# 移行中のシステム稼働継続・テスト戦略

## 🚀 無停止移行の実現方法

### 1. Blue-Green Deployment アプローチ

#### 基本概念
- **Blue環境**: 現在稼働中のシステム
- **Green環境**: 移行作業を行う新しいシステム
- **切り替え**: 移行完了後、瞬時に環境を切り替え

#### 実装方法
```bash
# Green環境の準備
mkdir -p ./data/migration-green
cp ./data/database.db ./data/migration-green/database.db

# 移行作業はGreen環境で実行
DATABASE_URL="file:./data/migration-green/database.db" npm run dev

# 移行完了後、Blue環境をGreen環境に切り替え
mv ./data/database.db ./data/database-blue-backup.db
mv ./data/migration-green/database.db ./data/database.db
```

### 2. 段階的機能切り替え

#### Phase 1: 基盤改善（無影響）
- Enum型導入
- インデックス追加
- 型定義統一

**稼働影響**: なし（内部処理の改善のみ）

#### Phase 2: 中程度の変更
- ClassTeachersテーブル正規化
- 関連コード更新

**稼働影響**: 最小限（教員管理機能のみ一時的に制限）

#### Phase 3: 大幅な変更
- QuestionGroup関連の簡素化
- 大幅なコード変更

**稼働影響**: 中程度（小計・集計機能を一時的に無効化）

### 3. 機能フラグによる段階的切り替え

```typescript
// 機能フラグ設定
const FEATURE_FLAGS = {
  useNewClassTeacherSystem: false,
  useNewQuestionSetSystem: false,
  useEnumTypes: false,
}

// コード内での切り替え
if (FEATURE_FLAGS.useNewClassTeacherSystem) {
  // 新しいClassTeacherシステムを使用
  return await getClassTeachersNew(classId)
} else {
  // 既存のシステムを使用
  return await getClassTeachersOld(classId)
}
```

## 🧪 包括的テスト戦略

### 1. 移行前テスト

#### 1.1 データベース整合性テスト
```sql
-- データの整合性チェック
SELECT 
  'User' as table_name,
  COUNT(*) as total_count,
  COUNT(DISTINCT id) as unique_count,
  COUNT(CASE WHEN id IS NULL THEN 1 END) as null_id_count
FROM User
UNION ALL
SELECT 
  'Project' as table_name,
  COUNT(*) as total_count,
  COUNT(DISTINCT id) as unique_count,
  COUNT(CASE WHEN id IS NULL THEN 1 END) as null_id_count
FROM Project;

-- 外部キー制約チェック
SELECT 
  'ProjectStudent' as table_name,
  COUNT(*) as total_count,
  COUNT(DISTINCT projectId) as unique_projects,
  COUNT(DISTINCT studentId) as unique_students
FROM ProjectStudent
WHERE projectId IN (SELECT id FROM Project)
  AND studentId IN (SELECT id FROM Student);
```

#### 1.2 パフォーマンステスト
```sql
-- 現在のクエリパフォーマンス測定
.timer on
EXPLAIN QUERY PLAN SELECT * FROM AnswerSheet WHERE projectId = 'test-project-id' AND status = 'UPLOADED';
EXPLAIN QUERY PLAN SELECT * FROM QuestionScore WHERE answerSheetId = 'test-answer-sheet-id';
.timer off
```

### 2. 移行中テスト

#### 2.1 データ移行検証
```typescript
// 移行前後のデータ比較
interface MigrationValidation {
  table: string
  beforeCount: number
  afterCount: number
  isValid: boolean
  issues: string[]
}

const validateMigration = async (phase: number): Promise<MigrationValidation[]> => {
  const validations: MigrationValidation[] = []
  
  // 各テーブルのレコード数比較
  const beforeCounts = await getTableCounts('before')
  const afterCounts = await getTableCounts('after')
  
  for (const table of Object.keys(beforeCounts)) {
    const validation: MigrationValidation = {
      table,
      beforeCount: beforeCounts[table],
      afterCount: afterCounts[table],
      isValid: beforeCounts[table] === afterCounts[table],
      issues: []
    }
    
    if (!validation.isValid) {
      validation.issues.push(`Count mismatch: ${beforeCounts[table]} -> ${afterCounts[table]}`)
    }
    
    validations.push(validation)
  }
  
  return validations
}
```

#### 2.2 機能回帰テスト
```typescript
// 主要機能の自動テスト
describe('Migration Phase 1 - Enum Types', () => {
  test('User role enum should work correctly', async () => {
    const user = await createUser({
      username: 'test-user',
      name: 'Test User',
      role: 'TEACHER'
    })
    
    expect(user.role).toBe('TEACHER')
  })
  
  test('Project student status enum should work correctly', async () => {
    const projectStudent = await createProjectStudent({
      projectId: 'test-project',
      studentId: 'test-student',
      status: 'PARTICIPATING'
    })
    
    expect(projectStudent.status).toBe('PARTICIPATING')
  })
})
```

### 3. 移行後テスト

#### 3.1 パフォーマンス改善検証
```sql
-- 移行後のパフォーマンス測定
.timer on
EXPLAIN QUERY PLAN SELECT * FROM AnswerSheet WHERE projectId = 'test-project-id' AND status = 'UPLOADED';
EXPLAIN QUERY PLAN SELECT * FROM QuestionScore WHERE answerSheetId = 'test-answer-sheet-id';
.timer off
```

#### 3.2 エンドツーエンドテスト
```typescript
// 主要ワークフローの完全テスト
describe('Complete Workflow Test', () => {
  test('Full scoring workflow should work', async () => {
    // 1. プロジェクト作成
    const project = await createProject({
      examName: 'Test Exam',
      subject: 'Math'
    })
    
    // 2. 生徒追加
    const student = await createStudent({
      studentId: 'S001',
      lastName: 'Test',
      firstName: 'Student'
    })
    
    // 3. 答案アップロード
    const answerSheet = await uploadAnswerSheet({
      projectId: project.id,
      studentId: student.id,
      imagePath: '/path/to/test-image.png'
    })
    
    // 4. 採点実行
    const score = await scoreAnswer({
      answerSheetId: answerSheet.id,
      layoutRegionId: 'test-region',
      partialScore: 80
    })
    
    // 5. 結果確認
    expect(score.partialScore).toBe(80)
  })
})
```

## 📊 監視・モニタリング

### 1. リアルタイム監視
```typescript
// 移行進捗の監視
interface MigrationMonitor {
  phase: number
  currentStep: string
  progress: number
  startTime: Date
  estimatedCompletion: Date
  issues: string[]
}

const migrationMonitor = {
  startMonitoring: () => {
    setInterval(() => {
      // データベース接続状態チェック
      checkDatabaseConnection()
      
      // パフォーマンス監視
      checkQueryPerformance()
      
      // エラー率監視
      checkErrorRate()
    }, 5000)
  }
}
```

### 2. アラート機能
```typescript
// 異常検知時のアラート
const alertSystem = {
  onDatabaseError: (error: Error) => {
    console.error('Database error during migration:', error)
    // 自動ロールバック実行
    executeRollback()
  },
  
  onPerformanceDegradation: (metric: string, value: number) => {
    console.warn(`Performance degradation: ${metric} = ${value}`)
    // 管理者に通知
    notifyAdmin(`Performance issue: ${metric}`)
  }
}
```

## 🔄 ロールバック実行手順

### 1. 緊急ロールバック（5分以内）
```bash
#!/bin/bash
# 緊急ロールバック実行
echo "Starting emergency rollback..."

# アプリケーション停止
pkill -f "npm run dev"

# データベース復元
cp ./data/database-blue-backup.db ./data/database.db

# アプリケーション再起動
npm run dev &

echo "Emergency rollback completed"
```

### 2. 段階的ロールバック
```sql
-- Phase 1のロールバック
ALTER TABLE User RENAME COLUMN role TO role_new;
ALTER TABLE User ADD COLUMN role TEXT;
UPDATE User SET role = 
  CASE 
    WHEN role_new = 'ADMIN' THEN 'admin'
    WHEN role_new = 'TEACHER' THEN 'teacher'
    WHEN role_new = 'STUDENT' THEN 'student'
    ELSE 'teacher'
  END;
ALTER TABLE User DROP COLUMN role_new;
```

## 💡 ベストプラクティス

### 1. 移行実行のタイミング
- **推奨時間**: 夜間・週末（利用者が少ない時間帯）
- **避けるべき時間**: 採点作業のピーク時期
- **準備期間**: 移行の1週間前に関係者に通知

### 2. チェックリスト
```markdown
## 移行前チェックリスト
- [ ] データベースの完全バックアップ
- [ ] 移行スクリプトの動作確認
- [ ] ロールバック手順の確認
- [ ] 監視システムの準備
- [ ] 関係者への通知

## 移行中チェックリスト
- [ ] 各段階の完了確認
- [ ] データ整合性の検証
- [ ] パフォーマンス測定
- [ ] エラーログの確認

## 移行後チェックリスト
- [ ] 全機能の動作確認
- [ ] パフォーマンス改善の検証
- [ ] ユーザー受け入れテスト
- [ ] 本番環境での安定稼働確認
```

### 3. 成功基準
- **データ整合性**: 100%（データ損失なし）
- **パフォーマンス**: 30%以上の改善
- **ダウンタイム**: 5分以内
- **ロールバック時間**: 3分以内

この戦略により、現在のプロダクションレベルのアプリケーションを停止することなく、安全に理想的なスキーマ設計に移行することができます。