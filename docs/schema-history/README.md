# Prisma Schema History

アーカイブバージョンごとのPrismaスキーマ履歴

## バージョン対応表

| Archive Version | App Version | Git Tag         | ファイル                    |
| --------------- | ----------- | --------------- | --------------------------- |
| 1.0.0           | v0.2.x      | v0.2.21-alpha.0 | schema-v1.0.0-v0.2.x.prisma |
| 1.1.0           | v0.3.x      | v0.3.2-beta.0   | schema-v1.1.0-v0.3.x.prisma |
| 1.2.0           | v0.4.x      | v0.4.5-alpha.0  | schema-v1.2.0-v0.4.x.prisma |
| 1.3.0           | v0.5.x      | (current)       | schema-v1.3.0-v0.5.x.prisma |

## バージョン間の主な変更点

### v1.0.0 → v1.1.0 (v0.2.x → v0.3.x)

#### 追加されたテーブル

- `ProjectClass` - プロジェクトと学級の関連付け
- `Subject` - 教科マスター
- `SubjectSubtotalGroup` - 教科と小計グループの関連
- `UserKeyboardShortcut` - ユーザー別キーボードショートカット
- `UserScoringPreference` - ユーザー別採点設定
- `ProjectMarkingFormat` - プロジェクト別採点マーク設定
- `ProjectExportSettings` - プロジェクト別エクスポート設定
- `CropRegionMarkingOverride` - 領域別マーク上書き設定

#### 変更されたテーブル

- `UserProject`
  - `invitedAt` フィールド追加
  - `invitedBy` フィールド追加
  - `@@unique([userId, projectId])` 制約追加

- `User`
  - `invitedUserProjects` リレーション追加
  - `keyboardShortcuts` リレーション追加
  - `scoringPreference` リレーション追加

- `Class`
  - `projectClasses` リレーション追加

- `SubtotalGroup`
  - `subjectSubtotalGroups` リレーション追加

- `CropRegion`
  - `markingOverrides` リレーション追加

### v1.1.0 → v1.2.0 (v0.3.x → v0.4.x)

#### 追加されたテーブル

- `MasterImage` - 模範解答画像（PageImageから分離）
- `StudentAnswerImage` - 答案画像（PageImageから分離）

#### 削除されたテーブル

- `PageImage` - MasterImage/StudentAnswerImageに分離

#### 変更されたテーブル

- `QuestionScore`
  - `scoredByUserId` → `userId` にリネーム
  - `studentId` が非NULL化（必須フィールド）
  - `userId` が非NULL化（必須フィールド）

- `DrawingAnnotation`
  - `createdByUserId` → `userId` にリネーム
  - `userId` が非NULL化（必須フィールド）

- `Student`
  - `pageImages` → `studentAnswerImages` に変更

- `ProjectPage`
  - `pageImages` → `masterImages` + `studentAnswerImages` に変更

### v1.2.0 → v1.3.0 (v0.4.x → v0.5.x)

#### 変更されたテーブル

- `Student`
  - `studentId` → `studentNumber` にリネーム
  - 学籍番号フィールド名の明確化（FK の studentId との混同を防ぐ）

## インポート時の変換ロジック

### v1.0.0 アーカイブのインポート

1. `UserProject.invitedAt` = `createdAt` で補完
2. `UserProject.invitedBy` = null で補完
3. `projectClasses` = 空配列で初期化

### v1.1.0 アーカイブのインポート

1. `pageImages` → `masterImages` / `studentAnswerImages` に変換
   - `imageType === "MODEL_ANSWER"` → `MasterImage`
   - `imageType === "STUDENT_ANSWER"` → `StudentAnswerImage`
2. `scoredByUserId` → `userId` にリネーム
3. `createdByUserId` → `userId` にリネーム
4. `studentId`/`userId` が null のスコアはスキップ

### v1.2.0 アーカイブのインポート

1. `Student.studentId` → `Student.studentNumber` にリネーム

## 連鎖変換パターン

```
1.0.0 → 1.1.0 → 1.2.0 → 1.3.0
```

各変換器は「次のバージョンへの変換」のみを担当し、
古いバージョンからのインポートは変換器を連鎖的に適用することで実現する。
