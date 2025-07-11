# Score at Once - スキーマ移行戦略 総合レポート

## 📋 概要

本レポートは、Score at Once（一括採点システム）の将来的な設計変更に向けた包括的な戦略を提供します。現在の`pageNumber`ベースによる暗黙的な関連付けから、`masterImageId`による直接的な関連付けへの移行戦略を詳細に分析・提案します。

## 🎯 背景と目的

### 現在の問題
- **AnswerSheet**と**MasterImage**の関連付けが`pageNumber`による暗黙的な設計
- **LayoutRegion**の`masterImageId`と**AnswerSheet**の`pageNumber`の間接的な関連付け
- 採点進捗計算時の複雑なクエリと性能問題
- データ整合性の脆弱性

### 目的
- データ整合性の向上
- 採点進捗計算の簡素化
- 将来的な拡張性の確保
- 保守性の向上

## 🔍 現在のスキーマ構造分析

### 主要な関係性
```prisma
model MasterImage {
  id         String @id @default(uuid())
  projectId  String
  pageNumber Int
  @@unique([projectId, pageNumber])
}

model AnswerSheet {
  id         String @id @default(uuid())
  projectId  String
  pageNumber Int    // 間接的な関連付け
  @@unique([projectId, studentId, pageNumber])
}

model LayoutRegion {
  id            String @id @default(uuid())
  projectId     String      // 冗長な参照
  masterImageId String      // 直接参照
  masterImage   MasterImage @relation(fields: [masterImageId], references: [id])
}
```

### 問題点の詳細

#### 1. データ整合性の脆弱性
- **外部キー制約の欠如**: AnswerSheetからMasterImageへの直接的な制約なし
- **暗黙的な関連付け**: pageNumberによる脆弱な関連付け
- **冗長な参照**: LayoutRegionでのprojectIdの重複管理

#### 2. 性能問題
- **複雑なJOINクエリ**: 採点進捗計算時に4テーブルのJOINが必要
- **インデックス効率**: 複合インデックスの非効率性
- **大量データ処理**: スケーラビリティの制約

#### 3. 保守性の課題
- **コードの複雑化**: 関連データ取得の複雑なロジック
- **拡張性の制約**: 新機能追加時の制約
- **テストの困難性**: 複雑な関連付けのテスト

## 💡 理想的なスキーマ設計

### 提案する構造
```prisma
model AnswerSheet {
  id            String @id @default(uuid())
  projectId     String
  masterImageId String      // 新規：直接関連付け
  pageNumber    Int         // 保持：互換性のため
  version       Int @default(1)
  
  masterImage   MasterImage @relation(fields: [masterImageId], references: [id])
  
  @@unique([projectId, studentId, masterImageId])
  @@index([projectId, masterImageId])
}

model LayoutRegion {
  id            String @id @default(uuid())
  // projectId を削除（masterImageから派生）
  masterImageId String
  version       Int @default(1)
  
  masterImage   MasterImage @relation(fields: [masterImageId], references: [id])
}
```

### 主要な改善点

#### 1. 直接的な関連付け
- **外部キー制約**: データベースレベルでの整合性保証
- **シンプルなクエリ**: 直接JOINによる効率的なデータ取得
- **明確な関係性**: 設計意図の明確化

#### 2. 統一的なバージョン管理
- **楽観的ロック**: 全テーブルでの統一的なversion管理
- **並行処理**: 複数教員による安全な協調作業
- **データ整合性**: 更新競合の適切な処理

#### 3. インデックス最適化
```sql
-- 採点進捗計算の最適化
CREATE INDEX idx_answer_sheets_project_master ON answer_sheets(project_id, master_image_id);
CREATE INDEX idx_answer_sheets_scored ON answer_sheets(project_id, is_scored);
CREATE INDEX idx_question_scores_status ON question_scores(status);
```

## 🚀 移行戦略

### 段階的移行アプローチ

#### Phase 1: 基盤整備（1-2日）
**目標**: 新しいフィールドとインデックスの追加

```sql
-- 新フィールド追加
ALTER TABLE answer_sheets ADD COLUMN master_image_id TEXT;
ALTER TABLE answer_sheets ADD COLUMN version INTEGER DEFAULT 1;

-- インデックス追加
CREATE INDEX idx_answer_sheets_master_image ON answer_sheets(master_image_id);
CREATE INDEX idx_answer_sheets_project_scored ON answer_sheets(project_id, is_scored);
```

**影響範囲**: 最小限（内部構造の拡張のみ）

#### Phase 2: データ移行（2-3日）
**目標**: 既存データの新構造への移行

```sql
-- データ移行
UPDATE answer_sheets 
SET master_image_id = (
  SELECT id FROM master_images 
  WHERE master_images.project_id = answer_sheets.project_id 
  AND master_images.page_number = answer_sheets.page_number
);

-- 整合性確認
SELECT COUNT(*) FROM answer_sheets WHERE master_image_id IS NULL;
-- 結果: 0 である必要がある
```

**影響範囲**: データベースのみ（アプリケーションは従来通り動作）

#### Phase 3: アプリケーション更新（3-5日）
**目標**: コードの新構造への移行

```typescript
// 採点進捗計算の簡素化
const calculateQuestionProgress = useCallback(() => {
  const progress = {}
  
  questionRegions.forEach((question) => {
    // 新しい直接的な関連付けを使用
    const relevantAnswerSheets = answerSheets.filter(sheet => 
      sheet.masterImageId === question.masterImageId  // 簡素化！
    )
    
    // 以下の処理は従来通り
    const totalAnswers = relevantAnswerSheets.length
    // ...
  })
}, [answerSheets, questionRegions, scoringData])
```

**影響範囲**: 採点進捗計算、統計機能

#### Phase 4: 制約追加（1日）
**目標**: 外部キー制約の追加

```sql
-- 外部キー制約追加
ALTER TABLE answer_sheets 
ADD CONSTRAINT fk_answer_sheets_master_image 
FOREIGN KEY (master_image_id) REFERENCES master_images(id);

-- 一意制約更新
ALTER TABLE answer_sheets 
ADD CONSTRAINT uk_answer_sheets_project_student_master 
UNIQUE(project_id, student_id, master_image_id);
```

**影響範囲**: データベース制約（アプリケーションは透過的）

### 無停止移行の実現

#### Blue-Green Deployment
1. **Green環境**: 新しいスキーマでの並行運用
2. **データ同期**: リアルタイムでのデータ同期
3. **段階的切り替え**: 機能単位での切り替え
4. **ロールバック準備**: 即座の切り戻し体制

#### 機能フラグ
```typescript
const useNewSchemaForProgress = useFeatureFlag('new-schema-progress')

const calculateQuestionProgress = useCallback(() => {
  return useNewSchemaForProgress 
    ? calculateQuestionProgressNew()
    : calculateQuestionProgressLegacy()
}, [useNewSchemaForProgress])
```

## ⚠️ リスクと対策

### 高リスク項目

#### 1. データ整合性リスク
**リスク**: 移行過程でのデータ不整合
**対策**: 
- 完全バックアップの事前取得
- 段階的移行による影響範囲の限定
- 各フェーズでの整合性チェック

#### 2. 性能リスク
**リスク**: 移行中の処理遅延
**対策**:
- 非業務時間での実施
- インデックス作成の最適化
- 監視とアラートの設定

#### 3. 運用リスク
**リスク**: 予期しない停止時間
**対策**:
- 詳細な移行計画
- ロールバック手順の整備
- 緊急連絡体制の構築

### 中リスク項目

#### 1. 開発リスク
**リスク**: 移行に伴うバグ発生
**対策**:
- 包括的なテストスイート
- 段階的リリース
- 監視とログ収集の強化

#### 2. ユーザー影響
**リスク**: 操作性の変化
**対策**:
- 透過的な移行設計
- 事前通知とトレーニング
- サポート体制の強化

## 📊 期待効果

### 定量的効果

#### 性能改善
- **採点進捗計算**: 30-50%の高速化
- **データ取得**: 複雑なJOINの削減により20-30%改善
- **インデックス効率**: 適切なインデックスにより検索速度向上

#### 保守性向上
- **コード行数**: 複雑なクエリの削減により20%削減
- **開発効率**: 新機能開発時の効率向上
- **テスト工数**: 単純な関連付けによるテスト簡素化

### 定性的効果

#### 開発体験
- **コードの可読性**: 明確な関連付けによる理解しやすさ
- **デバッグ効率**: 問題箇所の特定が容易
- **新機能開発**: 拡張性の向上による開発速度向上

#### 運用安定性
- **データ整合性**: 外部キー制約による保証
- **障害対応**: 問題の早期発見と対応
- **スケーラビリティ**: 大量データへの対応力

## 🎯 実装優先度

### 即座実行推奨（Phase 1）
- **インデックス追加**: 即効性のある性能改善
- **新フィールド追加**: 基盤整備
- **影響範囲**: 最小限
- **期待効果**: 中程度

### 条件付き実行（Phase 2-3）
- **データ移行**: 本格的な構造変更
- **アプリケーション更新**: 新構造の活用
- **影響範囲**: 中程度
- **期待効果**: 高い

### 慎重検討（Phase 4）
- **制約追加**: 最終的な整合性確保
- **レガシー削除**: 完全な移行
- **影響範囲**: 高い
- **期待効果**: 最大

## 🔧 実装手順書

### 事前準備
1. **完全バックアップ**: 全データベースの完全バックアップ
2. **テスト環境準備**: 本番同等のテスト環境構築
3. **監視設定**: 移行監視用のメトリクス設定
4. **緊急連絡網**: 24時間対応体制の確立

### Phase 1: 基盤整備
```bash
# 1. バックアップ実行
cp data/database.db data/database_backup_$(date +%Y%m%d_%H%M%S).db

# 2. マイグレーション実行
npx prisma migrate dev --name add_master_image_id_to_answer_sheets

# 3. インデックス作成
sqlite3 data/database.db < migration_scripts/add_indexes.sql

# 4. 動作確認
npm run test:migration:phase1
```

### Phase 2: データ移行
```bash
# 1. 移行前チェック
npm run check:data-integrity

# 2. データ移行実行
node migration_scripts/migrate_answer_sheet_relations.js

# 3. 整合性確認
npm run verify:data-migration

# 4. 性能テスト
npm run test:performance:migration
```

### Phase 3: アプリケーション更新
```bash
# 1. 機能フラグ有効化
echo "NEW_SCHEMA_PROGRESS=true" >> .env

# 2. 段階的デプロイ
npm run deploy:canary

# 3. 監視確認
npm run monitor:new-features

# 4. 全体切り替え
npm run deploy:production
```

### Phase 4: 制約追加
```bash
# 1. 外部キー制約追加
sqlite3 data/database.db < migration_scripts/add_foreign_keys.sql

# 2. 最終検証
npm run test:full-integration

# 3. レガシー削除
npm run cleanup:legacy-code

# 4. 完了確認
npm run verify:migration-complete
```

## 📋 成功指標

### 技術指標
- **データ整合性**: 100%の整合性維持
- **性能改善**: 採点進捗計算で30%以上の高速化
- **障害率**: 移行に起因する障害0件
- **復旧時間**: 3分以内のロールバック完了

### 運用指標
- **稼働率**: 99.9%以上の可用性維持
- **ユーザー満足度**: 移行前後での満足度低下なし
- **サポート問い合わせ**: 移行に関する問い合わせ週間5件以下
- **開発効率**: 新機能開発時間20%短縮

## 🎉 結論

### 移行の必要性
現在の`pageNumber`ベースの暗黙的な関連付けは、データ整合性、性能、保守性の観点で重大な問題を抱えています。特に採点進捗計算における複雑なクエリは、システムの安定性とユーザー体験に悪影響を与えています。

### 推奨アプローチ
段階的な移行戦略により、システムの停止時間を最小限に抑えながら、確実な改善を実現できます。特にPhase 1（基盤整備）は低リスク・高効果であり、即座の実行を推奨します。

### 長期的価値
この移行により、Score at Onceは真に堅牢で拡張可能なシステムとなり、将来的な機能拡張や運用規模の拡大に対応できる基盤を獲得できます。

### 次のステップ
1. **Phase 1の実行承認**: 低リスクな基盤整備の開始
2. **チーム体制の整備**: 移行実行チームの組成
3. **詳細スケジュール策定**: 各フェーズの実行タイミング決定
4. **利害関係者への説明**: 移行の意義と効果の共有

---

**作成日**: 2025年7月11日  
**バージョン**: 1.0  
**作成者**: Score at Once開発チーム  
**承認者**: [承認者名]  

> 本レポートは、Score at Onceの継続的な改善と品質向上を目的として作成されています。実装にあたっては、チーム全体での十分な検討と合意形成を行ってください。