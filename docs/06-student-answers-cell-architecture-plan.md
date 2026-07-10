# 06-student-answers セル配置アーキテクチャ再設計 実装計画

> この文書は単独で読めるように書いてある（会話のコンテキストが失われても実装を継続できる）。
> 対象は `src/components/exams/06-student-answers/` と `src/app/exams/[examId]/06-student-answers/`。
> 作成: 2026-07-09。前提コミット: `5c8554b5`（同一性設計刷新・Set/位置キー撤廃・FK保存バグ修正が main にマージ済み）。

---

## 実装ステータス（2026-07-11 時点・コンパクト後の再開用サマリ）

> このセクションだけ読めば現在地が分かるように書く。詳細は各 Phase 節。

### 完了（すべて 06 配下で型/lint/format グリーン。※型チェックの2件のエラーは**別の並行セッションの import-export WIP 由来**で無関係・触らない）

- **Phase 1**: `ProcessedStudentAnswer` 中間層撤去（Prisma型 `StudentAnswerImageWithExamPageAndStudent` を素通し）。**0埋め廃止**（`UnifiedFile.buffer`/`size` を任意化・偽 `ArrayBuffer(0)` 撤去）。
- **Phase 2（大部分）**: 共通描画型 **`AnswerItem`** を `types.ts` に導入し描画層（`FilePreviewCell`/`TableDragOverlay`/`getFileColor`/`drawNameRegionCanvas`/`loadStudentAnswerImage`）を decouple。`SortableContext` を `TableContent` から `StudentAnswerTable` へ引き上げ。
- **Phase 0（バックエンド・テスト付き）**: 新規 `electron-src/lib/prisma/studentAnswer/placementApply.ts` の `applyStudentAnswerPlacements(moves)`。
  - moves: `{ fileId, finalStudentId, finalPageNumber, scorePolicy:"carry"|"discard" }[]`。
  - 2軸移動（examPageId 更新）／carry=**QuestionScore を id 指定 updateMany で付け替え（DrawingAnnotation 温存）**＋ScoreDecision は id 保持で delete→再作成／discard=tombstone→両スコア表削除／画像は id 保持で delete→再作成。
  - **基本 Prisma のみ**（一時ID退避・`defer_foreign_keys` 不使用）。IPC: `apply-answer-sheet-placements`。
  - テスト `__tests__/exam/integration/studentAnswerPlacementApply.test.ts`（**7件パス**）。
  - **コードレビュー(high)反映済み**: (F1/F2) carry で**移動先セルの残存採点（moving 集合外）を stale として掃除**（QuestionScore 二重計上・ScoreDecision unique 違反を修正）。(F3) `finalStudentId=null` は**拒否**（削除は deleteStudentAnswer 専用・ファイル/監査漏れ回避）。(F4) 移動先が batch 外答案で**占有時は明示エラー**（上書きしない）。残: F5=トランザクション内の逐次クエリ（性能・非破損、未対応）。
- **Phase 3a**: view 適用を新 API へ配線（`handleApplyChanges`）。`ConfirmChangesModal` をハイブリッド（追従/破棄グルーピング・破棄は行ごとチェック必須＋2段階確認）へ全面改修。`ScoringDataOption` 撤去、`PlacementScorePolicy` 導入。

### 残り（次の作業）

- **Phase 3b**: view の DnD を **method B（グリッドドロップ+swap）** へ。各マス `useDroppable`・各答案 `useDraggable`・空=移動/埋=swap。pendingChange 生成は現状 method A のまま（apply/modal は DnD 非依存で流用可）。
- **Phase 3c**: セルの掴む/落とす部分（`SortableTableCell`）を**スロット化**して表本体を DnD 非依存に。upload=method A を注入。ここで `UnifiedFile` を `PendingImage`/`AnswerItem` へ**3分割**（単一 `files` state が両モード兼用のため Phase 3 と不可分）。
- **Phase 6 相当**: 旧 `batch.ts`/`placement.ts`/`swap`（**FK強制下で壊れる temp studentId 方式**）の撤去、デッドコード整理（#965）、§6 手動検証（**DnD 挙動は要実機確認**）。

### 重要な発見・地雷（再開時に忘れない）

- **FK は実行時強制**。既存 `batchUpdateStudentAnswerPlacements`/`swap*`/`updateStudentAnswerPlacement` は偽 studentId の一時ID方式で**FK違反で壊れる**（旧挙動破綻の一因）。新 `applyStudentAnswerPlacements` は基本 Prisma で回避済み。3b/3c で旧関数を撤去。
- **sqlite-nas-sync 安全性を実コードで確認**: 二次 `@@unique` は `conflict.ts` ケース2 で LWW 収束（全表汎用）。delete→**同一id**再作成は `sync.ts` の tombstone-ignore（現存すれば再作成とみなす）で安全。→ 新コードは id 保持で delete+再作成している。
- **並行セッション**が `electron-src/lib/import/*`（transformers WIP）を編集中。型チェックの `transformWarnings`/`EXAM_CURRENT_VERSION` エラーは無関係。自分のファイルのみ扱う。
- 未コミット。git-workflow は未実行（自分のファイルのみ add する）。

### 主要な触点ファイル

- 型: `src/components/exams/06-student-answers/types.ts`（`AnswerItem`/`PlacementScorePolicy`/`UnifiedFile`）
- 表: `student-answer-table/components/{TableContent,StudentAnswerTable,SortableTableCell,ConfirmChangesModal}.tsx`
- DnD: `student-answer-table/hooks/{useDragDrop,useDragDropHandlers,useDragDropState}.ts` + `utils/dragDropUtils.ts`
- 配線: `src/app/exams/[examId]/06-student-answers/{hooks,components}/index.tsx`
- バックエンド: `electron-src/lib/prisma/studentAnswer/placementApply.ts`（+ `index.ts`/`studentAnswer.ts` の export、`ipc-handlers/miscHandlers.ts`、`preload-apis/answerSheetApi.ts`、`src/types/electron/studentAnswerApi.d.ts`）

---

## 0. 背景（なぜこの計画があるか）

発端は「生徒答案アップロードで `prisma.studentAnswerImage.create()` が **Foreign key constraint violated**」。
原因は配置テーブルが `cell.student.id`（＝`ExamStudent.id`）を `StudentAnswerImage.studentId`（FK→`Student.id`）に渡していたこと。
すでに修正済み（`examStudent.studentId` を渡す）。その調査から派生した設計の腐りを、本計画で構造的に解消する。

前提コミットで**完了済み**:

- `CellData` を `{ type, file?, disabledReason? }` に縮約。生徒/ページ/position は座標 `[studentIndex][pageIndex]` から投射。
- 無効化状態を同一性化（`rows=examStudentId[]` / `cols=pageNumber[]` / `cells={studentId,pageNumber}[]` / `files=Set<fileId>`）。合成文字列キー・×100 の乗数不一致を除去。
- 無効理由を生成側 `manualDisabledReason` で権威的に確定（描画は流すだけ）。
- 派生ルックアップを `Map<studentId, Set<pageNumber>>` に（※後述の通り本計画で見直す）。

**本計画で扱う残課題**:

1. `UnifiedFile` が「未保存ファイル」と「DB答案」を1型に融合し、view で偽 buffer（`ArrayBuffer(0)`/`size:0`）を詰めている（＝issue #963）。
2. DnD が upload/view とも「並べ替えリスト方式」で、view の疎な修正に合わず trash 巻き込み等の歪みを生む（＝issue #964）。
3. 無効状態の「由来」（導出/ユーザー操作/スイッチ）が混ざっていて、欠席の自動無効がユーザーの手動有効化を握り潰す潜在バグの温床。
4. 前提コミットで入れた `Set`/`Map` は**未計測の早すぎる最適化**の疑い（会話で合意）。素直な形に戻し、必要が測定で示されたときだけ局所導入する。

---

## 1. 確定した設計判断（この通りに実装する）

以下はすべて合意済み。実装中に迷ったらここに従う。

### 1-1. モードは2つ・非同居

- タブ「新規追加」= `mode="upload"`、タブ「配置済み答案の確認」= `mode="view"`（`src/app/exams/[examId]/06-student-answers/components/index.tsx`）。
- **upload**: 未保存ファイル（ドロップ→変換した画像）だけを配置・描画する。既存DB答案は「そのマスは埋まっている＝無効」の**占有信号としてのみ**使い、ファイルとしては描画しない。
- **view**: DB答案だけを描画する。
- 両者が同じファイル配列に**混ざることはない**。

### 1-2. 一時画像と DB 答案は別のデータ構造（結合しない・0埋め廃止）

- 未保存（`PendingImage`）と DB答案（`ExistingAnswer`）は**別型**。無理に揃えない。
- 共有するのは「表と DnD が読む最小のセル要素」だけ。各モードは自分のソースをその最小形へ**変換して流し込む**（変換関数を各モードに置く。特別な "アダプター層" という抽象は作らない）。
- **偽 buffer（0埋め）は全廃**。DnD・表・描画に画像のバイト列（`buffer`）は不要。必要なのは `id / studentId / pageNumber / preview`。

**命名について（`UnifiedFile` は廃止）**:

- `UnifiedFile` は false merge（偽の統合）の名前。非同居の「未保存」と「DB答案」を1型に併合したせいで 0埋めが要っただけで、「統一」という名は実態に嘘をついている（名前が「どう作ったか」を語り「何であるか」を語っていない＝命名の悪臭）。
- 解体先は `PendingImage` / `ExistingAnswer` / `AnswerItem`。
- 共通型も **"Unified" と呼ばない**。`AnswerItem` は「エンティティの併合」ではなく「そのマスに置かれた要素の最小共通ビュー（投射）」。実体で名付ける（`AnswerItem` / `PlacedAnswer` / `CellItem` 等、実装時に確定）。

### 1-3. 共通化の境界：「表の描画」は共通、「DnD の振る舞い」は別々

- **共通**: グリッドのレイアウト（行=生徒 × 列=ページ、ヘッダ、無効表示）＋セルの中身の描画（プレビュー / 空 / 無効理由）。DnD を知らない。
- **別々（モード別に注入）**: どのマスが掴める/落とせるか、ドラッグ完了で何が起きるか。共通の表コンポーネントに両方の DnD を埋め込まない（肥大化＝元の木阿弥）。表本体は DnD 非依存にし、DnD ラッパーを外から被せる（props / ラッパー / スロット）。

### 1-4. DnD はモード別 2 系統

| モード | 方式                                                                                  | 理由                                                      |
| ------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| upload | **並べ替えリスト**（`SortableContext` + フラット `AnswerItem[]` + `arrayMove`）       | 束の画像を一括で並べて割り当てる UX。フラットリストが必要 |
| view   | **グリッドドロップ + swap**（各マス=ドロップ受け皿、各答案=掴む対象、**リスト不要**） | 誤配置の疎な修正。1個をピンポイントで移す                 |

- view の衝突ポリシー（移動先マスの扱い）:
  - 空マスへドロップ → **移動**（元マスが空になる）。
  - 既に答案があるマスへドロップ → **swap（交換）**。**上書き・消去はしない**（両方とも本物の生徒答案なので損失禁止）。
  - swap は無損失・可逆なので**確認モーダル不要**。
- 移動先は**別ページ列を含む任意のマス**（生徒軸・ページ軸の両方を跨ぐ）。→ DB は `examPageId` と `studentId` の**両方**を更新する必要がある（後述 §3-3 と Phase 0）。
- これにより #964（trash 巻き込み）と position 計算の歪みは view から構造的に消える。

> **view は配置戦略を持たない（R4 確定）**: view はマス目に真の DB 座標で描画するため、page-first/student-first の並べ替え対象そのものが無い。**配置戦略セレクタは upload 専用**。§1-5 のリセット＋確認は upload のみに適用する。

### 1-5. 配置戦略（page-first / student-first）の切り替え

- 切り替え時、リストは**完全再構築**する。
- **両モードとも、手動配置の有無に関わらずリセットし、確認モーダルを出す**（「並べ替えをやり直すと手動の配置は破棄されます。よろしいですか？」）。
- view の手動ドラッグは未コミットの DB 修正（pendingChange）なので、破棄は特に明示的に確認する。

### 1-6. 無効の「由来」は 3 種類（分けて持つ）

1. **導出（保存しない・データから毎回わかる）**
   - 欠席: `ExamStudent.status === "absent"`。
   - 既存答案占有: DB に答案がある `(studentId, pageNumber)` かつ `!allowOverwrite`（**upload モードのみ**）。
2. **ユーザー操作の状態（保存する）**
   - 行（生徒）無効・列（ページ）無効・個別セル無効。
3. **スイッチ**
   - `allowOverwrite`（「既存答案占有」による無効を解除する）。

規則:

- **欠席は導出**。`disabledState` に保存しない。行の既定値として与える。
- **ユーザーの行明示（有効化/無効化）が欠席の既定に勝つ**。→ 欠席者を手動で有効化したら、`students` 再取得でも消えない（現状の `didInitAbsentRef` 応急処置を、由来分離で根本解消する）。
- 無効理由（`row`/`column`/`position`/`absent_student`/`existing_answer`）は**生成側で権威的に確定**し、描画側は再計算せず流すだけ。

### 1-7. Set/Map は「早すぎる最適化」を避ける

- 前提コミットで入れた `disabledState.files: Set` と `CellLookup=Map<studentId,Set<pageNumber>>` は**未計測**。
- 方針: **状態の芯はシンプル（配列、またはプロパティ）に戻す。** 速度対策が要るとしても、それは描画/DnD の直前で**局所的に**作るもので、真実の源に埋め込まない。
- **ファイルの無効はプロパティ化**（`pending.disabled`）を第一候補にする。別リスト（`disabledState.files`）参照の O(n) 突き合わせ自体が消え、Set の是非が問題にならなくなる。
- どうしても局所 Set/Map を使う場合も、**エンコード合成文字列キー（`` `${a}:${b}` ``）は使わない**（過去の ×100 バグの温床）。`Map<studentId, Set<pageNumber>>` のような型付き入れ子にする。

---

## 2. 現状の構造（調査結果）

### 2-1. ファイル構成（全 5,350 行）

```
student-answer-management/
  components/  FileUploadZone / GridHeader / StudentAnswerUpload
  hooks/       useStudentAnswerUpload           # ドロップ→変換→アップロード
  utils/       convertStudentAnswersToFiles      # DB答案→UnifiedFile（★0埋め）
               reorderFilesByStrategy            # 戦略切替の再配置 / DB→順序付き配列
  types/       index.ts (ProcessedStudentAnswer) # ★Prisma手写しの中間層
student-answer-table/
  components/  TableContent / StudentAnswerTable / EmptyTableCell / SortableTableCell
               FilePreviewCell / TableHeader / TableDragOverlay / PlacementStrategySelector
               OverwriteToggle / MarkerCorrectionToggle / PreviewModeToggle
               UploadModalWrapper / UploadToCellModal / DeleteConfirmationModal
               ConfirmChangesModal
  hooks/       useStudentAnswerTableLogic        # 統合ロジック
               useTableData / useTableDataGeneration   # 配置（流し込み）
               useDisabledState                  # 無効状態
               useDragDrop / useDragDropState / useDragDropHandlers  # DnD（現状リスト方式・両モード共通）
               useMarkerCorrection / useNameRegion
  types/       index.ts (CellData, ExtendedDisabledState, DisabledCell, *Props)
               localTypes.ts (StudentAnswerTableProps, UploadModalState, DisabledReason)
               dragDropTypes.ts (FileState)
  utils/       tableDataUtils / dragDropUtils
types.ts       UnifiedFile / UploadData / PendingChange / PlacementStrategy / ScoringDataOption
app/.../06-student-answers/
  hooks/index.tsx       # データ取得（students / studentAnswers / modelAnswerCount）＋pendingChanges適用
  components/index.tsx  # 2タブ（upload / view）でStudentAnswerUploadを描画
  page.tsx
```

### 2-2. 現状の型（要点）

```ts
// types.ts — 融合型（★問題の中心）
interface UnifiedFile {
  id: string; name; type; size: number
  buffer: ArrayBuffer          // ★未保存は本物、DB由来は new ArrayBuffer(0)（偽）
  preview?: string
  studentId?: string           // 配置済みの生徒
  pageNumber: number           // マス列（序数）
  isSelected: boolean; originalFileName; pageLabel?
  color?; imagePath?: string | null   // DB由来の遅延読込パス
  correctionStatus?; correctedForPage?; correctionError?
}

// table/types/index.ts
interface CellData { type: "file"|"empty"|"disabled"; file?: UnifiedFile; disabledReason? }
interface DisabledCell { studentId: string; pageNumber: number }
interface ExtendedDisabledState {
  rows: string[]; cols: number[]; cells: DisabledCell[]; files: Set<string>   // ★filesのSetは要見直し
}

// table/types/dragDropTypes.ts
interface FileState { fileId: string; studentId: string | null; pageNumber: number }

// management/types/index.ts — ★Prisma手写しの中間層
interface ProcessedStudentAnswer {
  id; studentId: string|null; pageNumber: number   // ★examPageIdをドロップ
  originalImagePath: string|null; isAbsent: boolean
  student: {...}|null; examId: string; status: "ready"
}
```

### 2-3. 現状のデータフロー

- **upload**: `useStudentAnswerUpload.convertFiles`（raw File→`UnifiedFile`、本物 buffer、`pageNumber`=PDF内ページ、`studentId` なし）→ `files`。
  `handleUpload(uploadData)` が `window.electronAPI.uploadStudentAnswers(examId, uploadData)` へ post。
  `uploadData` の `studentId`/`pageNumber` は**セル座標**から（`sortedStudents[studentIndex].studentId` / `pageIndex+1`）。既存答案は `existingStudentAnswers`（占有信号）として別経路。
- **view**: `buildOrderedFileArrayFromStudentAnswers`（`ProcessedStudentAnswer[]`→`convertAnswerSheetsToFiles`＝**0埋め**→順序付き `UnifiedFile[]`）→ `files`。
  DnD で並べ替え → `pendingChange` → `ConfirmChangesModal` → `onApplyChanges`（DB 適用）。
- **DnD（両モード共通・現状）**: `SortableContext` + `useSortable({id})` + `handleDragEnd` の `arrayMove`。`FileState{fileId,studentId,pageNumber}` で位置をアンカー。view は `compareFileStates` で pendingChange を生成。

### 2-4. DB 層（変更しない前提の境界）

- `getStudentAnswersByExamId(examId)`: **Prisma 型そのまま返す**（`StudentAnswerImage` + `student` + `examPage`）。`@@unique([examPageId, studentId])`。
- `uploadStudentAnswers(examId, filesData[{ studentId, pageNumber, imagePath..., overwrite, correctionStatus }])`: `pageNumber` で `ExamPage` を find/create し `StudentAnswerImage` を作成。`studentId` は **Student.id**。
- `deleteStudentAnswer(answerSheetId)`。
- 06 hook が Prisma→`ProcessedStudentAnswer` 変換（`examPageId` を落として `pageNumber` のみ）と `modelAnswerCount = Math.max(pageNumber)` を作っている（`ExamPage.id` を捨てている）。

---

## 3. 目標アーキテクチャ

```
【ソース：別々】  PendingImage[]                 ExistingAnswer[]（Prisma土台）
                      │ toItem（upload側）           │ toItem（view側）
                      ▼                              ▼
【共通の要素形】               AnswerItem { id, studentId, pageNumber, preview }
                      │                              │
【DnD：別々】     並べ替えリスト(方式A)          グリッドドロップ+swap(方式B)
                   SortableContext+arrayMove       droppableマス+draggable答案（listなし）
                      │                              │
                      └──────────────┬───────────────┘
【表：共通】            グリッド描画（行=生徒 × 列=ページ、セル= item / empty / disabled+reason）
                       ※ DnD の振る舞いは外から注入（表本体はDnD非依存）
【無効状態：共通の解決器】
   由来: 導出(欠席/既存答案占有) + ユーザートグル(行/列/セル) + スイッチ(overwrite)
   → 生成側で「このマスは無効か+理由」を権威的に確定 → 描画は流すだけ
```

### 3-1. 目標の型（草案）

```ts
// 共通: 表とDnDが読む「セルに載る要素」の描画ビュー。
// R2: FilePreviewCell が消費する項目まで含める（4フィールドでは不足）。
//   FilePreviewCell は preview / imagePath(遅延) / name / correctionStatus /
//   correctionError / getFileColor(item) / drawNameRegionCanvas(item) を読む。
interface AnswerItem {
  id: string // dnd-kit の識別子（fileId / answerSheetId）
  studentId: string // どの生徒のマスか（= Student.id）
  pageNumber: number // どのページのマスか（当面は序数。将来 examPageId へ #961）
  name: string // 表示・alt 用
  preview: string | null // 未保存は blob URL、DB答案は null（imagePath から遅延読込）
  imagePath?: string | null // DB答案の遅延読込パス（未保存は無い）
  // R5: 補正バッジは upload→view を correctionStatusMap 経由で運ぶ。
  //     ExistingAnswer(Prisma) は補正フィールドを持たないので item に載せる。
  correctionStatus?: "corrected" | "skipped" | "not_requested"
  correctionError?: string
}

// 未保存（DBに縛られない自由な形）
interface PendingImage {
  id: string
  buffer: ArrayBuffer // 本物
  preview: string
  originalFileName: string
  sourcePageNumber: number // 元PDF内のページ（配置前の素性）
  studentId?: string // 配置で決まる
  pageNumber?: number // 配置で決まる（マス列）
  disabled?: boolean // ゴミ箱＝プロパティ（別Setを廃止）
  correctionStatus?: "corrected" | "skipped" | "not_requested"
  correctedForPage?: number
  correctionError?: string
}

// DB答案（Prisma型を土台。手写し中間層 ProcessedStudentAnswer を廃止）
type ExistingAnswer = Prisma.StudentAnswerImageGetPayload<{
  include: { student: true; examPage: true }
}>
// studentId, examPageId, examPage.pageNumber, imagePath, student.* を持つ
```

### 3-2. 無効状態（由来別）

```ts
// 保存するのはユーザー操作＋スイッチだけ
interface DisabledUserState {
  rows: string[] // examStudentId（ユーザーが明示的に無効化した行）
  rowsEnabled: string[] // examStudentId（欠席の既定を上書きして有効化した行）
  cols: number[] // pageNumber
  cells: { studentId; pageNumber }[]
  allowOverwrite: boolean // スイッチ
}
// 導出（保存しない）: 欠席(status) / 既存答案占有(DB, uploadのみ)

// 権威的な解決（生成側・描画は流すだけ）
function resolveDisabled(examStudent, pageNumber, ctx): DisabledReason
// 優先順位の考え方:
//   行override(rows/rowsEnabled) > 欠席既定 > 列 > セル > 既存答案占有(!overwrite)
//   （厳密な優先順位は実装時に確定。ユーザー明示が欠席既定に勝つことは必須）
```

> 注: `rows`/`rowsEnabled` の二本立ては一案。`Map<examStudentId, boolean>`（明示オーバーライド）でも良い。要は「欠席=導出の既定、ユーザー明示=勝つ上書き」を表現できれば形は問わない。実装時に決める。

### 3-3. DB 配置APIの制約（調査で確定・Phase 3 の前提）

view の方式B（任意マスへ移動＋swap）は、既存のDB配置APIでは**成立しない**。両関数とも `studentId` しか更新せず、`examPageId`（ページ軸）を一切動かさない：

| 関数（`electron-src/lib/prisma/studentAnswer/batch.ts`） | 更新する                        | 更新しない                                           |
| -------------------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `batchUpdateStudentAnswerPlacements`（:100-124）         | `studentId` のみ（2段階一時ID） | `examPageId`（`finalPageNumber` は受け取るが未使用） |
| `swapStudentAnswerPlacementsWithScoring`（:230-250）     | `studentId` のみ（3段階一時ID） | `examPageId`                                         |

`StudentAnswerImage` は `@@unique([examPageId, studentId])`、`studentId`→`Student.id`（`schema.prisma:151-164`）。答案は `(studentId, examPage.pageNumber)` に居るので、別ページ列へのドロップ＝`examPageId` の付け替えが必須だが、現状は沈黙で無視される（＝現 view の cross-page ドラッグは先在の no-op バグ）。

**帰結**: 計画 §5「DB契約を変えない」は view については撤回し、**Phase 0 でDB配置APIを2軸（examPageId + studentId）対応へ拡張**し、さらに**採点安全な適用ロジックへ作り直す**。

- 移動: `finalPageNumber` を `examId` で `ExamPage` に解決し `examPageId` を更新。studentId と併せて更新。
- swap: 2答案が `(examPageId, studentId)` ペアを交換。`@@unique` を跨ぐため一時退避を2軸に拡張。

### 3-4. 採点安全モデル（配置移動とスコアの整合・確定仕様）

**現状の危険（調査で確定）**:

- スコアはページに縛られる: `QuestionScore` は `(cropRegionId, studentId)`、`CropRegion` は `examPageId` に属す（`schema.prisma:166-179, 253-266`）。→ **別ページへスコアは追従できない**。
- **返却成績 `ScoreDecision`（OWNER確定値, `schema.prisma:271-`）を配置移動系は一切触っていない。** `batchUpdate`/`swap` は `QuestionScore` のみ。→ 画像の生徒だけ付け替わり確定成績が元生徒に残る＝**他人の成績を返却する穴**。
- 現行 with-scoring は `QuestionScore` を**同一 studentId のまま**削除→再作成する churn（`batch.ts:129-135`）で、実際には移していない。専用 `swapStudentAnswerPlacements*` は IPC 配線済みだが 06 UI からは未使用。

**安全 invariant（北極星）**:

> あるスコア（`QuestionScore` も `ScoreDecision` も）が `(生徒X, ページPの枠R)` に付くなら、スロット `(X, P)` の画像は「Xが実際に解いてそのスコアが付いた答案」でなければならない。

これを壊す移動は必ず **追従**（同一ページのみ可・スコアの studentId 付け替え）／**破棄**（削除→要再採点）のいずれかで解消する。**古いスコアを黙って残す経路は廃止**（invariant違反の唯一の危険パス）。

**移動分類と選択肢（確定）** — 移動を `(生徒_from, ページ_from) → (生徒_to, ページ_to)`：

| 種別                    | 条件                 | スコア追従             | 選択肢（据え置きは廃止）             | 既定     | 確認                |
| ----------------------- | -------------------- | ---------------------- | ------------------------------------ | -------- | ------------------- |
| ①生徒付け替え           | ページ同一・生徒違い | 可（同ページ枠を付替） | **入れ替え**（採点も追従）/ **破棄** | 入れ替え | 破棄選択時のみ2段階 |
| ②ページ違い（同一生徒） | 生徒同一・ページ違い | 不可                   | **破棄して移動**                     | 破棄     | **2段階**           |
| ③対角（両方違い）       | 生徒もページも違い   | 不可                   | **破棄して入れ替え**                 | 破棄     | **2段階**           |

規則:

- **選択肢は「入れ替え（追従）」か「破棄」の二択のみ。** 据え置き（画像のみ移動・採点そのまま）は完全廃止。
- **追従（入れ替え）は①のみ提示可**。しかも**そのページの枠のスコアだけ**を付け替える（全スコアchurn廃止）。
- **②③はページが変わるので追従不可 → 破棄一択**。破棄時は **モーダルで2回確認**。①でも**破棄を選んだら2回確認**。
- **全ケースで `QuestionScore` と `ScoreDecision` を同時に処理**（追従 or 破棄）。破棄は tombstone/監査を残す。`DrawingAnnotation` は既存 tombstone 機構。

---

## 4. 実装ステップ（順序・各段階で型チェック）

各フェーズ末で `npm run typecheck` / eslint / prettier をグリーンに保つ。DnD は挙動確認が必要（§6）。

### Phase 0 — DB 配置APIの2軸拡張＋採点安全な適用への作り直し（view 方式B の前提・§3-3/§3-4）

**進捗（2026-07-10）— ✅ バックエンド実装＋テスト完了**:

- 新規 `electron-src/lib/prisma/studentAnswer/placementApply.ts` に `applyStudentAnswerPlacements(moves)` を実装（既存 `batch.ts` は Phase 3 で置換するまで温存）。
  - moves: `{ fileId, finalStudentId, finalPageNumber, scorePolicy: "carry"|"discard" }[]`。
  - **2軸移動**: `finalPageNumber`→`ExamPage` 解決で `examPageId` も更新（旧 batchUpdate が無視していた核心バグを解消）。
  - **carry**（ページscoped）:
    - `QuestionScore` は unique が無いので **id 指定の `updateMany` で studentId 付け替え**（id 保持 → `DrawingAnnotation` 温存。swap も id 指定で途中衝突なし）。
    - `ScoreDecision`（unique あり・子なし）は **delete → 最終位置へ再作成**。
  - **discard**: `DrawingAnnotation` を tombstone → `QuestionScore`＋`ScoreDecision` 削除。
  - **画像**: unique の 2-cycle 回避に **delete → 同一 id で再作成**（id・imagePath・createdAt 保持、ファイル実体は不触）。
  - **ガード**: carry×ページ変化はエラー。
  - **基本 Prisma のみ（findMany/updateMany/deleteMany/createMany）。一時ID退避も `defer_foreign_keys` も使わない。** ⚠️ 既存 `batch.ts`/`swap`/`placement.ts` は偽 studentId の一時ID方式で、FK 強制下では壊れる（旧 batchUpdate 破綻の一因）。Phase 3 置換時に撤去。
  - **削除・再作成は id を保持**（画像・ScoreDecision とも）。sqlite-nas-sync 的に安全: 二次 UNIQUE は `conflict.ts` ケース2 で LWW 収束（全表汎用・`StudentAnswerImage` の unique も対象）、delete→同一id再作成は `sync.ts` の「現存すれば tombstone 無視（再作成とみなし存続）」で余計な削除伝播を回避。
- IPC 配線: `apply-answer-sheet-placements`（`preload-apis/answerSheetApi.ts` / `ipc-handlers/miscHandlers.ts` / `src/types/electron/studentAnswerApi.d.ts`）。
- テスト `__tests__/exam/integration/studentAnswerPlacementApply.test.ts`（4件パス）: ①carry追従＋注釈温存 / ①discard削除 / ②ページ跨ぎで examPageId 更新＋破棄 / carryガード。
- 型/lint/format グリーン（自分の範囲）。

> データ書き込み経路の変更（採点データ破棄を含む）。実行前に必ず許可を取る（DBファイル・破壊的操作の事前許可ルール）。

1. **2軸移動**: `batchUpdateStudentAnswerPlacements`（`batch.ts`）を `examPageId` も更新するよう拡張。`finalPageNumber` を `examId` で `ExamPage.findFirst` 解決（模範解答ページは既存前提・無ければエラー）。`@@unique([examPageId, studentId])` 回避の一時ID方式を `(examPageId, studentId)` の2軸へ拡張。swap も 2 答案の `(examPageId, studentId)` ペア交換に拡張。
2. **スコア処理を分類駆動に**（§3-4 の①②③）。適用時に各移動を分類し:
   - ①入れ替え（追従）: **そのページの枠**の `QuestionScore` と `ScoreDecision` を studentId 付け替え（全スコアchurn廃止）。
   - ②③破棄: 影響スロットの `QuestionScore` と `ScoreDecision` を削除（tombstone/監査記録）。要再採点。
3. **両スコア表を必ず処理**: 現状無視されている `ScoreDecision`（返却成績）を追従/破棄の対象に含める。`DrawingAnnotation` は既存 tombstone 機構を流用。
4. **ガード**: ②③（ページ変化）では「追従（入れ替え）」を受け付けない（破棄のみ）。据え置き（採点そのまま）経路はAPIレベルで廃止。
5. 適用の引数を「分類＋スコア処理方針（carry/discard）」を運べる形へ拡張（`{fileId, finalStudentId, finalPageNumber, scorePolicy}` 等）。IPC 契約（`preload-apis/answerSheetApi.ts` / `ipc-handlers/miscHandlers.ts`）を合わせて更新。
6. **確認UX**（`ConfirmChangesModal` 改修・ハイブリッド方式に確定）:
   - 「変更を反映」押下 → 一覧モーダル。変更1件ごとに「誰の採点がどうなるか（追従/破棄）」を明示。
   - **破棄を伴う項目（②③、および①で破棄を選んだもの）は行ごとにチェック必須**。全チェックが揃うまで「反映」ボタンは無効。追従のみの①はチェック不要で流す。
   - 全チェック後「反映」→ **最終確認1回（2段階目）**「破棄を伴います。よろしいですか？」→ 実行。
   - 既定は安全側（①=入れ替え、②③=破棄）。据え置き（採点そのまま）は選択肢に無い。
   - **UX品質要件（多数変更でも分かりやすく）**:
     - 変更を**追従／破棄でグルーピング**し、破棄グループを目立たせる（色・アイコン）。件数バッジ（例「破棄 2件」）を先頭に。
     - リストは**スクロール領域を固定高**にし（ヘッダ／件数サマリ／フッタ「反映」ボタンはスクロール外に常時可視＝sticky）、長大でもボタンを見失わない。
     - 未チェックの破棄項目が残るとき、反映ボタン近傍に**残数（例「未了解 1件」）**を出し、クリックで最初の未チェック行へスクロール。
     - 各行は移動を「A・P1 → B・P1」の**視覚的な向き**で示し、swap は双方向矢印＋「入れ替え」バッジ。破棄行は赤系、追従行は青系で即判別。
     - 生徒名は氏名で表示（IDを見せない）。長名は省略せずtooltip等で確認可能に。

### Phase 1 — 型の分離（0埋め廃止の土台）

**進捗（2026-07-10）**:

- ✅ **1a 完了**: `ProcessedStudentAnswer` 手写し中間層を撤去。DB答案は Prisma 型 `StudentAnswerImageWithExamPageAndStudent`（=`ExistingAnswer`、`prismaExtensions.ts:201`）を素通し。06 hook の Prisma→Processed 変換を削除、`usePendingChanges` は `examPage.pageNumber` を直接読む。テーブル境界（`StudentAnswerUpload`）でだけ占有信号 `{id, studentId, pageNumber}` へ射影。型チェック/lint グリーン。
- ✅ **1b 0埋め廃止 完了**: `UnifiedFile.buffer`/`size` を任意化し、`convertAnswerSheetsToFiles` の偽 `new ArrayBuffer(0)`/`size:0` を撤廃。消費側を guard（`handleUpload` は buffer 有りのみ、`useMarkerCorrection` は Task にバッファ保持、TableHeader の size 表示を条件化）。型チェック/lint グリーン。
- ⏳ **残り（Phase 2/3 と同時に land）**: `UnifiedFile` 名の解体（→ `PendingImage`/`AnswerItem`）と 3 型への完全分割。**理由**: 現状 `useStudentAnswerUpload` の単一 `files` state が upload/view 両モードを兼ね、DnD・マーカー補正・handleUpload が同一リストの buffer に依存する。ここで無理に型を割ると使い捨ての buffer 保全ハック（merge-by-id）が要る。DnD をモード別に割る Phase 2/3 でリスト自体が分かれるので、そこで `PendingImage[]`（upload源）/`AnswerItem[]`（共通描画）へ自然に分割する。

1. ~~`PendingImage` / `AnswerItem` を新設~~ → Phase 2/3 で実施（上記理由）。`ExistingAnswer`＝既存 `StudentAnswerImageWithExamPageAndStudent` を採用済み。
2. `convertFiles`（`useStudentAnswerUpload`）を `PendingImage[]` 生成に変更 → Phase 3。
3. ✅ view 側の 0埋め・中間層は撤去済み（`convertAnswerSheetsToFiles` は buffer/size を作らない）。`ExistingAnswer[]` を直接持ち回り済み。
4. ✅ `UploadData` は現行維持。upload 保存経路は据え置き。

### Phase 2 — 共通表コンポーネントの切り出し（DnD 非依存）

> R3: 現状 `DndContext` は `StudentAnswerTable.tsx:78`、`SortableContext` は `TableContent.tsx:87`、セルは `SortableTableCell`（内部 `useSortable`）と、DnD が共通描画に**埋め込まれている**。共通化の境界を `DndContext` より下に引き直すのが本フェーズの主眼。

**進捗（2026-07-10）**:

- ✅ `SortableContext` を `TableContent` から除去し `StudentAnswerTable`（`DndContext` の下）へ引き上げ。表本体は `@dnd-kit/sortable` を import しなくなった。
- ✅ **共通描画型 `AnswerItem` を導入**（`types.ts`）。「未保存/DB答案の両ソースを射影した表示専用の投射」で、`UnifiedFile` はその上位型。描画層（`FilePreviewCell`/`TableDragOverlay`/`getFileColor`/`drawNameRegionCanvas`/`loadStudentAnswerImage`）を `AnswerItem` へ寄せ、表示を `UnifiedFile` から decouple。upload の buffer 等はパイプライン側 `UnifiedFile` に残置（Phase 3 の DnD 分割時に `PendingImage` へ）。型/lint グリーン（06配下）。
- ⏳ 残り: セルの掴む/落とす部分（`SortableTableCell`）のスロット化。view の droppable セルを作る Phase 3 と同時に実施（片方だけ作っても意味が薄いため）。

> 注: 型チェックの2件のエラー（`transformWarnings`/`EXAM_CURRENT_VERSION`）は**並行セッションの import-export WIP 由来**で本作業とは無関係（06配下はエラーゼロ）。

1. `TableContent` から「グリッド描画（行×列・ヘッダ・セル= item/empty/disabled+reason）」だけを取り出した**共通表**にする。入力は `AnswerItem` の配置結果＋解決済み無効状態。**`SortableContext` を TableContent から除去**する。
2. セルの DnD ラッパー（掴める/落とせる）は**スロット/ラッパー props**（例: `renderCell` / `CellWrapper`）で外から差し込む。表本体は `SortableContext` も `useSortable` も `useDroppable` も知らない。upload は sortable セル、view は droppable セルを注入する。
3. `FilePreviewCell` / `EmptyTableCell` はプレビュー描画の共通部品として維持（アクションは props で注入）。`FilePreviewCell` の入力を `UnifiedFile` から `AnswerItem`（§3-1）へ差し替え。

### Phase 3 — DnD 2 系統

**進捗（2026-07-10）— 3a 完了（apply/modal 配線）**:

- ✅ view 適用を新 `applyStudentAnswerPlacements` API へ接続（`app/.../hooks/index.tsx` `handleApplyChanges`）。pendingChange ごとに ページ変化を判定し `scorePolicy`（carry/discard）を確定して move を構築。旧 `batchUpdateStudentAnswerPlacements`＋`ScoringDataOption` は撤去。
- ✅ `ConfirmChangesModal` をハイブリッド方式へ全面改修: 追従/破棄グルーピング（色）・件数サマリ・同一ページは carry/discard トグル・破棄項目は行ごと Checkbox 必須（未了解数表示）・破棄ありは2段階目「破棄して反映」。追従のみは直接反映。固定高スクロール＋フッタ常時可視。
- ✅ `PlacementScorePolicy` 型を 06 に導入。型/lint/format グリーン（06配下）。
- ⏳ 残り（3b/3c）: DnD を method B（view=グリッドドロップ+swap）へ、セルスロット化、upload=method A。**現状 DnD は method A のまま**で、pendingChange は method A が生成（apply/modal は DnD 非依存なので流用可）。**要手動確認**（DnD 挙動）。

1. **upload = 並べ替えリスト（方式A）**: 現行 `useDragDrop*` を `AnswerItem[]` の上に載せ替え。`SortableContext` + `arrayMove` を維持。配置戦略の自動整列＋手動並べ替え。
2. **view = グリッドドロップ + swap（方式B）を新規実装**:
   - 各マス（生徒×ページ）を `useDroppable`、各答案を `useDraggable`。
   - drop ハンドラ: 空マス→移動 / 既存あり→**swap**。上書き禁止。
   - これを `pendingChange`（fromState/toState）に変換 → `ConfirmChangesModal` → `onApplyChanges`（DB適用）。
   - `SortableContext`/フラットリスト/`arrayMove` は view では使わない。
3. `TableDragOverlay` はドラッグ中プレビュー用に両系統から流用（preview だけ見る）。

### Phase 4 — 無効状態を由来別に再構成

1. `useDisabledState` を「ユーザー操作＋スイッチのみ保存」に。欠席は保存せず導出。行はユーザー明示が欠席既定に勝つ形へ（`didInitAbsentRef` の応急処置を撤去）。
2. `manualDisabledReason` を「導出（欠席/既存答案占有）＋ユーザートグル（行/列/セル）」を優先順位付きで解決する権威関数に拡張。描画は結果を流すだけ。
3. 前提コミットの `disabledState.files: Set` と `CellLookup=Map` を**見直す**:
   - ファイル無効は `PendingImage.disabled` プロパティへ（別リスト参照＝O(n)突き合わせを消す）。
   - 既存答案占有/動的無効は、素直に導出（必要が測定で示された時だけ局所 `Map<studentId,Set<pageNumber>>`）。**エンコード文字列キー禁止**。

### Phase 5 — 配置戦略切り替え（両モード・リセット＋確認）

1. `PlacementStrategySelector` の変更ハンドラで、**確認モーダル**を挟む（手動配置の有無に関わらず）。
2. 確定で完全リセット（自動整列し直す）。view は未コミット pendingChange 破棄を明示。

### Phase 6 — 配線・掃除・検証

1. `useStudentAnswerTableLogic` / `StudentAnswerUpload` / 06 hook の配線を新型・新DnDに合わせる。
2. デッド/未完コード整理（#965: `observerRef` 遅延読込は未実装＝削除 or 実装、`handleUploadToCell` TODO スタブ）。
3. §6 の検証を全部通す。

---

## 5. 壊してはいけないもの（回帰厳禁）

- **DB 保存**: `uploadStudentAnswers` の `studentId` は **Student.id**（`examStudent.studentId`）。`ExamStudent.id` を渡さない（元バグ）。
- **アップロードの (studentId, pageNumber) はセル座標由来**（ファイルの素性ではなくマスが決める）。
- **view の修正フロー**: DnD → pendingChange → `ConfirmChangesModal` → DB 適用（`onApplyChanges`）。答案の削除経路（`deleteStudentAnswer`）。
  - ※ 適用先の `batchUpdate*` は Phase 0 で2軸対応へ拡張する（従来の studentId 単軸挙動は同一ページ内移動として維持）。upload の保存契約（`uploadStudentAnswers`）は不変。
- **マーカー補正**: upload 専用。`imagePath` を持つ既存ファイルはスキップ。`markerAvailablePages` に基づく補正/復元。
- **プレビューの遅延読込**（DB答案）と **blob URL の解放**（未保存、`useStudentAnswerUpload` の revoke）。
- **欠席の既定無効**は維持しつつ、**手動有効化が再取得で消えない**こと（由来分離で保証）。

---

## 6. 検証（実機・DB書き込みを伴うので都度許可）

1. **upload**: PDF/画像ドロップ→変換→グリッド自動整列→手動並べ替え→アップロード→`StudentAnswerImage` が正しい `(studentId, examPage)` で作成される（FK違反ゼロ）。
2. **占有無効**: 既にアップロード済みのマスが upload タブで無効表示。`allowOverwrite` ON で解除。
3. **view グリッドドロップ**: 誤配置答案を別マスへドロップ→空=移動/埋=swap→pendingChange→確認→DB反映。上書き消去が起きないこと。
4. **戦略切替**: 手動配置あり時に確認モーダル→リセット。両モード。
5. **欠席**: 欠席者の行が既定無効→手動有効化→再取得で維持される。
6. **マーカー補正・遅延プレビュー・blob解放**が従来通り。
7. `npm run typecheck` / `npm run lint` グリーン。

---

## 7. 本計画のスコープ外（別 issue）

- **#961**: 列軸を `pageNumber`（序数）→ `ExamPage.id`（真の同一性）へ。供給層＋`FileState`＋`UploadData`＋DnD を横断。本計画は `pageNumber` のまま進め、`AnswerItem.pageNumber` を将来 `examPageId` に差し替えられる形にしておく。
- **#962**: `StudentAnswerImage` を `Student×ExamPage` から `ExamStudent×ExamPage` の多対多へ（採点層全体が Student キーのため単独判断・要設計）。
- **#963**: UnifiedFile 判別union化 → **本計画の中核で解消**（型分離・0埋め廃止）。
- **#964**: DnD trash 巻き込み → **本計画の view 方式B化で構造的に解消**。
- **#965**: デッド/未完コード整理 → Phase 6 で随時。

---

## 8. 用語

- **AnswerItem**: 表と DnD が読む、セルに載る最小の要素（id/studentId/pageNumber/preview）。
- **PendingImage**: アップロード前の未保存画像（本物 buffer を持つ・DB に無い）。
- **ExistingAnswer**: DB の `StudentAnswerImage`（Prisma 型そのもの）。
- **占有無効 (existing_answer)**: upload で、そのマスに既にDB答案がある → `!allowOverwrite` なら無効。
- **swap**: view のドロップで、移動先が埋まっている時に 2 マスを交換（上書きしない）。
