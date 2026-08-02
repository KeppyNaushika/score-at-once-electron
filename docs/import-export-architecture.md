# インポート/エクスポート (アーカイブ) アーキテクチャ

## 目次

1. [概要](#概要)
2. [アーカイブファイル形式](#アーカイブファイル形式)
3. [エクスポート処理](#エクスポート処理)
4. [インポート処理](#インポート処理)
5. [ID管理戦略](#id管理戦略)
6. [採点結果の競合解決](#採点結果の競合解決)
7. [バージョン変換システム](#バージョン変換システム)
8. [インポートウィザードUI](#インポートウィザードui)
9. [データフロー図](#データフロー図)
10. [ファイル責務一覧](#ファイル責務一覧)

---

## 概要

本システムは、Electronベースの採点アプリケーションにおける試験データの可搬性を実現するインポート/エクスポート機能である。複数PCでの協調採点を想定し、`.score`拡張子のZIPアーカイブを介して試験データを安全に受け渡す。

### 主要な2つのフロー

1. **エクスポート**: `Exam` → `dataCollector.ts` → `archiveCreator.ts` → `.score`ファイル (ZIP)
2. **インポート**: `.score`ファイル → `archiveExtractor.ts` → `matcher.ts` → `idIntegrationImporter.ts` → DB

```mermaid
flowchart LR
    subgraph エクスポート
        A[Exam DB] --> B[dataCollector]
        B --> C[archiveCreator]
        C --> D[".score ファイル"]
    end

    subgraph インポート
        D --> E[archiveExtractor]
        E --> F[transformExamArchiveToLatest<br/>バージョン変換チェーン]
        F --> G[matcher<br/>事前照合]
        G --> H[ウィザードUI<br/>ユーザー判断]
        H --> I[idIntegrationImporter<br/>Stage 1 + Stage 2]
        I --> J[DB]
    end
```

---

## アーカイブファイル形式

### 基本仕様

| 項目             | 値                                                         |
| ---------------- | ---------------------------------------------------------- |
| ファイル拡張子   | `.score`                                                   |
| 内部形式         | ZIP (archiver ライブラリ使用)                              |
| 圧縮レベル       | zlib level 9 (最高圧縮率)                                  |
| 展開ライブラリ   | adm-zip                                                    |
| 現在のバージョン | `EXAM_CURRENT_VERSION`（`src/types/examArchive.types.ts`） |

### アーカイブ内部構造

```
archive.score (ZIP)
├── manifest.json           # メタデータ (バージョン、件数、エクスポート情報)
├── exam.json            # 試験本体 + ページ + 領域 + 画像参照
├── students.json           # 生徒データ
├── classes.json            # 学級データ + 学級所属 (membership)
├── users.json              # ユーザーデータ (パスワード除外)
├── subtotals.json          # 小計グループ + 小計 + CropSubtotal
├── scores.json             # QuestionScore + DrawingAnnotation
├── subjects.json           # 教科データ (v1.4.0+)
├── master-images/          # 模範解答画像ファイル
│   ├── page1.png
│   └── page2.png
└── answer-sheets/          # 答案画像ファイル
    ├── student1/
    │   └── page1.png
    └── student2/
        └── page1.png
```

### manifest.json の構造

```typescript
interface ArchiveManifest {
  version: string // ExamArchiveVersion ("1.0.0" 〜 EXAM_CURRENT_VERSION)
  schemaVersion: string // Prismaマイグレーション名
  appVersion: string // アプリバージョン
  exportedAt: string // ISO 8601 日時
  examId: string // 試験ID
  examName: string // 試験名
  exportedBy?: string // エクスポートしたユーザー名
  counts: ArchiveDataCounts // 各データの件数
}
```

### exam.json の主要フィールド (v1.4.0)

| フィールド            | 説明                                                    |
| --------------------- | ------------------------------------------------------- |
| `exam`                | 試験基本情報 (examName, examDate, subject, description) |
| `examPages`           | ページ一覧 (id, examId, pageNumber)                     |
| `cropRegions`         | 採点領域一覧 (座標、ラベル、配点等)                     |
| `masterImages`        | 模範解答画像レコード (v1.2.0+)                          |
| `studentAnswerImages` | 答案画像レコード (v1.2.0+)                              |
| `pageImages`          | レガシー画像レコード (v1.1.0以前との後方互換性、空配列) |
| `examStudents`        | 試験-生徒紐づけ                                         |
| `userExams`           | 空配列 (v0.3.0+、インポート時に現在のユーザーで再作成)  |
| `examSubtotalGroups`  | 試験-小計グループ紐づけ                                 |
| `examClassrooms`      | 試験-学級紐づけ                                         |
| `examMarkingFormats`  | 採点マーク設定 (v1.4.0+)                                |
| `examExportSettings`  | エクスポート設定 (v1.4.0+)                              |

---

## エクスポート処理

### 処理フロー

```mermaid
flowchart TD
    A[exportExam 呼び出し] --> B[getExamById<br/>試験存在確認]
    B --> C[collectExamData<br/>全データ収集]
    C --> D{出力先指定あり?}
    D -->|No| E[dialog.showSaveDialog<br/>ファイル選択ダイアログ]
    D -->|Yes| F[createArchive<br/>ZIP作成]
    E --> F
    F --> G[".score ファイル出力"]
```

### dataCollector.ts の処理詳細

`collectExamData(examId, userId)` は以下の順序でデータを収集する。

| 手順 | 処理                                   | 備考                                                                  |
| ---- | -------------------------------------- | --------------------------------------------------------------------- |
| 1    | Prisma `exam.findUnique` + includes    | examPages, cropRegions, questionScores, drawingAnnotations を一括取得 |
| 2    | 関連する生徒IDを収集                   | examStudents, studentAnswerImages, questionScores から                |
| 3    | 生徒データを取得                       | `student.findMany`                                                    |
| 4    | 学級と所属を取得                       | StudentClassroomMembership 経由                                       |
| 5    | 現在ユーザーのみ取得                   | **パスワード除外** (`select` で passcode を除外)                      |
| 6    | (欠番)                                 | -                                                                     |
| 7    | 小計グループ・小計を取得               | examSubtotalGroups 経由                                               |
| 7.5  | ExamMarkingFormat 取得                 | v1.4.0+                                                               |
| 7.6  | ExamExportSettings 取得                | v1.4.0+                                                               |
| 7.7  | Subject / SubjectSubtotalGroup 取得    | v1.4.0+                                                               |
| 8    | 画像パスを収集                         | masterImages, studentAnswerImages                                     |
| 9    | QuestionScore / DrawingAnnotation 収集 | **ログインユーザーのデータのみ** (v0.3.0+)                            |
| 10   | データを整形                           | 全データをJSON化可能な構造に変換                                      |
| 11   | 件数を集計                             | ArchiveDataCounts                                                     |

### エクスポートの重要ルール

- **ユーザーフィルタリング**: `userId` に一致するQuestionScoreのみ収集。他ユーザーの採点データはエクスポートされない。DrawingAnnotationは採点者を持たず（v1.24.0で廃止）、収集済みのQuestionScoreにぶら下がるものがそのまま対象になる。
- **UUIDの保持**: IDのリマッピングは行わず、そのままエクスポート。
- **パスワード除外**: ユーザーデータからパスコードを除外してセキュリティを確保。
- **UserExamは空配列**: v0.3.0以降、UserExamはエクスポートせず、インポート時に現在のユーザーで再作成。

### archiveCreator.ts の処理

1. ZIPストリーム (archiver) を作成
2. `manifest.json` を追加
3. 各JSONデータファイル (exam, students, classes, users, subtotals, scores, subjects) を追加
4. マスター画像を `master-images/` 配下に追加
5. 答案画像を `answer-sheets/` 配下に追加
6. `archive.finalize()` でZIPを完了

ファイル名のデフォルト形式: `{examName}-yyyy-MM-dd-hh-mm-ss.score`

---

## インポート処理

インポートは大きく分けて **事前照合** と **2段階データ挿入** で構成される。

### 全体フロー

```mermaid
flowchart TD
    A[".score ファイル選択"] --> B[archiveExtractor<br/>ZIP展開 + JSON読み込み]
    B --> C[transformExamArchiveToLatest<br/>バージョン変換チェーン]
    C --> D[manifestValidator<br/>マニフェスト検証]
    D --> E[performPreMatching<br/>事前照合]
    E --> F["ウィザード UI (6ステップ)"]
    F --> G{ユーザーの判断}
    G --> H[detectScoringConflictsWithUserDecisions<br/>採点競合検出]
    H --> I[executeIdIntegrationImport]

    subgraph "Stage 1: 単一トランザクション"
        I --> J[processStudentIdIntegration]
        J --> K[processClassroomIdIntegration]
        K --> L[processSubtotalGroupIdIntegration]
        L --> M[processSubtotals]
        M --> N[processExam]
        N --> O[processUserExam]
        O --> P[processExamSubtotalGroups]
        P --> Q[processExamStudents]
        Q --> R[processExamPages]
        R --> S[processCropRegions]
        S --> T[processCropSubtotals]
        T --> U[processQuestionScores]
        U --> V[processDrawingAnnotations]
        V --> W[processMemberships]
    end

    W --> X{idChangeTargets あり?}
    X -->|Yes| Y["Stage 2: executeIdChanges<br/>(個別トランザクション)"]
    X -->|No| Z[画像コピー]
    Y --> Z

    subgraph "画像処理 (トランザクション外)"
        Z --> AA[copyImportImages<br/>ファイルコピー]
        AA --> AB[createImportImageRecords<br/>DBレコード作成]
    end

    AB --> AC[インポート完了]
```

### Stage 1: マッピングとデータ挿入

`prisma.$transaction` 内で以下の処理を順次実行する。

| 順序 | 関数                                | 処理内容                                       |
| ---- | ----------------------------------- | ---------------------------------------------- |
| 1    | `processStudentIdIntegration`       | 生徒のID照合 + 新規作成/既存紐づけ             |
| 2    | `processClassroomIdIntegration`     | 学級のID照合 + 新規作成/既存紐づけ             |
| 3    | `processSubtotalGroupIdIntegration` | 小計グループのID照合 + 新規作成/既存紐づけ     |
| 4    | `processSubtotals`                  | 小計のマージ (名前+グループで重複チェック)     |
| 5    | `processExam`                       | 試験作成 or 既存マージ判定                     |
| 6    | `processUserExam`                   | 現在のユーザーを試験に紐づけ (OWNER or MEMBER) |
| 7    | `processExamSubtotalGroups`         | 試験-小計グループ紐づけ                        |
| 8    | `processExamStudents`               | 試験-生徒紐づけ                                |
| 9    | `processExamPages`                  | ページ作成 (試験ID不一致時のみ)                |
| 10   | `processCropRegions`                | 採点領域作成 (試験ID不一致時のみ)              |
| 11   | `processCropSubtotals`              | 領域-小計紐づけ                                |
| 12   | `processQuestionScores`             | 採点データ挿入 (競合解決対応)                  |
| 13   | `processDrawingAnnotations`         | 描画アノテーション挿入                         |
| 14   | `processMemberships`                | 学級所属紐づけ                                 |

### Stage 2: ID変更処理

ユーザーが `use_import_id`（書き出したPCのIDに合わせる）を選択した場合のみ実行される。

**処理手順** (対象: student, class, subtotalGroup):

1. 新しいIDでレコードを複製作成
2. 全FK参照を新IDに更新 (`updateMany`)
3. 旧レコードを削除
4. `idMappings` を更新

**注意**: Stage 2は各ターゲットごとに個別の `prisma.$transaction` で実行される。

### 画像処理

Stage 1/Stage 2の後、トランザクション外で実行される。

| 関数                       | 処理                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| `copyImportImages`         | 一時ディレクトリから試験ディレクトリへファイルコピー (既存ファイルはスキップ) |
| `createImportImageRecords` | MasterImage / StudentAnswerImage のDBレコード作成                             |

---

## ID管理戦略

### IdMappings の構造

`IdMappings` はインポートID (キー) から実際のDB上のID (値) へのマッピングを保持する。

```typescript
interface IdMappings {
  student: Record<string, string> // 生徒
  class: Record<string, string> // 学級
  subtotalGroup: Record<string, string> // 小計グループ
  subtotal: Record<string, string> // 小計
  exam: Record<string, string> // 試験
  examPage: Record<string, string> // ページ
  cropRegion: Record<string, string> // 採点領域
  masterImage: Record<string, string> // 模範画像
  studentAnswerImage: Record<string, string> // 答案画像
  examStudent: Record<string, string> // 試験-生徒
  userExam: Record<string, string> // ユーザー-試験
  examSubtotalGroup: Record<string, string> // 試験-小計グループ
  cropSubtotal: Record<string, string> // 領域-小計
  questionScore: Record<string, string> // 採点結果
  drawingAnnotation: Record<string, string> // 描画アノテーション
  membership: Record<string, string> // 学級所属
}
```

### マッチング階層

```mermaid
flowchart TD
    A[インポートデータ] --> B{UUID一致?}
    B -->|Yes| C[自動マッピング<br/>byId]
    B -->|No| D{二次照合?}
    D -->|学籍番号一致| E[byStudentNumber<br/>ユーザー判断要]
    D -->|氏名一致| F[byName<br/>ユーザー判断要]
    D -->|不一致| G[noMatch<br/>新規作成]

    E --> H{ユーザーの判断}
    F --> H
    H -->|同じ人| I[既存IDにマッピング]
    H -->|新規作成| J[新規レコード作成]
    H -->|スキップ| K[インポートしない]

    I --> L{IDの選択}
    L -->|use_existing_id| M[既存IDを維持]
    L -->|use_import_id| N["Stage 2でID変更"]
```

### マッチング対象カテゴリ

| カテゴリ                     | UUID照合 | 二次照合キー                      |
| ---------------------------- | -------- | --------------------------------- |
| 生徒 (Student)               | id       | studentNumber, lastName+firstName |
| 学級 (Classroom)             | id       | name, classroomCode               |
| 小計グループ (SubtotalGroup) | id       | name                              |
| ユーザー (User)              | id       | username                          |
| 試験 (Exam)                  | id       | (なし - ID一致のみ)               |

### マッチング戦略 (ユーザー選択)

| 戦略                | 説明                                           |
| ------------------- | ---------------------------------------------- |
| `by_student_number` | 学籍番号一致をデフォルトで「同じ人」として扱う |
| `by_name`           | 氏名一致をデフォルトで「同じ人」として扱う     |
| `all_new`           | 全てを新規作成として扱う                       |
| (個別判断)          | decisions配列で各レコードごとに判断を上書き    |

---

## 採点結果の競合解決

### 競合検出の仕組み

同じ試験 (ID一致) で同じ生徒 x 同じ採点領域に対して、既存DBとインポートデータの両方に採点結果が存在する場合に競合が発生する。

```typescript
// 競合のキー
const key = `${studentId}:${cropRegionId}`
```

### 4つの解決戦略

| 戦略            | 説明                                                          | デフォルト     |
| --------------- | ------------------------------------------------------------- | -------------- |
| `newer_wins`    | 最終更新日時が新しい方を採用                                  | **デフォルト** |
| `import_wins`   | 常にインポートデータを採用                                    | -              |
| `existing_wins` | 常に既存データを維持                                          | -              |
| `manual`        | 競合ごとに個別判断 (未設定分は `newer_wins` にフォールバック) | -              |

### 競合解決のフロー

```mermaid
flowchart TD
    A[QuestionScore処理] --> B{conflictMapに存在?}
    B -->|No| C[新規作成 or ID存在チェック]
    B -->|Yes| D{データ同一?}
    D -->|Yes| E[unchanged としてスキップ]
    D -->|No| F[resolveScoringConflict]
    F --> G{解決結果}
    G -->|existing| H[既存データを維持<br/>skipped++]
    G -->|import| I[既存データを更新<br/>updated++]
```

---

## バージョン変換システム

### 連鎖変換パターン

古いバージョンのアーカイブは、現在のバージョン（`EXAM_CURRENT_VERSION`）まで段階的に変換される。

```
1.0.0 → 1.1.0 → 1.2.0 → … → 1.16.0 → 1.17.0
```

### バージョン履歴

全履歴は `src/types/examArchive.types.ts` の `ExamArchiveVersion` コメントに記録。代表例:

| バージョン | アプリバージョン | 主な変更                                                                                            |
| ---------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `1.0.0`    | v0.2.x           | 初期形式。UserExam.invitedAt/invitedBy なし、PageImage使用                                          |
| `1.1.0`    | v0.3.x           | UserExam完全対応、ExamClass追加                                                                     |
| `1.2.0`    | v0.4.x           | MasterImage/StudentAnswerImage分離、userId/studentId非NULL化                                        |
| `1.3.0`    | v0.5.x           | Student.studentId → Student.studentNumber リネーム                                                  |
| `1.4.0`    | v0.5.x           | ExamMarkingFormat, ExamExportSettings, CropRegionMarkingOverride, Subject, SubjectSubtotalGroup追加 |
| `1.5.0`    | v0.6.x           | Project→Exam リネーム（JSON キー project\* → exam\*、project.json → exam.json）                     |
| `1.15.0`   | v0.14.x          | 学級統計再設計（statistics 廃止 → teacherStat/studentReport、selectedForTable/selectedForBoxPlot）  |
| `1.16.0`   | v0.14.x          | Class→Classroom リネーム（examClasses→examClassrooms、classId→classroomId、teacherStatistics）      |
| `1.17.0`   | v0.15.x          | ExamStudent.status 小文字統一                                                                       |
| `1.18.0`   | v0.16.x          | CropRegionMarkingOverride 廃止（UI・出力反映が無いまま入出力のみ維持されていたため削除）            |
| `1.19.0`   | v0.16.x          | DeletedRecord tombstone 廃止（1.9.0を撤回。削除の伝搬は sqlite-nas-sync の `_tombstone` へ一本化）  |
| `1.20.0`   | v0.16.x          | CropRegionAssignment 追加（設問ごとの採点担当。User はアーカイブを越えないため username で照合）    |

### 変換器インターフェース

```typescript
interface ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion
  readonly toVersion: ExamArchiveVersion
  transform(data: ExamArchiveData): ExamTransformResult
}
```

各変換器は1段階のみの変換を担当し、`transformers/index.ts` の `transformExamArchiveToLatest` がチェーンを構築して順次適用する。チェーンは `archiveExtractor.extractArchive` 内で実行されるため、全インポート経路（事前照合・競合検出・ID統合インポート）が自動的に最新形式のデータを受け取る。

### バージョン検出（manifest + 形状ベース下方補正）

`detectExamArchiveVersion` は manifest.version を基点に判定するが、旧形式にしか現れない形状マーカー（`examClasses` キー、`statistics` フラグ、final/proposed 採点行、大文字 status 等）を検出した場合は、そのマーカーを処理する変換器が必ず走るバージョンまで検出結果を引き下げる。全変換器は冪等のため、引き下げすぎても余分な no-op 変換が走るだけで実害はない。

---

## インポートウィザードUI

### 6ステップのフロー

```mermaid
flowchart LR
    S1["Step 1<br/>file_select<br/>ファイル選択"] --> S2["Step 2<br/>file_overview<br/>ファイル概要"]
    S2 --> S3["Step 3<br/>id_integration<br/>データの統合"]
    S3 --> S4["Step 4<br/>update_confirm<br/>データの更新"]
    S4 --> S5["Step 5<br/>final_confirm<br/>最終確認"]
    S5 --> S6["Step 6<br/>execute<br/>実行"]
```

| ステップ | 名称             | 処理内容                                                                  |
| -------- | ---------------- | ------------------------------------------------------------------------- |
| Step 1   | `file_select`    | `.score`ファイルの選択、ZIP展開、バージョン変換                           |
| Step 2   | `file_overview`  | 事前照合結果の表示 (ID一致数、学籍番号一致数、氏名一致数、不一致数)       |
| Step 3   | `id_integration` | 各レコードのID統合方針をユーザーが決定 (同じ人/新規作成/スキップ, ID選択) |
| Step 4   | `update_confirm` | ID以外のフィールド更新方針を決定 (use_import / use_existing / use_newer)  |
| Step 5   | `final_confirm`  | 全設定の最終確認、採点競合の表示と解決戦略設定                            |
| Step 6   | `execute`        | `executeIdIntegrationImport` の実行、進捗表示                             |

### 状態管理

`useImportWizard` フック (`hooks/import/useImportWizard.ts`) がウィザード全体の状態を管理する。

主要な状態:

- `currentStep`: 現在のステップ
- `archiveData`: 展開されたアーカイブデータ
- `preMatchResult`: 事前照合結果 (`FileOverviewData`)
- `integrationConfig`: ユーザーのID統合設定
- `scoringConflictConfig`: 採点競合解決設定
- `updateDecisions`: フィールド更新決定

---

## データフロー図

### エクスポートのデータフロー

```mermaid
flowchart TD
    subgraph "Prisma DB"
        DB_P[Exam]
        DB_PP[ExamPage]
        DB_CR[CropRegion]
        DB_QS[QuestionScore]
        DB_DA[DrawingAnnotation]
        DB_S[Student]
        DB_C[Classroom]
        DB_U[User]
        DB_SG[SubtotalGroup]
        DB_MI[MasterImage]
        DB_SAI[StudentAnswerImage]
        DB_PMF[ExamMarkingFormat]
        DB_PES[ExamExportSettings]
        DB_SUB[Subject]
    end

    subgraph "dataCollector.ts"
        DC[collectExamData]
        DC -->|"userId フィルタ"| FILTER["ログインユーザーの<br/>QS/DA のみ"]
        DC -->|"passcode 除外"| SEC["セキュリティ"]
    end

    DB_P --> DC
    DB_PP --> DC
    DB_CR --> DC
    DB_QS --> DC
    DB_DA --> DC
    DB_S --> DC
    DB_C --> DC
    DB_U --> DC
    DB_SG --> DC
    DB_MI --> DC
    DB_SAI --> DC
    DB_PMF --> DC
    DB_PES --> DC
    DB_SUB --> DC

    subgraph "archiveCreator.ts"
        AC[createArchive]
        AC --> MF[manifest.json]
        AC --> PJ[exam.json]
        AC --> SJ[students.json]
        AC --> CJ[classes.json]
        AC --> UJ[users.json]
        AC --> STJ[subtotals.json]
        AC --> SCJ[scores.json]
        AC --> SUJ[subjects.json]
        AC --> IMG["画像ファイル"]
    end

    DC --> AC
    AC --> ZIP[".score (ZIP level 9)"]
```

### インポートのID判断フロー

```mermaid
flowchart TD
    START[インポートレコード] --> CHECK_UUID{UUID一致?}

    CHECK_UUID -->|Yes| AUTO["自動マッピング<br/>idMappings[importId] = existingId"]

    CHECK_UUID -->|No| CHECK_SECONDARY{二次照合一致?<br/>学籍番号/氏名/名前}

    CHECK_SECONDARY -->|Yes| USER_DECIDE{ユーザーの判断<br/>decisions}

    CHECK_SECONDARY -->|No| NO_MATCH[noMatch]
    NO_MATCH --> DEFAULT_NEW["デフォルト: create_new"]

    USER_DECIDE -->|same_person| CHOOSE_ID{ID選択}
    USER_DECIDE -->|create_new| CREATE["新規レコード作成<br/>インポートIDを使用"]
    USER_DECIDE -->|skip| SKIP[スキップ]

    CHOOSE_ID -->|use_existing_id| MAP_EXISTING["既存IDにマッピング"]
    CHOOSE_ID -->|use_import_id| MAP_IMPORT["既存IDにマッピング<br/>+ Stage 2でID変更予約"]

    DEFAULT_NEW --> CREATE
```

---

## ファイル責務一覧

### エクスポート関連

| ファイルパス                                             | 責務                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `electron-src/lib/export/exam-archive/index.ts`          | エクスポートのエントリーポイント。ダイアログ表示、データ収集、アーカイブ作成の統合 |
| `electron-src/lib/export/exam-archive/dataCollector.ts`  | Prisma経由で全試験データを収集。ユーザーフィルタリング、パスワード除外             |
| `electron-src/lib/export/exam-archive/archiveCreator.ts` | ZIPアーカイブの作成。JSON + 画像ファイルのパッケージング                           |

### インポート関連 - アーカイブ展開

| ファイルパス                                                   | 責務                                        |
| -------------------------------------------------------------- | ------------------------------------------- |
| `electron-src/lib/import/exam-archive/archiveExtractor.ts`     | ZIP展開、JSON読み込み、一時ディレクトリ管理 |
| `electron-src/lib/import/exam-archive/manifestValidator.ts`    | マニフェストのバリデーション                |
| `electron-src/lib/import/exam-archive/imageHandler.ts`         | 画像ファイルの処理                          |
| `electron-src/lib/import/exam-archive/dataCreator.ts`          | データ作成ヘルパー                          |
| `electron-src/lib/import/exam-archive/idRemapper.ts`           | IDリマッピングユーティリティ                |
| `electron-src/lib/import/exam-archive/uniqueNameGenerators.ts` | 重複名の自動生成                            |

### インポート関連 - バージョン変換

| ファイルパス                                               | 責務                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/types/examArchive.types.ts`                           | バージョン定義（`ExamArchiveVersion`/`EXAM_CURRENT_VERSION`）、変換器インターフェース    |
| `electron-src/lib/import/shared/transformChain.ts`         | 全アーカイブ共通のチェーン基盤（範囲判定・連鎖適用。exam/coursework/asb/student 共有）   |
| `electron-src/lib/import/transformers/index.ts`            | exam変換チェーンの構築と実行（`transformExamArchiveToLatest`、形状ベースバージョン検出） |
| `electron-src/lib/import/transformers/V<FROM>_to_V<TO>.ts` | 各1段階の変換器（`V1_0_0_to_V1_1_0.ts` 〜 `V1_16_0_to_V1_17_0.ts` の17個）               |
| `electron-src/lib/import/shared/legacyClassroomKeys.ts`    | 学級リネーム前の JSON キー正規化（`V1_15_0_to_V1_16_0` から利用）                        |

### インポート関連 - マッチングとマージ

| ファイルパス                                                     | 責務                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `electron-src/lib/import/merge/matcher.ts`                       | 全カテゴリのマッチング統合、事前照合 (`performPreMatching`) |
| `electron-src/lib/import/merge/matchers/studentMatcher.ts`       | 生徒のマッチング (UUID、学籍番号、氏名)                     |
| `electron-src/lib/import/merge/matchers/classroomMatcher.ts`     | 学級のマッチング (UUID、名前、classroomCode)                |
| `electron-src/lib/import/merge/matchers/subtotalGroupMatcher.ts` | 小計グループのマッチング (UUID、名前)                       |
| `electron-src/lib/import/merge/matchers/userMatcher.ts`          | ユーザーのマッチング (UUID、username)                       |
| `electron-src/lib/import/merge/matchers/types.ts`                | マッチャー共通型定義                                        |
| `electron-src/lib/import/merge/matchers/index.ts`                | マッチャーの再エクスポート                                  |

### インポート関連 - データ挿入

| ファイルパス                                                         | 責務                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `electron-src/lib/import/merge/idIntegrationImporter.ts`             | **Stage 1**: 単一トランザクションでの全データ挿入。`executeIdIntegrationImport` がメインエントリーポイント |
| `electron-src/lib/import/merge/processors/studentProcessor.ts`       | 生徒のID統合処理 (新規作成、既存紐づけ、フィールド更新、ID変更予約)                                        |
| `electron-src/lib/import/merge/processors/classroomProcessor.ts`     | 学級のID統合処理                                                                                           |
| `electron-src/lib/import/merge/processors/subtotalGroupProcessor.ts` | 小計グループのID統合処理                                                                                   |
| `electron-src/lib/import/merge/processors/index.ts`                  | プロセッサーの再エクスポート                                                                               |
| `electron-src/lib/import/merge/idChangeExecutor.ts`                  | **Stage 2**: ID変更処理 (レコード複製 → FK更新 → 旧レコード削除)                                           |
| `electron-src/lib/import/merge/imageImporter.ts`                     | 画像ファイルのコピーとDBレコード作成                                                                       |
| `electron-src/lib/import/merge/importExamCore.ts`                    | 試験骨格（Exam根・ExamPage・CropRegion・UserExam/ExamSubtotalGroup/ExamStudent）の処理                     |
| `electron-src/lib/import/merge/importExamAttachments.ts`             | 試験付随データ（採点マーク・出力設定・OMR設定・複合解答・タグ・ExamClassroom）の処理                       |
| `electron-src/lib/import/merge/importSubtotals.ts`                   | 小計・CropSubtotal の処理（明示マッピング → `__new__` → 名前ベース自動マッチの順で解決）                   |
| `electron-src/lib/import/merge/importScoring.ts`                     | 採点レイヤー（QuestionScore・ScoreDecision・CompoundAnswerScore・CropRegionAssignment）の処理              |
| `electron-src/lib/import/merge/importSyncRecords.ts`                 | DrawingAnnotation・StudentClassroomMembership の処理（追加とマージのみ。削除は推論しない）                 |
| `electron-src/lib/import/merge/types.ts`                             | IdMappings, IdChangeTarget, ImportCounts 等の型定義                                                        |

### インポート関連 - 競合処理

| ファイルパス                                               | 責務                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `electron-src/lib/import/merge/scoringConflictDetector.ts` | 採点競合の検出 (studentId + cropRegionId キーで既存と比較)             |
| `electron-src/lib/import/merge/scoringConflictResolver.ts` | 採点競合の解決 (4戦略: import_wins, existing_wins, newer_wins, manual) |
| `electron-src/lib/import/merge/conflictDetector.ts`        | 汎用競合検出（マッチング結果から競合項目と詳細情報を生成）             |
| `electron-src/lib/import/merge/decisionMergePolicy.ts`     | 確定レイヤー（ScoreDecision/CompoundAnswerScore）の解決を LWW に一本化 |

### UI / フロントエンド

| ファイルパス                                      | 責務                               |
| ------------------------------------------------- | ---------------------------------- |
| `hooks/import/useImportWizard.ts`                 | ウィザード全体の状態管理フック     |
| `hooks/import/constants.ts`                       | ウィザードのステップ定義、初期状態 |
| `components/import/steps/id-integration/index.ts` | Step 3 (ID統合) のUIコンポーネント |
| `components/import/steps/id-integration/types.ts` | Step 3 専用の型定義                |

### IPC通信

| ファイルパス                                   | 責務                                       |
| ---------------------------------------------- | ------------------------------------------ |
| `electron-src/ipc-handlers/archiveHandlers.ts` | エクスポート/インポートのIPC通信ハンドラー |

---

## 付録: アーカイブバージョンと対応するデータ

| データ                        | v1.0.0 | v1.1.0 | v1.2.0 | v1.3.0 | v1.4.0 |
| ----------------------------- | :----: | :----: | :----: | :----: | :----: |
| Exam 基本情報                 |   o    |   o    |   o    |   o    |   o    |
| ExamPage                      |   o    |   o    |   o    |   o    |   o    |
| CropRegion                    |   o    |   o    |   o    |   o    |   o    |
| PageImage (レガシー)          |   o    |   o    |   -    |   -    |   -    |
| MasterImage                   |   -    |   -    |   o    |   o    |   o    |
| StudentAnswerImage            |   -    |   -    |   o    |   o    |   o    |
| Student                       |   o    |   o    |   o    |  o\*   |  o\*   |
| Class                         |   o    |   o    |   o    |   o    |   o    |
| StudentClassMembership        |   o    |   o    |   o    |   o    |   o    |
| User (パスワード除外)         |   o    |   o    |   o    |   o    |   o    |
| UserExam                      |   o    | 空配列 | 空配列 | 空配列 | 空配列 |
| SubtotalGroup / Subtotal      |   o    |   o    |   o    |   o    |   o    |
| CropSubtotal                  |   o    |   o    |   o    |   o    |   o    |
| QuestionScore                 |   o    |   o    |   o    |   o    |   o    |
| DrawingAnnotation             |   o    |   o    |   o    |   o    |   o    |
| ExamClass                     |   -    |   o    |   o    |   o    |   o    |
| ExamSubtotalGroup             |   o    |   o    |   o    |   o    |   o    |
| ExamMarkingFormat             |   -    |   -    |   -    |   -    |   o    |
| ExamExportSettings            |   -    |   -    |   -    |   -    |   o    |
| CropRegionMarkingOverride\*\* |   -    |   -    |   -    |   -    |   o    |
| Subject                       |   -    |   -    |   -    |   -    |   o    |
| SubjectSubtotalGroup          |   -    |   -    |   -    |   -    |   o    |

`*` v1.3.0 で `studentId` フィールドが `studentNumber` にリネーム

`**` v0.16.x で廃止（issue #852）。旧アーカイブには実在するが、取り込み側は読み捨てる
