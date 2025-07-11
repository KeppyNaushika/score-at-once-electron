# 移行リスク分析・対策・実行戦略

## 🚨 移行中に発生する可能性のある問題と対策

### 1. データベース関連の問題

#### 1.1 データ損失リスク
**問題**: 移行中のスクリプトエラーによるデータ損失
**対策**:
- 移行前の完全バックアップ（複数世代）
- 移行処理のトランザクション化
- 段階的バックアップ（各Phase前）

```sql
-- トランザクションによる安全な移行
BEGIN TRANSACTION;

-- 移行処理実行
ALTER TABLE User ADD COLUMN role_new TEXT;
UPDATE User SET role_new = CASE 
  WHEN role = 'admin' THEN 'ADMIN'
  WHEN role = 'teacher' THEN 'TEACHER'
  ELSE 'TEACHER'
END;

-- 検証：新しいカラムにNULL値がないことを確認
SELECT COUNT(*) FROM User WHERE role_new IS NULL;

-- 検証が成功した場合のみコミット
COMMIT;
-- 失敗した場合はROLLBACK
```

#### 1.2 外部キー制約違反
**問題**: 移行中の外部キー制約エラー
**対策**:
- 制約の一時的無効化
- 依存関係の正しい順序での処理
- 制約違反チェック

```sql
-- 外部キー制約の一時的無効化
PRAGMA foreign_keys = OFF;

-- 移行処理実行
-- ...

-- 制約チェック
PRAGMA foreign_key_check;

-- 外部キー制約の再有効化
PRAGMA foreign_keys = ON;
```

#### 1.3 データ型変換エラー
**問題**: Float→Decimal変換時の精度問題
**対策**:
- 変換前のデータ範囲チェック
- 精度設定の適切な調整
- 変換後の検証

```sql
-- 変換前チェック
SELECT 
  MIN(partialScore) as min_score,
  MAX(partialScore) as max_score,
  COUNT(*) as total_records
FROM QuestionScore 
WHERE partialScore IS NOT NULL;

-- 安全な変換
ALTER TABLE QuestionScore ADD COLUMN partialScore_decimal DECIMAL(10,2);
UPDATE QuestionScore 
SET partialScore_decimal = ROUND(CAST(partialScore AS DECIMAL(10,2)), 2)
WHERE partialScore IS NOT NULL;
```

### 2. アプリケーション関連の問題

#### 2.1 型エラー・実行時エラー
**問題**: Enum型導入による既存コードの型エラー
**対策**:
- TypeScript型チェックの段階的実施
- 機能フラグによる段階的切り替え
- 互換性レイヤーの実装

```typescript
// 互換性レイヤーの実装
type LegacyUserRole = 'admin' | 'teacher' | 'student'
type NewUserRole = 'ADMIN' | 'TEACHER' | 'STUDENT'

const convertRole = (legacyRole: LegacyUserRole): NewUserRole => {
  const roleMap: Record<LegacyUserRole, NewUserRole> = {
    'admin': 'ADMIN',
    'teacher': 'TEACHER',
    'student': 'STUDENT'
  }
  return roleMap[legacyRole]
}
```

#### 2.2 パフォーマンス劣化
**問題**: 移行後のクエリパフォーマンス低下
**対策**:
- 移行前後のベンチマーク実施
- インデックス最適化
- クエリ実行計画の確認

```sql
-- パフォーマンス測定
.timer on
EXPLAIN QUERY PLAN SELECT * FROM AnswerSheet 
WHERE projectId = 'test-id' AND status = 'UPLOADED';
.timer off

-- インデックスの効果確認
CREATE INDEX idx_answer_sheet_project_status ON AnswerSheet(projectId, status);
```

### 3. 運用関連の問題

#### 3.1 移行中のサービス停止
**問題**: 移行時間が予想より長期化
**対策**:
- Blue-Green Deploymentの採用
- 段階的移行による影響最小化
- 緊急時の即座ロールバック

```bash
# 移行タイムアウト監視
timeout 3600 ./migration-script.sh || {
  echo "Migration timeout - executing rollback"
  ./rollback-script.sh
}
```

#### 3.2 ユーザー影響の最小化
**問題**: 移行中のユーザー機能制限
**対策**:
- 深夜・週末の実行
- 段階的機能制限の事前通知
- 重要機能の優先順位付け

### 4. 技術的な問題

#### 4.1 SQLite固有の制約
**問題**: SQLiteのスキーマ変更制限
**対策**:
- CREATE TABLE AS SELECT を使用したテーブル再作成
- 適切なインデックス再構築
- 外部キー制約の処理

```sql
-- SQLiteでの安全なテーブル変更
-- 1. 新しいテーブル作成
CREATE TABLE User_new (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT'))
);

-- 2. データ移行
INSERT INTO User_new (id, username, role)
SELECT id, username, 
  CASE 
    WHEN role = 'admin' THEN 'ADMIN'
    WHEN role = 'teacher' THEN 'TEACHER'
    ELSE 'TEACHER'
  END
FROM User;

-- 3. テーブル置換
DROP TABLE User;
ALTER TABLE User_new RENAME TO User;
```

#### 4.2 Prisma Schema同期
**問題**: PrismaスキーマとDBスキーマの不整合
**対策**:
- 段階的なスキーマ更新
- `prisma db push`による強制同期
- 開発・本番環境の同期確認

```bash
# Prismaスキーマの段階的更新
npx prisma generate
npx prisma db push --skip-generate
npx prisma studio # 確認用
```

## 🎯 最終実行戦略

### Phase 1: 低リスク改善（実行推奨）
**実行タイミング**: 深夜帯（22:00-02:00）
**所要時間**: 1-2時間
**影響範囲**: 最小限

#### 実行手順
1. データベース完全バックアップ
2. Enum型の導入
3. インデックス追加
4. 型定義統一
5. 動作確認・性能測定

### Phase 2: 中リスク改善（条件付き実行）
**実行タイミング**: 週末（土曜日深夜）
**所要時間**: 2-3時間
**影響範囲**: 教員管理機能

#### 実行条件
- Phase 1が完全成功
- 十分なテスト実施
- 緊急時対応体制の確立

### Phase 3: 高リスク改善（慎重な検討が必要）
**実行タイミング**: 長期休暇期間
**所要時間**: 1-2日
**影響範囲**: 小計・集計機能

#### 実行前提条件
- QuestionGroup機能の実際の利用状況確認
- 代替案の検討
- 十分な開発・テスト期間の確保

## 📊 成功指標・KPI

### 1. 技術指標
- **データ整合性**: 100%（データ損失なし）
- **パフォーマンス改善**: 30%以上のクエリ速度向上
- **型安全性**: TypeScriptエラー0件
- **テストカバレッジ**: 95%以上

### 2. 運用指標
- **ダウンタイム**: 5分以内
- **ロールバック時間**: 3分以内
- **エラー発生率**: 0.1%以下
- **ユーザー満足度**: 移行前と同等以上

### 3. 長期指標
- **保守性向上**: 開発効率20%向上
- **拡張性**: 新機能追加の工数削減
- **安定性**: 障害発生率50%削減

## 🔧 実行判定基準

### 即座実行推奨（Phase 1）
- [x] 現在のプロダクションレベルの安定性
- [x] データベースバックアップ体制
- [x] 緊急時対応体制
- [x] 型安全性の向上需要

### 条件付き実行（Phase 2）
- [x] Phase 1の成功実績
- [x] 十分なテスト実施
- [x] 教員管理機能の利用頻度
- [x] 長期保守性の重要度

### 慎重な検討が必要（Phase 3）
- [ ] QuestionGroup機能の実際の使用状況
- [ ] 代替設計の検討
- [ ] 長期的な開発計画
- [ ] リソース確保の状況

## 💡 推奨アクション

### 1. 即座実行（Phase 1）
現在のプロダクションレベルを維持しながら、基盤を強化するPhase 1の実行を推奨します。

### 2. 計画検討（Phase 2）
教員管理機能の使用頻度を確認した上で、Phase 2の実行を検討してください。

### 3. 長期計画（Phase 3）
QuestionGroup機能の実際の利用状況を詳細に調査し、必要性を再評価してください。

この分析に基づき、リスクを最小化しながら段階的な改善を実現できます。