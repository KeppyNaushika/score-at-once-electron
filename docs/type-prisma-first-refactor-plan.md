# 型定義 Prisma-first リファクタ計画（B・C・D 一括）

> 起点: `docs/type-definitions-audit.md` の残項目（1-B補足 / 2-A common.types / 配置3）を、
> 「独自型は3例外のみ・DBデータは Prisma 派生・renderer 計算はフック・Prisma 拡張は適切な家へ」
> の原則で再判定した結果をまとめたもの。B・C・D を **一括**で実施する。

## 判定基準（確認済みの規約）

1. **独自型（hand-written interface/type）が許されるのは次の3例外のみ**
   - **(1) archive transformer** — 過去アーカイブは当時のスキーマで、現行 Prisma が型生成できない。
     型を凍結しチェーンで解釈させることで、スキーマ変更のたびに過去 transformer を触らずに済ませる。
   - **(2) Excel/PDF 外部出力** — 帳票整形 DTO。
   - **(3) DBデータを使わない一時/計算状態**。
2. 上記以外で **DBデータに関わる型はすべて Prisma 派生**（`Pick` / `Omit` / `GetPayload` /
   `UncheckedCreateInput`）＋境界で Decimal→number・String→union 注入。
3. **renderer の表示計算はフックで**行う。main の IPC ハンドラに presentation ロジック
   （表示文言・遷移 URL・着手可否など）を置かない。
4. **Prisma 拡張型は grab-bag（common.types）でなく `prismaExtensions.ts` か
   `types/` 配下の適切なファイル**へ配置する。
5. **enum 代替の literal union SSOT** は Prisma が String としか型付けないため、
   専用ファイルの独自型が正当（`scoringStatus.types.ts` / `examStudentStatus.types.ts` と同型）。

---

## B. 同名別物3組の解消（Prisma-first）

| 対象                                                        | DBデータか                                                                | 対応                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①A `QuestionScoreData`（`common.types.ts`・死型）           | QuestionScore 手書き複製・**外部参照0**                                   | **削除**。併せて未使用フィールド `CropRegionArea.questionScores` も削除（読者の `examStatus.ts` が触るのは `ExamWithDetails.cropRegions` の Prisma 版で別物）                                                                                                                                                                                   |
| ①B `QuestionScoreData`（`subtotalCalculator.ts`・計算入力） | QuestionScore の部分集合                                                  | **Prisma 派生** `Pick<QuestionScore, "studentId" \| "cropRegionId"> & { status: ScoringStatus; partialScore?: number \| null }`。①A 削除で同名衝突も解消                                                                                                                                                                                        |
| ②a `SubtotalGroupData`（`merge/matchers/types.ts`）         | `prisma.subtotalGroup.findMany()` を読む                                  | **Prisma 派生** `Pick<SubtotalGroup, "id" \| "name"> & { updatedAt: string \| Date }`。型エイリアス化で `[key: string]: unknown` 回避策を撤去（`MatchResult<T extends Record<string, unknown>>` 制約は Prisma 派生エイリアスで充足することを実証済）。matcher family（`MatchStudentData` / `ClassroomData` / `UserData`）も同様に Prisma 派生化 |
| ②b `SubtotalGroupData`（`shared/types/exportTypes.ts`）     | Excel/PDF 出力の整形 DTO                                                  | 例外(2) → **hand-written 正当・維持**                                                                                                                                                                                                                                                                                                           |
| ③ `IdMappings`（`exam-archive/idRemapper.ts`）              | id→id の文字列マップ。archive 取り込みの一時状態。Prisma に対応モデル無し | 例外(1)(3) → **hand-written 正当**。同名別物（`merge/types.ts` の汎用 `IdMappings`）との衝突のみ解消するため **`ExamArchiveIdMappings` へ rename**（既存 `AsbIdMappings` と命名を揃える）                                                                                                                                                       |

## C. `common.types.ts` の解体・再配置（＝2-A 本体）

各型を「正しい姿」へ直し、**適切な家**へ移す。結果として `common.types.ts` は空になり **廃止**する。

| 型                                                                                                | 正しい姿                                                                                                                                                                                                                                                                                                                | 移設先                                                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ExamWithDetails`                                                                                 | 既に `Prisma.ExamGetPayload<…> & { 平坦化 }`（維持）                                                                                                                                                                                                                                                                    | → `prismaExtensions.ts`                                                                     |
| `ExamListItem`                                                                                    | `status` を renderer フックへ移し（D 参照）、残りは `Pick<Exam, "id" \| "examName" \| "examDate" \| "description" \| "createdAt" \| "updatedAt"> & { tags: Pick<Tag, "id" \| "name" \| "color">[] }`。**status 除去後は型自体が不要になる可能性**（`ExamWithDetails`/`ExamPayload` で足りるか実 import を確認して判断） | → `prismaExtensions.ts` もしくは exam ドメイン型ファイル                                    |
| `CropRegionArea`                                                                                  | Prisma `CropRegion` 拡張。`type` は `CropRegionAreaType` 注入・`points` は `Int?`・保存前フィールドは optional。`questionScores` 死フィールドは削除（B①A）                                                                                                                                                              | → `prismaExtensions.ts` もしくは cropRegion ドメイン型ファイル                              |
| `QuestionScoreCreateData` / `QuestionScoreUpdateData`                                             | `Omit<Prisma.QuestionScoreUncheckedCreateInput, "id" \| …>` 派生（模範 `cropRegionApi.d.ts`）。partialScore Decimal→number・status union 注入                                                                                                                                                                           | → `scoringApi.d.ts`                                                                         |
| `CropRegionCreateData` / `CropRegionUpdateData`                                                   | `Prisma.CropRegionUncheckedCreateInput / UpdateInput` 派生。type union 注入                                                                                                                                                                                                                                             | → `cropRegionApi.d.ts`                                                                      |
| `CROP_REGION_AREA_TYPES` / `CropRegionAreaType` / `isCropRegionAreaType` / `toCropRegionAreaType` | enum 代替 SSOT（正当な独自型）                                                                                                                                                                                                                                                                                          | → 専用ファイル **`cropRegionAreaType.types.ts`**（`scoringStatus.types.ts` と構造を揃える） |
| `QuestionScoreData`                                                                               | 死型                                                                                                                                                                                                                                                                                                                    | **削除**                                                                                    |
| `isValidExam`                                                                                     | `ExamWithDetails` の型ガード                                                                                                                                                                                                                                                                                            | → `ExamWithDetails` の移設先に同伴                                                          |

## D. `ExamListItem.status`（次のステップ表示）の層違反是正

- **現状**: `electron-src/ipc-handlers/examHandlers.ts` が 8 段階ワークフローの「次のステップ」
  （`step` / `action` / `text` / **遷移 URL** / `isCompleted` / `canStart`）を main で組み立て、
  IPC で renderer に渡している。
- **問題**:
  - presentation ロジック（表示文言・renderer のルート URL）が **main にある層違反**。規約「renderer 計算はフックで」に反する。
  - `src/lib/examStatus.ts` の `getExamProgress()` と **二重実装**（同じ DB 事実 hasImages/hasLayout/hasRegionInfo/採点状況を別実装で計算）。
  - パフォーマンス上の正当化は無い（boolean 判定＋段階選択のみ・入力は取得済みリレーションから導出可能）。
- **対応**:
  - IPC は **Prisma 派生の試験データ**（＋renderer で安く導けない集計事実があればそれのみ）を返す。
  - 「次のステップ」表示は **renderer フック**（`src/lib/examStatus.ts` を再利用/拡張）で計算し、
    結果を **`ExamWorkflowStatus`** として名前付け（「共有計算結果」の名前付き型）。
  - 二重実装を `src/lib/examStatus.ts` へ一本化。

---

## 実施方針

- **B・C・D を一括**で実施する（相互依存が強い: C の `ExamListItem` は D の完了で確定し、
  B①A の削除は C の `CropRegionArea` 修正と同じファイルに及ぶ）。
- 着手前に各型の**実 import 元**（`CropRegionArea` 36 箇所ほか）と**実クエリ/実呼び出し形状**を
  洗い出し、派生形と移設先を確定してから機械的に置換する（2-A grade と同じ進め方）。
- 検証: `npm run typecheck`（Next + electron 両方）、影響する `vitest` を通す。
- `any` / 不正な `as` を新たに導入しない。境界変換（`toScoringStatus` / `toCropRegionAreaType` 等）で
  型＝実体を一致させる。

## スコープ外

- **配置3**（`transformers/types.ts` の配置統一）: issue #912 にコメント済。exam transformer の
  本配線と同時、main 側寄せが有力、実装時に再判断。本リファクタには含めない。
