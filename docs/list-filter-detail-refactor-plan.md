# 一覧フィルタ＋詳細画面リファクタ 実装計画

当初の依頼「試験一覧と同様のフィルタ機能を、解答用紙作成・試験外成績資料・成績算出にも実装する」から派生した一連の改修計画。フィルタ機能一式は実装済み。本書は**残りの大物（破壊的なルーティング再編を含む）**の実装計画を、次セッションでそのまま着手できる粒度で記録する。

作成日: 2026-07-13

---

## 0. 完了済み（実装・型チェック通過・整形済み）

### フィルタ機能（3画面共通）

| 画面           | 検索 | タグ | 学級 | 日付範囲 | 一括タグ付与 |
| -------------- | ---- | ---- | ---- | -------- | ------------ |
| 解答用紙作成   | ✅   | ✅   | —    | 更新日   | ✅           |
| 試験外成績資料 | ✅   | ✅   | ✅   | 実施日   | ✅           |
| 成績算出       | ✅   | —    | ✅   | 基準日   | —            |

### 新設した共通部品

- `src/hooks/useListFilter.ts` — 汎用フィルタ適用hook。`ListFilterAccessors<T>`（`searchTexts`/`tagIds?`/`classroomIds?`/`date?`）を注入。返り値に `filteredItems` と各state/トグル。**accessors はモジュールレベル定数で渡し参照を安定させる**（依存配列に入るため）。
- `src/components/common/ListFilterBar.tsx` — presentational。検索Input・タグ/学級のPopoverチェックボックス（`MultiSelectFilter`）・日付範囲Popover（`DateRangeFilter`）・件数表示。`tagFilter`/`classroomFilter`/`dateRangeFilter` は optional、`leading` に画面固有要素を差し込む。exported型: `FilterOption`, `MultiSelectFilterConfig`, `DateRangeFilterConfig`。
- `src/components/common/BulkTagAssignButton.tsx` — 選択中アイテムへタグ一括付与するPopover。props: `selectedCount`/`allTags`/`onAssign`。

### 解答用紙のタグ機能（新規スキーマ）

- `prisma/schema.prisma`: `AsbDefinitionTag` 中間テーブル追加、`Tag.asbDefinitionTags` / `AsbDefinition.tags` 逆リレーション。
- `prisma/migrations/20260713000000_add_asb_definition_tag/migration.sql`（手書き。**MIGRATION_CHECKSUMS には足さない** — `deployPendingMigrations` が起動時 replay する。CourseworkTag を雛形にした CREATE TABLE + 3 INDEX）。
- `electron-src/lib/prisma/asbDefinitionTag.ts`（`examTag.ts` 雛形。get/create/delete/`setAsbDefinitionTags`）。
- `electron-src/ipc-handlers/tagHandlers.ts`: `asbDefinitionTag:getByDefinitionId|create|delete|setDefinitionTags` 追加。
- `electron-src/preload-apis/tagApi.ts`: `asbDefinitionTagGetByDefinitionId|Create|Delete|SetDefinitionTags` 追加。
- `src/types/electron/tagApi.d.ts`: `AsbDefinitionTagWithTag` 型＋メソッド型追加。
- `electron-src/lib/prisma/asbDefinition.ts` `listAsbDefinitions`: `select` に `tags`、返り値に `tags` 追加。
- `src/types/answerSheetBuilder.types.ts` `ASBDefinitionListItem`: `tags?: { id; name; color: string | null }[]` 追加。

### coursework 一覧取得の拡張

- `electron-src/lib/prisma/coursework.ts` `getCourseworks`: `include` に `tags`・`classrooms` 追加。
- `src/types/coursework.types.ts` `CourseworkSummary`: `tags`・`classrooms` を include 形状に拡張。

### その他

- 解答用紙一覧の削除確認をネイティブ `confirm()` → `AlertDialog` モーダル化（`AnswerSheetDefinitionList.tsx`。destructiveパターンは `ClassroomRemovalDialog.tsx` を踏襲）。
- 成績算出一覧「次のステップ」ボタンの CSS はみ出し修正（`GradeListContainer.tsx`。アイコンに `shrink-0`、テキストに `min-w-0 truncate`）。

---

## 1. 解答用紙 detail / 1.作成 / 2.書き出し 3ページ分離

### 目的

現状 `/answer-sheet-builder/[definitionId]` がエディタ直行。試験(exam)のワークフロー流儀に揃え、**3ページ構成**（概要 / 1.作成 / 2.書き出し）に分離する。detail は「段階」ではなく概要ページ。

### 新しいルーティング

```
src/app/answer-sheet-builder/[definitionId]/
├── layout.tsx        # 新規: パンくずタブ（概要 / 1. 作成 / 2. 書き出し）
├── page.tsx          # 概要(detail)に書き換え
├── 01-edit/page.tsx  # 新規: 現エディタ（AnswerSheetBuilderMainView）を移設
└── 02-export/page.tsx # 新規: 書き出しページ
```

### 実装ステップ

1. **`[definitionId]/layout.tsx`（新規）** — `exams/[examId]/layout.tsx` を雛形に。
   - `useParams` で `definitionId`、`usePathname` で現在地判定。
   - `loadDefinition(definitionId)` で name 取得（`window.electronAPI.answerSheetBuilder.loadDefinition`）。
   - タブ: `[{ label: "概要", path: "" }, { label: "1. 作成", path: "/01-edit" }, { label: "2. 書き出し", path: "/02-export" }]`。base = `/answer-sheet-builder/${definitionId}`。**現在地判定は `pathname === base + step.path`（exact。exams の `includes` は概要=空pathで誤判定するため不可）**。
   - パンくず: `解答用紙作成(href) > {name}`。右に「一覧へ戻る」。
   - `GuardedLink`（`@/components/common/GuardedLink`）＋ `Breadcrumb`系（`@/components/ui/breadcrumb`）＋ `cn`（`@/lib/utils`）。
   - `<main className="min-h-0 flex-1 overflow-auto">{children}</main>`。

2. **`01-edit/page.tsx`（新規）** — 現 `[definitionId]/page.tsx` の内容をそのまま移設:

   ```tsx
   "use client"
   import { useParams } from "next/navigation"
   import { AnswerSheetBuilderMainView } from "@/components/answer-sheet-builder/AnswerSheetBuilderMainView"
   export default function Page() {
     const params = useParams<{ definitionId: string }>()
     return <AnswerSheetBuilderMainView definitionId={params.definitionId} />
   }
   ```

3. **`02-export/page.tsx`（新規）** ＋ **`AnswerSheetExportView`（新規コンポーネント）**
   - `ExportDialog.tsx`（`src/components/answer-sheet-builder/components/export/ExportDialog.tsx`）の中身（PDF/PNG/印刷ボタン＋DPI入力）を Dialog ラッパーを外してページ化。
   - `loadDefinition(definitionId)` で `AnswerSheetDefinition` 取得 → `useAnswerSheetExport()`（`exportPdf`/`exportPng`/`printSheet`/`isExporting`）を使用。
   - 配置は機能内: `src/components/answer-sheet-builder/AnswerSheetExportView.tsx`。

4. **`[definitionId]/page.tsx` を detail に書き換え** ＋ **`AnswerSheetDefinitionDetail`（新規コンポーネント）**
   - `src/components/answer-sheet-builder/AnswerSheetDefinitionDetail.tsx`。
   - `loadDefinition` でメタ取得。設問数・配点は `AnswerSheetBuilderMainView.tsx` 120-140行の算出ロジック、または `listAsbDefinitions` の集計を流用。
   - 表示: 名前 / 用紙サイズ・向き / 設問数 / 合計配点 / レンダーモード / 更新日時。
   - **個別タグ設定UI**: `EditExamWindow.tsx`（`src/components/exams/forms/EditExamWindow.tsx` 173-236行）を雛形に。Input＋サジェスト（`tagGetAll` フィルタ）＋追加ボタン＋Enter、確定タグは `Badge`＋`X`削除。
     - 現タグ取得: `window.electronAPI.asbDefinitionTagGetByDefinitionId(definitionId)`。
     - 反映: `window.electronAPI.asbDefinitionTagSetDefinitionTags(definitionId, tagIds)`（detail なので即時保存が自然）。tag名→id は `tagFindOrCreate`。
   - 「1. 作成へ」「2. 書き出しへ」の導線ボタン。

5. **`AnswerSheetBuilderMainView.tsx` の書き出し機能を分離**
   - 出力ボタン（203-211行 `setExportDialogOpen(true)`）を `router.push(\`/answer-sheet-builder/${definition.id}/02-export\`)` に変更（`useRouter` は既にimport済み・45行）。
   - `ExportDialog` マウント（364-368行）と `exportDialogOpen` state・`ExportDialog` import を削除。
   - **変換ダイアログ（`ExamIntegrationDialog`）は残す**。

6. **一覧 `AnswerSheetDefinitionList.tsx` の遷移先調整**
   - 行クリック `handleEdit` → 概要(detail) `/answer-sheet-builder/${id}`。
   - DropdownMenu「編集」→ `/answer-sheet-builder/${id}/01-edit`。
   - `handleCreate`（新規作成後）→ `/answer-sheet-builder/${id}/01-edit`（作成直後は編集したい）。

### 注意

- URL 変更（`[definitionId]` = エディタ → 概要）は上記遷移箇所すべてに波及。取りこぼしに注意。
- エディタは自動保存なので `GuardedLink` の未保存ガードは実質不要だが、一貫性のため使ってよい。

---

## 2. .asb archive のタグ対応（version 1.2.0）

### 設計方針（coursework-archive 流を採用）

exam-archive は subtotalGroup 経由でタグ収集するが .asb には subtotalGroup が無い。**coursework-archive の「Tag本体セクション + tagId参照」＋ `resolveTags`（UUID一次照合 → name upsert）** が最良の雛形。schema は実装済み（`AsbDefinitionTag`）なので **export/import ロジックの追加のみ**。

### 変更ファイル

1. **`src/types/asbArchive.types.ts`**
   - `AsbArchiveVersion` に `"1.2.0"` 追加、`ASB_CURRENT_VERSION = "1.2.0"`、`ASB_SUPPORTED_VERSIONS` に追加。
   - 型追加:
     ```ts
     export interface ArchiveAsbTag {
       id: string
       name: string
       order: number
       color: string | null
     }
     export interface AsbArchiveData {
       manifest: AsbArchiveManifest
       definition: AnswerSheetDefinition
       tagsData?: ArchiveAsbTag[] // v1.2.0+
       asbDefinitionTags?: { tagId: string }[] // v1.2.0+ 定義への参照
     }
     ```

2. **`electron-src/lib/import/asb-transformers/V1_1_0_to_V1_2_0.ts`（新規）**
   - `V1_0_0_to_V1_1_0.ts` を雛形に。`fromVersion="1.1.0"`/`toVersion="1.2.0"`。
   - `transform`: `tagsData`/`asbDefinitionTags` を `?? []` で補完し冪等に、`manifest.version = "1.2.0"`、`warnings: []`。
   - `asb-transformers/index.ts` の `ASB_TRANSFORMERS` 配列に `new V1_1_0_to_V1_2_0_Transformer()` を追加＋import。

3. **Export `electron-src/lib/export/asb-archive/dataCollector.ts`**
   - `collectAsbData` を prisma アクセス可能に（`asbDefinitionId` と prisma を渡し非同期化）。

   ```ts
   const asbDefinitionTags = await prisma.asbDefinitionTag.findMany({
     where: { asbDefinitionId: definition.id },
     include: { tag: true },
   })
   const tagsData: ArchiveAsbTag[] = asbDefinitionTags.map(
     (asbDefinitionTag) => ({
       id: asbDefinitionTag.tag.id,
       name: asbDefinitionTag.tag.name,
       order: asbDefinitionTag.tag.order,
       color: asbDefinitionTag.tag.color,
     })
   )
   const asbDefinitionTagRefs = asbDefinitionTags.map((asbDefinitionTag) => ({
     tagId: asbDefinitionTag.tagId,
   }))
   ```
   - `archiveCreator.ts` の `createManifest`/ZIP書き込みで `tagsData`/`asbDefinitionTags` をアーカイブに含める。

4. **Import `electron-src/lib/import/asb-archive/dataCreator.ts`**
   - coursework の `resolveTags`（`electron-src/lib/import/coursework-archive/idRemapper.ts` 162-185行）を移植:
     ```ts
     const tagMap = new Map<string, string>()
     for (const archiveTag of tagsData ?? []) {
       const byId = await tx.tag.findUnique({ where: { id: archiveTag.id } })
       if (byId) {
         tagMap.set(archiveTag.id, byId.id)
         continue
       }
       const tag = await tx.tag.upsert({
         where: { name: archiveTag.name },
         create: {
           name: archiveTag.name,
           order: archiveTag.order,
           color: archiveTag.color,
         },
         update: {},
       })
       tagMap.set(archiveTag.id, tag.id)
     }
     for (const ref of asbDefinitionTags ?? []) {
       const realTagId = tagMap.get(ref.tagId)
       if (!realTagId) continue
       const existing = await tx.asbDefinitionTag.findUnique({
         where: {
           asbDefinitionId_tagId: {
             asbDefinitionId: newDefinitionId,
             tagId: realTagId,
           },
         },
       })
       if (!existing) {
         await tx.asbDefinitionTag.create({
           data: { asbDefinitionId: newDefinitionId, tagId: realTagId },
         })
       }
     }
     ```
   - **`name @unique` の環境またぎ衝突は必ず `upsert({ where: { name } })` で吸収**（tagId 直挿入は禁止）。
   - **トランザクション境界**: 現状 `dataCreator` は `saveAsbDefinition` 経由で保存。タグ解決・`AsbDefinitionTag` 挿入を定義保存と同一トランザクションに載せられるか要確認（`dataCreator.ts` と `saveAsbDefinition` 全文を確認して組み込み先を決める）。

5. **テスト新設**: `__tests__/import-export/` に ASB transformer チェーン＋round-trip テスト（exam版 `examTransformerChain.test.ts` / `charGuideRoundTrip.test.ts` を参考）。旧 1.1.0 形状フィクスチャで `tagsData` 未定義→no-op を検証。

### 参照

- `src/types/examArchive.types.ts` `ArchiveTagsData`（1073-1098）
- `electron-src/lib/import/coursework-archive/idRemapper.ts` `resolveTags`（162-185）← 最良の雛形
- `electron-src/lib/import/exam-archive/dataCreator.ts`（152-238）

---

## 3. coursework / grade の 01-setup を detail編集モーダル化

### 目的

試験外成績資料(coursework)・成績算出(grade)の「01-setup（基本設定）」段階を廃止し、試験(exam)流儀の **detail画面＋編集モーダル** に揃える。ワークフロー/パンくず再編を含む。

### 未調査（着手前に調べる）

- coursework: `src/app/coursework/[courseworkId]/` のルーティング・layout・01-setup が持つ設定項目（name/description/date/学級/タグ）と、その保存API。detail画面の有無。
- grade: `src/app/grades/[gradeId]/` 同様。01-setup の設定項目（name/description/referenceDate/学級）と保存API。
- 試験(exam)の detail＋編集モーダルの実装（`src/components/exams/detail/`、`EditExamWindow.tsx`）を雛形として確認。

### 想定ステップ（調査後に確定）

1. 各 `[id]/layout.tsx` のワークフローステップ配列から `01-setup` を除去し、以降を繰り上げ。
2. detail画面（`[id]/page.tsx` 相当）に基本設定の表示＋「編集」ボタン→編集モーダル（`EditExamWindow` 相当）を新設。
3. 01-setup ページ・コンポーネントを削除（re-export は残さず import 元を全更新 — CLAUDE.md 方針）。
4. 新規作成後の遷移先（現状 `/coursework/${id}/01-setup` / `/grades/${id}/01-setup`）を detail へ変更。`CourseworkListContainer`/`GradeListContainer` の `handleCreated`・import後遷移も更新。
5. パンくず・「次のステップ」導線の整合。

### 注意

- 新規作成直後は設定が空。detail で編集モーダルを自動で開く等の UX 配慮を検討。
- grade/coursework の学級管理は `ClassRosterManager`（共通化済み、`project_class_statistics_phase5_blocked` 参照）。基本設定と学級管理の切り分けに注意。

---

## 4. 最終検証（Phase 8）

- `npm run typecheck`（Next.js + electron-src 両方）
- `npm run lint`（eslint + prettier --check）。**format は自分の変更ファイルのみ `prettier --write`**（並行セッション注意。`useDataSources.ts` 等の既存未ステージ変更には触れない）。
- `npx vitest run __tests__/import-export/`（archive 変更時）＋関連テスト。
- 動作確認: 各一覧のフィルタ・一括タグ付与・削除モーダル、解答用紙の detail/edit/export 遷移、.asb round-trip でタグ往復。

---

## 進め方の推奨

破壊的なルーティング変更（1・3）は取りこぼしが出やすいので、**1つのPhaseごとに typecheck を通してからコミット**する。順序は 1（解答用紙分離）→ 2（archive）→ 3（coursework/grade setup）→ 4（検証）。2 は 1 と独立なので順不同可。

---

## code-review（high effort, 2026-07-13）の指摘

**correctness はこのセッションで修正済み**:

- 日付フィルタの UTC/ローカル日ズレ → `useListFilter` でローカル日（`getFullYear/getMonth/getDate`）比較に。
- ASB: 削除後も id が選択に残り FK 失敗を握りつぶし誤 success → `confirmDelete` で `selectedIds` から削除 id を除去。
- coursework: `setCourseworkTags` 全置換による stale タグ消失＋`{success:false}` 無視 → 個別追加 API `addCourseworkTag`（`courseworkTag.upsert`、冪等）を新設し、一括付与を `coursework.addTag` へ。失敗は throw して error トースト。
- フィルタ0件で「該当なし」が出ない（3画面）→ 各 TableBody に条件付き「条件に一致する〜がありません」行。ASB は空状態ガードを `definitions.length===0` に変更。
- loadTags の空 catch → `console.error` でログ。
- 命名: `useListFilter` の `item` → `listItem`（濁り名の是正）。

**cleanup（本リファクタ内で解消・計画送り）**:

- **ExamList を useListFilter/ListFilterBar に移行**（現状インライン重複）。試験一覧の挙動を壊さないよう単体検証しながら。
- **行選択の共通化**: `selectedIds`/`toggleSelect`/`toggleSelectAll`/`allSelected` が coursework/ASB で重複 → `useRowSelection<T>` hook 化。
- **一括タグ付与の共通化**: coursework(addTag)と ASB(asbDefinitionTagCreate)で意味論が揃ったので共通ヘルパーに。
- **option 集約の共通化**: grade/coursework の学級 `nameById` 集約が重複。
- **`.asb` archive のタグ未対応（correctness）は §2 で対応**。
