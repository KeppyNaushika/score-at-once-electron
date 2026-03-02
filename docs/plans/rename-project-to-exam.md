# Project → Exam / GradeProject → Grade 一括リネーム計画

## Context

アプリケーション内部で「Project」と呼ばれているエンティティは、実質的に「試験（Exam）」を表す。コードの意味的一貫性を高めるため、以下のリネームを実施する：

- `Project` → `Exam`（Prismaモデル、型、変数、関数、UI、URL、ファイルパス）
- `GradeProject` → `Grade`（同上）
- 日本語UI「プロジェクト」→「試験」
- アーカイブ形式を v1.5.0 にバンプ（`project.json` → `exam.json`）
- ファイルシステム `data/projects/` → `data/exams/`（既存データの自動マイグレーション付き）

## 規模

- **約400+ファイル**、6,500+行に影響
- Prismaモデル **12個**のリネーム
- IPC チャンネル名 **50+個**
- Next.jsルート `/projects/` → `/exams/`、`/grade-projects/` → `/grades/`

## 実施手順

### Step 1: 調査スクリプト作成・実行

`scripts/investigate-rename.ts` を作成し、ripgrep でカテゴリ別に出現回数をカウント。

カテゴリ：Prismaモデル名、型名、関数名、変数名、IPCチャンネル、URLパス、FSパス、アーカイブキー、日本語テキスト

### Step 2: 一括置換スクリプト作成・実行

`scripts/bulk-rename.ts` を作成。**置換順序が最重要**。

#### 置換順序（長い→短い、具体→抽象）

```
Phase A: GradeProject系（最も長い複合名から）
  1. GradeProjectExportSettings → GradeExportSettings
  2. GradeProjectStudent → GradeStudent
  3. GradeProjectClass → GradeClass
  4. GradeProjectWithDetails → GradeWithDetails
  5. gradeProjectId → gradeId
  6. grade-project: → grade:  (IPCチャンネル)
  7. /grade-projects/ → /grades/  (URL)
  8. [gradeProjectId] → [gradeId]  (ルートパラメータ)
  9. GradeProject → Grade  (残りの単体)
  10. gradeProject → grade

Phase B: Project複合名（ExamProjectの特殊処理前に）
  1. ProjectExportSettings → ExamExportSettings
  2. ProjectMarkingFormat → ExamMarkingFormat
  3. ProjectSubtotalGroup → ExamSubtotalGroup
  4. ProjectStudent → ExamStudent
  5. ProjectClass → ExamClass
  6. ProjectPage → ExamPage
  7. UserProject → UserExam

Phase C: examProject系（GradeDataSourceの既存フィールド）
  ※ Project→Examリネームで二重変換(examExam)を避けるため先に処理
  1. examProjectId → examId
  2. getExamProjectCandidates → getExamCandidates
  3. examProjectCandidates → examCandidates
  4. examProjectMatches → examMatches
  5. examProjectMapping → examMapping
  6. examProjectName → examName
  7. examProject → exam  (Prismaリレーション名)

Phase D: 型名・関数名
  1. ProjectWithDetails → ExamWithDetails
  2. SerializedProject → SerializedExam
  3. ArchiveProjectData → ArchiveExamData
  4. ExportProjectOptions → ExportExamOptions
  5. BulkExportProjectsOptions → BulkExportExamsOptions
  6. 他の複合型名...

Phase E: IPCチャンネル文字列
  1. "fetch-projects" → "fetch-exams"
  2. "fetch-project-by-id" → "fetch-exam-by-id"
  3. "create-project" → "create-exam"
  4. "archive:exportProject" → "archive:exportExam"
  5. 他のチャンネル...

Phase F: 関数名（個別）
  1. getProjectById → getExamById
  2. createProject → createExam
  3. fetchProjects → fetchExams
  4. useProject → useExam
  5. getProjectDirectory → getExamDirectory
  6. 他の関数名...

Phase G: 変数名（最後に一括）
  1. \bprojectId\b → examId
  2. \bprojectIds\b → examIds
  3. \bprojectName\b → examName

Phase H: モデル名単体（最後）
  1. \bProject\b → Exam  ← 全ての複合名が処理済みの後

Phase I: パス・文字列
  1. /projects/ → /exams/  (URL)
  2. "projects/" → "exams/"  (FSパス)
  3. "project.json" → "exam.json"  (アーカイブ)
  4. "Project" → "Exam"  (ConflictCategory文字列リテラル)

Phase J: 日本語テキスト
  1. プロジェクト → 試験
```

#### 除外対象

- `node_modules/`, `.next/`, `main/`, `dist/`, `.git/`
- `prisma/migrations/`（歴史的記録、変更不可）
- `playwright.config.ts` / `playwrightElectron.config.ts` の `projects:` キー（Playwright API）
- `"project_total"` 文字列リテラル（DB保存値、変更不可）

#### ファイル・ディレクトリリネーム（コンテンツ置換後に実行）

ディレクトリ（深い方から）:

- `app/projects/[projectId]` → `app/exams/[examId]`
- `app/projects` → `app/exams`
- `app/grade-projects/[gradeProjectId]` → `app/grades/[gradeId]`
- `app/grade-projects` → `app/grades`
- `components/projects` → `components/exams`
- `components/grade-projects` → `components/grades`
- `hooks/grade-projects` → `hooks/grades`
- `electron-src/lib/export/project-archive` → `electron-src/lib/export/exam-archive`
- `electron-src/lib/import/project-archive` → `electron-src/lib/import/exam-archive`

ファイル:

- `hooks/useProject.ts` → `hooks/useExam.ts`
- `hooks/useProjectDetail.ts` → `hooks/useExamDetail.ts`
- `types/projectArchive.types.ts` → `types/examArchive.types.ts`
- `types/gradeProject.types.ts` → `types/grade.types.ts`
- `electron-src/lib/prisma/project.ts` → `electron-src/lib/prisma/exam.ts`
- `electron-src/lib/prisma/gradeProject.ts` → `electron-src/lib/prisma/grade.ts`
- `electron-src/lib/prisma/projectClass.ts` → `electron-src/lib/prisma/examClass.ts`
- `electron-src/lib/prisma/projectPage.ts` → `electron-src/lib/prisma/examPage.ts`
- `electron-src/lib/prisma/projectSettings.ts` → `electron-src/lib/prisma/examSettings.ts`
- `electron-src/lib/prisma/projectStudent.ts` → `electron-src/lib/prisma/examStudent.ts`
- `electron-src/lib/prisma/gradeProjectStudent.ts` → `electron-src/lib/prisma/gradeStudent.ts`
- `electron-src/ipc-handlers/projectHandlers.ts` → `electron-src/ipc-handlers/examHandlers.ts`
- `electron-src/ipc-handlers/projectClassHandlers.ts` → `electron-src/ipc-handlers/examClassHandlers.ts`
- `electron-src/ipc-handlers/gradeProjectHandlers.ts` → `electron-src/ipc-handlers/gradeHandlers.ts`
- `electron-src/ipc-handlers/userProjectHandlers.ts` → `electron-src/ipc-handlers/userExamHandlers.ts`
- `utils/projectStatus.ts` → `utils/examStatus.ts`
- `utils/gradeProjectStatus.ts` → `utils/gradeStatus.ts`
- `__tests__/grade-project/` → `__tests__/grade/`
- `components/answer-sheet-builder/hooks/useProjectIntegration.ts` → `useExamIntegration.ts`
- `components/answer-sheet-builder/components/export/ProjectIntegrationDialog.tsx` → `ExamIntegrationDialog.tsx`
- `electron-src/lib/answer-sheet-builder/projectConverter.ts` → `examConverter.ts`

### Step 3: LLM手動処理

スクリプトで対応できない部分：

1. **import パスの修正** - ディレクトリリネーム後、import文の参照先更新。`npm run typecheck` の TS2307 エラーを順次修正
2. **Prismaスキーマ** - `@@map` / `@map` アノテーションの手動追加（後述）
3. **テストデータ** - テストファイル内のアサーション文字列、ファクトリ関数名
4. **文脈依存の判断** - `examName` フィールド名の衝突確認（Examモデルの既存フィールド `examName` vs リネーム後の変数 `examName`）
5. **`electron-src/lib/export/exam-archive/index.ts`** のstale `version: "1.1.0"` を `CURRENT_VERSION` に修正

### Step 4: アーカイバー処理（v1.4.0 → v1.5.0）

#### 4a. Prismaスキーマ - `@@map`/`@map` 方式

DB テーブル名は変更せず、TypeScript側の名前のみ変更：

```prisma
model Exam {
  // ... fields unchanged ...
  @@map("Project")
}
model ExamPage {
  examId String @map("projectId")
  @@map("ProjectPage")
}
model ExamStudent {
  examId String @map("projectId")
  @@map("ProjectStudent")
}
model ExamSubtotalGroup {
  examId String @map("projectId")
  @@map("ProjectSubtotalGroup")
}
model ExamClass {
  examId String @map("projectId")
  @@map("ExamClass")  // 実テーブル名は "ProjectClass"
}
model UserExam {
  examId String @map("projectId")
  @@map("UserProject")
}
model Grade {
  @@map("GradeProject")
}
model GradeClass {
  gradeId String @map("gradeProjectId")
  @@map("GradeProjectClass")
}
model GradeStudent {
  gradeId String @map("gradeProjectId")
  @@map("GradeProjectStudent")
}
model GradeExportSettings {
  gradeId String @map("gradeProjectId")
  @@map("GradeProjectExportSettings")
}
// GradeDataSource:
model GradeDataSource {
  examId String? @map("examProjectId")
  exam   Exam?   @relation(fields: [examId], references: [id])
}
```

`npx prisma migrate dev --name rename_project_to_exam` → 空のマイグレーションが生成されるはず（@@mapのため）

#### 4b. アーカイブバージョンバンプ

**`electron-src/lib/import/transformers/types.ts`**:

- `ArchiveVersion` に `"1.5.0"` 追加
- `CURRENT_VERSION = "1.5.0"`
- `ArchiveData.projectData` → `ArchiveData.examData`

**新規: `V1_4_0_to_V1_5_0.ts` Transformer**:

- `manifest.projectId` → `manifest.examId`
- `manifest.projectName` → `manifest.examName`
- `projectData` キーの各フィールドをリネーム（`projectPages` → `examPages` 等）
- `userProjects` → `userExams`

**`archiveExtractor.ts`**: `exam.json` を先に探し、なければ `project.json` にフォールバック

**`archiveCreator.ts`**: 出力ファイル名を `exam.json` に変更

**`manifestValidator.ts`**: 必須フィールドを `examId`/`examName` に更新（古いアーカイブはTransformerで変換済み）

#### 4c. ファイルシステムマイグレーション

**`dataManager.ts`** に `migrateProjectsToExams()` を追加:

- アプリ起動時に `data/projects/` が存在する場合、`data/exams/` にコピー後削除
- 既存の `migrateFromApplicationSupport()` パターンに準拠
- `getExamDirectory()` は `data/exams/<examId>` を返す
- `initializeDataDirectory()` は `data/exams/` を作成

#### 4d. `databaseInitializer.ts` の Raw SQL

このファイル内の Raw SQL 文字列はDBテーブル名（`"Project"`, `"ProjectStudent"` 等）を参照。`@@map` 方式なのでテーブル名は変わらず、**変更不要**。

### Step 5: 検証

```bash
# 1. Prisma再生成
npx prisma generate

# 2. TypeScript型チェック
npm run typecheck

# 3. Lint
npm run lint

# 4. テスト
npm test

# 5. 残存チェック（ゼロであるべき）
rg --glob '!node_modules/**' --glob '!main/**' --glob '!.next/**' \
   --glob '!prisma/migrations/**' --glob '!scripts/**' \
   '\bGradeProject\b|\bgradeProjectId\b|"grade-project:' .

# 6. 変更してはいけないもの確認
rg 'project_total' electron-src/  # 存在するべき
rg 'projects:' playwright.config.ts  # 存在するべき
```

手動テスト:

- [ ] 新規試験の作成 → `data/exams/<uuid>/` に保存される
- [ ] `/exams/<id>/01-upload` URL動作
- [ ] `/grades/<id>/01-setup` URL動作
- [ ] `.score` アーカイブエクスポート → `exam.json` + `manifest.examId`
- [ ] v1.4.0の旧 `.score` ファイルインポート（後方互換）
- [ ] Grade機能: IPCチャンネル `grade:` プレフィックス動作
- [ ] `project_total` タイプのGradeDataSource動作
- [ ] UI表示が全て「試験」
- [ ] 既存 `data/projects/` → `data/exams/` 自動マイグレーション
