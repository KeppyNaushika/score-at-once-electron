# 解答用紙作成の IPC 分割 実装計画

## 1. 背景

解答用紙作成（`/answer-sheet-builder`）だけが、**編集内容を書き換える IPC を1本しか持たない**。
`asb:save-definition` が定義ツリー全体を受け取り、`saveAsbDefinition` が既存を delete して作り直す。

他の機能は実体ごと・意図ごとに割れている。

| 機能                    | ハンドラ                        | チャンネル数 | 内容を書き換える経路                              |
| ----------------------- | ------------------------------- | ------------ | ------------------------------------------------- |
| 成績算出                | `gradeHandlers.ts`              | 49           | 実体ごと（`grade:createGradeItem` 等）            |
| 試験外成績資料          | `courseworkHandlers.ts`         | 27           | 実体ごと                                          |
| 採点領域（02-template） | `cropRegionHandlers.ts`         | 22           | 実体ごと（`create/update/delete-crop-region` 等） |
| **解答用紙作成**        | `answerSheetBuilderHandlers.ts` | **14**       | **`asb:save-definition` の1本のみ**               |

ASB の残り13本は読み出し（`load` / `list`）とファイル操作（`export-pdf` / `upload-image` /
`import-definition` 等）で、編集内容を DB に書く経路は1本しかない。

採点領域は「キャンバス上に多数の行があり、自動保存する」という ASB と同型の画面でありながら、
実体ごとに割れている。**ASB だけが違う書き方をしている。**

### 1.1 決定

**exam / grade と同様に実体ごとへ分割する。** 本書はその実装計画である。

---

## 2. 判定基準：状態を運ぶか、意図を運ぶか

問題はチャンネルの本数ではない。**運んでいるものが状態か意図か**である。

- **意図を運ぶ IPC** — 「この小問の配点を3にした」。書き込み先はその1行に限定される
- **状態を運ぶ IPC** — 「これが今の全体像です、合わせてください」。**利用者が触っていない行まで
  含めて全体の権威を主張する**

DB が共有されている以上、後者は成立しない。本数を増やしても状態を運ぶ限り直らず、1本のままでも
意図を運べば直る。したがって割る目的は「意図を運ぶ形にすること」であって、本数そのものではない。

### 2.1 状態を運ぶのが正しい経路もある

undo / redo・複製・アーカイブ取り込みは、本当に「この姿にしろ」という一括操作である。ここは
文書丸ごとを運ぶのが正しい。**間違っているのは、日常の1文字の編集までその経路に流していること。**

目標形は「全部1本」でも「全部割る」でもなく、**通常編集は意図・バルクはバルク**。

---

## 3. 現状の測定

すべて 2026-08-02 に実測した値である。

### 3.1 delete → recreate による実害

`electron-src/lib/prisma/asbDefinition.ts:159-161`

```ts
await prisma.$transaction(async (tx) => {
  await tx.asbDefinition.deleteMany({ where: { id: definition.id } })  // Cascade で子11テーブル全消し
  await tx.asbDefinition.create({ ... })                               // 全部作り直し
})
```

| 症状                        | 測定結果                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| FK カスケードが実際に走るか | Prisma のドライバアダプタ下で `PRAGMA foreign_keys = 1`。テストDB複製で削除→再作成後、タグ紐付けは **0件** |
| タグ紐付けの現存数          | 定義12件に対し `AsbDefinitionTag` は **0件**（開発用DB）                                                   |
| `createdAt` のリセット      | `AsbDefinition` **12件すべて** `createdAt` と `updatedAt` がミリ秒まで一致                                 |
| OMR 設定の再生成            | `AsbOmrConfig` 66件。保存のたび `crypto.randomUUID()` で id 再生成                                         |

`createdAt` は既に全件失われている（実質「最終保存日時」の複製）。復元はできない。

タグは概要画面（`AnswerSheetDefinitionDetail.tsx:79`）と一覧（`AnswerSheetDefinitionList.tsx:192`）から
設定できるため、**タグを付けてから編集画面を開くと消える**。

### 3.2 編集画面を開くだけで保存が走る

`src/components/answer-sheet-builder/AnswerSheetBuilderMainView.tsx:94-108` の effect は依存配列が
`[definition, isLoaded, user?.id, showSaving, showSaved]` で、読み込み完了で `definition` が
セットされた時点で発火する。編集の有無を見ていない。

`SET_DEFINITION` は undo 履歴もスキップされる（`useUndoableReducer.ts:22`）ため、「編集した」ことを
示す状態がどこにも無い。

### 3.3 renderer 生成 id が uuid ではない

`src/components/answer-sheet-builder/constants.ts:109-112`

```ts
let _nextId = 1
export function generateId(): string {
  return `asb_${Date.now()}_${_nextId++}`
}
```

`_nextId` はモジュールスコープで、プロセス起動ごとに1へ戻る。**2端末が同一ミリ秒に最初の実体を
作れば同じ id になる。** id が衝突すると、行レベル LWW は別々の実体を1行へ畳む。

既存行の内訳（開発用DB）:

| テーブル           | 行数 | うち `asb_` 形式 |
| ------------------ | ---- | ---------------- |
| `AsbMajorQuestion` | 84   | 28               |
| `AsbSubQuestion`   | 233  | 63               |
| `AsbHeaderField`   | 72   | 19               |
| `AsbTextElement`   | 248  | 71               |

`docs/coding-style.md` の「id は原則 uuid」に反している。id が renderer で作られて主キーになる以上、
分割の前提として直す必要がある。

### 3.4 所有者以外には一覧に出ない — 共有はまだ成立していない

```ts
// electron-src/lib/prisma/asbDefinition.ts:81
const rows = await prisma.asbDefinition.findMany({
  where: { userId },   // ← 所有者のものしか返さない
  ...
})
```

`userId` は renderer の `AuthContext` が持つログイン中ユーザー（`useAnswerSheetDefinitions.ts:23` →
`asb:list-definitions`）。**別の教員としてログインすると、同期されてきた定義は一覧に現れない。**
一覧が唯一の発見手段であり（`getAsbDefinition(id)` 側に所有者チェックは無いので、id を知っていれば
開ける）、実質「届いているが見えない」。

家の中で一覧の絞り方は三者三様である。

| 機能           | 一覧の絞り込み                 | 共有の仕組み                                    |
| -------------- | ------------------------------ | ----------------------------------------------- |
| 試験           | `userExams.some({ userId })`   | **UserExam 中間テーブル**。複数教員が参加できる |
| 成績算出       | 絞らない（`getAllGrades()`）   | 全員が全部見える                                |
| 試験外成績資料 | 絞らない（`getCourseworks()`） | 全員が全部見える                                |
| 解答用紙作成   | `where: { userId }`            | **無い**。単一所有者の FK 一本                  |

> **⚠️ 2026-08-03 訂正**
>
> 初版はここに「main 側は誰がログインしているかを知らない」と書いていた。**誤り。**
> 認証ストア経由で取得できる（`electron-src/lib/prisma/auditActor.ts` の
> `getCurrentActorUserId()`。ログイン時に renderer が `saveAuthToken(user.id)` を呼び、
> 監査ログの操作者記録は既にこの経路で動いている）。
>
> 暫定実装のまま残っているのは `getCurrentUser()`（`user.ts:16-25`、`findFirst()` を返す）で、
> **経路が無いのではなく、古い実装が1つ残っている**だけ。差し替えれば済む。詳細と、
> それが引き起こしている現在の誤記録は
> [docs/ownership-and-sharing-design.md](./ownership-and-sharing-design.md) §2.3・§2.4。

**この事実は段階の優先度を変える**（§7 冒頭）。所有者システムは #1127 の担当で、設計は
[docs/ownership-and-sharing-design.md](./ownership-and-sharing-design.md) にある。

---

## 4. 目標形

### 4.1 チャンネル一覧

実体 × 操作で31本。命名は既存の ASB に合わせて `asb:` 接頭辞・ケバブケース。すべて
`registerHandler` で登録する（payload を返し、失敗は例外。
[ipc-and-data-fetching-plan.md](./ipc-and-data-fetching-plan.md) 参照）。

| 実体                 | チャンネル                                                                                                            | 本数 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ---- |
| 定義本体             | `asb:update-definition`                                                                                               | 1    |
| ラベル連番の一括適用 | `asb:apply-label-preset`                                                                                              | 1    |
| ヘッダー項目         | `asb:create-header-field` `asb:update-header-field` `asb:delete-header-field` `asb:reorder-header-fields`             | 4    |
| 大問                 | `asb:create-major-question` `asb:update-major-question` `asb:delete-major-question` `asb:reorder-major-questions`     | 4    |
| 小問                 | `asb:create-sub-question` `asb:update-sub-question` `asb:delete-sub-question` `asb:reorder-sub-questions`             | 4    |
| 枝問                 | `asb:create-branch-question` `asb:update-branch-question` `asb:delete-branch-question` `asb:reorder-branch-questions` | 4    |
| テキスト要素         | `asb:create-text-element` `asb:update-text-element` `asb:delete-text-element` `asb:reorder-text-elements`             | 4    |
| 画像要素             | `asb:create-image-element` `asb:update-image-element` `asb:delete-image-element` `asb:reorder-image-elements`         | 4    |
| 文字位置マーカー     | `asb:create-char-guide` `asb:update-char-guide` `asb:delete-char-guide`                                               | 3    |
| OMR 設定             | `asb:upsert-omr-config` `asb:delete-omr-config`                                                                       | 2    |
| **バルク**           | `asb:replace-definition`（現 `asb:save-definition` を改名）                                                           | 1    |

### 4.2 並び順の扱い（規則）

**削除と並び替えで責任の所在が違う。** 混ぜると order に穴が空く。

| 操作        | `order` を決めるのは | 理由                                                               |
| ----------- | -------------------- | ------------------------------------------------------------------ |
| create      | main                 | 末尾に付ける。既存の最大 + 1                                       |
| **delete**  | **main**             | 残りの並びは既存 `order` で決まっており、renderer が持つ情報は無い |
| **reorder** | **renderer**         | 新しい並びは renderer にしか無い。`orderedIds: string[]` を渡す    |

`orderedIds` は `docs/coding-style.md` の「id を保持してよい4用途」の 2（並べ替えの順序）に該当する。
`reorder` を `update` に畳まないのは、採点領域が `update-crop-region-orders` を独立させている先例に倣う。

### 4.3 `asb:apply-label-preset` を独立させる理由

`SET_LABEL_PRESET` は preset 列を書くだけでなく、**配下の大問・小問・枝問のラベルを一括で振り直す**
（`useAnswerSheetDefinition.ts:256-298`）。定義本体の属性更新とは書き込み範囲が違う。

ラベルの割り当て計算（`parsePresetLabels` と添字対応）は **renderer に残す**（`docs/coding-style.md`
「main 側で特殊な計算をして専用 IPC を生やさない」）。IPC が運ぶのは計算結果である。

```ts
asb:apply-label-preset(
  definitionId: string,
  category: "major" | "sub" | "branch",
  preset: string,
  relabeled: Array<{ id: string; label: string }>
)
```

preset 列と relabeled を1トランザクションで書く。

### 4.4 OMR を upsert 1本にする理由

選択肢は設定に完全従属し、`OMRCellConfig` が `labels: string[]` / `correctAnswers: number[]` という
形で来る（個々の選択肢に id が無い）。**設定単位の upsert が意図の最小単位**であり、選択肢の
総入れ替えはその内側に閉じる。

鍵は複合 unique を使う（`AsbOmrConfig.subQuestionId` は `@unique`、`AsbOmrChoiceOption` は
`@@unique([omrConfigId, choiceIndex])`）。**id を鍵にしてはいけない** — 既存行の id は uuid で、
renderer からは往復してこない（§8.1）。

### 4.5 バルク経路に残すもの

`asb:replace-definition` は次の3経路だけが使う。

| 経路               | 現在の呼び出し元                                         |
| ------------------ | -------------------------------------------------------- |
| undo / redo        | `useUndoableReducer` の past/future 復元                 |
| 複製               | `answerSheetBuilderHandlers.ts:461`                      |
| アーカイブ取り込み | `electron-src/lib/import/asb-archive/dataCreator.ts:107` |

改名する理由は、この経路が「状態を運ぶ」ことを名前で明示するため。`save` は日常の保存に見え、
再び通常編集がここへ流れ込む。

---

## 5. main 側の構成

### 5.1 ファイル分割

`saveAsbDefinition`（`asbDefinition.ts:150-388`、239行の一枚岩）を実体ごとの書き込み関数へ分解する。
IPC ハンドラはそれを呼ぶだけにする。

| ファイル（新規は ✚）         | 担当                                 |
| ---------------------------- | ------------------------------------ |
| `asbDefinition.ts`           | 定義本体の更新・一覧・単体取得・削除 |
| ✚ `asbHeaderField.ts`        | ヘッダー項目                         |
| ✚ `asbQuestion.ts`           | 大問・小問・枝問                     |
| ✚ `asbCellElement.ts`        | テキスト要素・画像要素               |
| ✚ `asbCharGuide.ts`          | 文字位置マーカー                     |
| ✚ `asbOmrConfig.ts`          | OMR 設定・選択肢                     |
| ✚ `asbDefinitionReplace.ts`  | バルク（上記の関数を使う差分適用）   |
| `asbDefinitionConverters.ts` | 変換のみ（`createOmrConfig` は移動） |

### 5.2 関数シグネチャ

型は `src/types/answerSheetDefinition.types.ts` のものをそのまま使う（`docs/coding-style.md`
「IPC 通信における型の一貫性」）。

```ts
// asbDefinition.ts
export async function updateAsbDefinition(
  definitionId: string,
  data: Partial<AsbDefinitionAttributes>
): Promise<void>

export async function applyAsbLabelPreset(
  definitionId: string,
  category: "major" | "sub" | "branch",
  preset: string,
  relabeled: Array<{ id: string; label: string }>
): Promise<void>

// asbHeaderField.ts
export async function createAsbHeaderField(
  definitionId: string,
  headerField: HeaderFieldDefinition
): Promise<void>
export async function updateAsbHeaderField(
  headerFieldId: string,
  data: Partial<AsbHeaderFieldAttributes>
): Promise<void>
export async function deleteAsbHeaderField(headerFieldId: string): Promise<void>
export async function reorderAsbHeaderFields(
  definitionId: string,
  orderedIds: string[]
): Promise<void>

// asbQuestion.ts（大問・小問・枝問。以下は大問の例、他2つも同形）
export async function createAsbMajorQuestion(
  definitionId: string,
  majorQuestion: MajorQuestion
): Promise<void>
export async function updateAsbMajorQuestion(
  majorQuestionId: string,
  data: Partial<AsbMajorQuestionAttributes>
): Promise<void>
export async function deleteAsbMajorQuestion(
  majorQuestionId: string
): Promise<void>
export async function reorderAsbMajorQuestions(
  definitionId: string,
  orderedIds: string[]
): Promise<void>

// asbCellElement.ts（テキスト・画像。親は小問か枝問）
export type AsbCellParent =
  { subQuestionId: string } | { branchQuestionId: string }

export async function createAsbTextElement(
  parent: AsbCellParent,
  textElement: CellTextElement
): Promise<void>
export async function updateAsbTextElement(
  textElementId: string,
  data: Partial<AsbTextElementAttributes>
): Promise<void>
export async function deleteAsbTextElement(textElementId: string): Promise<void>
export async function reorderAsbTextElements(
  parent: AsbCellParent,
  orderedIds: string[]
): Promise<void>

// asbCharGuide.ts
export async function createAsbCharGuide(
  subQuestionId: string,
  charGuide: ManuscriptCharGuide
): Promise<void>
export async function updateAsbCharGuide(
  charGuideId: string,
  data: Partial<AsbCharGuideAttributes>
): Promise<void>
export async function deleteAsbCharGuide(charGuideId: string): Promise<void>

// asbOmrConfig.ts
export async function upsertAsbOmrConfig(
  parent: AsbCellParent,
  config: OMRCellConfig
): Promise<void>
export async function deleteAsbOmrConfig(parent: AsbCellParent): Promise<void>

// asbDefinitionReplace.ts
export async function replaceAsbDefinition(
  definition: AnswerSheetDefinition,
  userId: string
): Promise<void>
```

`AsbCellParent` は既存の `createOmrConfig(tx, parentFK, config)` の `parentFK` と同じ形なので、
新しい概念を持ち込まない。

### 5.3 `*Attributes` 型 — `Omit` を増やさないための分解

更新ペイロードは「その実体自身の列」だけを含み、子コレクションを含んではならない。しかし
`Partial<SubQuestion>` は `branchQuestions` / `textElements` / `omrConfig` を含んでしまう。

`Omit` を並べるのではなく、**型の側を「自身の属性」と「子」に分解する**。定義は1箇所のままで、
更新ペイロードは `Partial<...Attributes>` で表せる。

```ts
// src/types/answerSheetDefinition.types.ts
export interface AsbSubQuestionAttributes {
  label: string
  heightMultiplier: number
  points: number
  usesBranchPoints?: boolean
  layoutWidth?: string
  nextPlacement?: NextPlacement
  goUp?: number
  borderStyles?: BorderStyles
  /** 文字位置マーカーは別テーブル・別チャンネルなので、ここには含めない */
  manuscriptPaper?: ManuscriptPaperAttributes
}

export interface SubQuestion extends AsbSubQuestionAttributes {
  id: string
  branchQuestions: BranchQuestion[]
  textElements: CellTextElement[]
  imageElements?: CellImageElement[]
  omrConfig?: OMRCellConfig
}
```

同じ分解を `MajorQuestion` / `BranchQuestion` / `HeaderFieldDefinition` / `CellTextElement` /
`CellImageElement` / `ManuscriptCharGuide` / `ManuscriptPaperConfig` にも施す。
`AsbDefinitionAttributes` は `name` / `renderMode` / `labelPresets` / `settings`（`headerFields` を
除く `GlobalSettings`）とする。

**これは分割の副産物ではなく前提。** 分解しないと、更新ペイロードの型がどこまで書くかを表現できず、
「小問の更新」に子の全置換が紛れ込む余地が残る。

### 5.4 バルク経路も同じ関数群を使う

`replaceAsbDefinition` は delete → recreate をやめ、`writeConstraintConfig`
（`electron-src/lib/prisma/gradeConstraint.ts:83`）と同じ形にする。

1. 残す id 以外を `deleteMany({ where: { 親, id: { notIn: keptIds } } })`
   （`keptIds` が空なら `notIn` を付けない）
2. 行ごとに `upsert`
3. 子孫は Cascade に任せる（大問を消せば小問以下も消える）

同関数のコメントに、同一 id の delete → create が sqlite-nas-sync の tombstone（秒解像度）に
負けて相手端末で INSERT が抑止される理由が既に書いてある。

**`createdAt` を update 側に置かない。** `AsbDefinition` は upsert の `update` に `createdAt` を
含めないこと（含めると §3.1 の症状が残る）。

---

## 6. renderer 側の作り替え

### 6.1 action ユニオンを id ベースにし、実体を運ぶ

現在の action は添字ベースで、かつ新しい実体を reducer の内部で作っている。

```ts
| { type: "ADD_SUB_QUESTION"; payload: { majorIndex: number } }   // id は reducer が作る
| { type: "UPDATE_SUB_QUESTION"
    payload: { majorIndex: number; subIndex: number; data: Partial<SubQuestion> } }
```

**添字のまま IPC を割ると、添字がプロセス境界を越えて書き込み先の決定に使われる**（過去に
是正した「密行列UIの添字結合」と同じ形）。また reducer 内部で id を作ると、dispatch を包んでも
新しい id を知れず書き込みを組み立てられない。

**action は「対象の id」と「作られた実体」を運ぶ形へ変える。** reducer は挿入・更新・削除だけを行う。

```ts
export type AnswerSheetAction =
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_DEFINITION"; payload: AnswerSheetDefinition }
  | { type: "UPDATE_DEFINITION"; payload: Partial<AsbDefinitionAttributes> }
  | {
      type: "APPLY_LABEL_PRESET"
      payload: { category: "major" | "sub" | "branch"; preset: string }
    }
  | {
      type: "ADD_HEADER_FIELD"
      payload: { headerField: HeaderFieldDefinition }
    }
  | {
      type: "UPDATE_HEADER_FIELD"
      payload: {
        headerFieldId: string
        data: Partial<AsbHeaderFieldAttributes>
      }
    }
  | { type: "DELETE_HEADER_FIELD"; payload: { headerFieldId: string } }
  | { type: "REORDER_HEADER_FIELDS"; payload: { orderedIds: string[] } }
  | { type: "ADD_MAJOR_QUESTION"; payload: { majorQuestion: MajorQuestion } }
  | {
      type: "UPDATE_MAJOR_QUESTION"
      payload: {
        majorQuestionId: string
        data: Partial<AsbMajorQuestionAttributes>
      }
    }
  | { type: "DELETE_MAJOR_QUESTION"; payload: { majorQuestionId: string } }
  | { type: "REORDER_MAJOR_QUESTIONS"; payload: { orderedIds: string[] } }
  | {
      type: "ADD_SUB_QUESTION"
      payload: { majorQuestionId: string; subQuestion: SubQuestion }
    }
  | {
      type: "UPDATE_SUB_QUESTION"
      payload: {
        subQuestionId: string
        data: Partial<AsbSubQuestionAttributes>
      }
    }
  | { type: "DELETE_SUB_QUESTION"; payload: { subQuestionId: string } }
  | {
      type: "REORDER_SUB_QUESTIONS"
      payload: { majorQuestionId: string; orderedIds: string[] }
    }
  | {
      type: "ADD_BRANCH_QUESTION"
      payload: { subQuestionId: string; branchQuestion: BranchQuestion }
    }
  | {
      type: "UPDATE_BRANCH_QUESTION"
      payload: {
        branchQuestionId: string
        data: Partial<AsbBranchQuestionAttributes>
      }
    }
  | { type: "DELETE_BRANCH_QUESTION"; payload: { branchQuestionId: string } }
  | {
      type: "REORDER_BRANCH_QUESTIONS"
      payload: { subQuestionId: string; orderedIds: string[] }
    }
  | {
      type: "ADD_TEXT_ELEMENT"
      payload: { parent: AsbCellParent; textElement: CellTextElement }
    }
  | {
      type: "UPDATE_TEXT_ELEMENT"
      payload: {
        textElementId: string
        data: Partial<AsbTextElementAttributes>
      }
    }
  | { type: "DELETE_TEXT_ELEMENT"; payload: { textElementId: string } }
  | {
      type: "REORDER_TEXT_ELEMENTS"
      payload: { parent: AsbCellParent; orderedIds: string[] }
    }

  // 画像要素・文字位置マーカー・OMR も同形
  | {
      type: "UPSERT_OMR_CONFIG"
      payload: { parent: AsbCellParent; config: OMRCellConfig }
    }
  | { type: "DELETE_OMR_CONFIG"; payload: { parent: AsbCellParent } }
```

`SET_NAME` / `SET_RENDER_MODE` / `UPDATE_SETTINGS` は `UPDATE_DEFINITION` に統合する
（いずれも `AsbDefinition` の列を書くだけで、書き込み範囲が同じ）。

**`APPLY_LABEL_PRESET` だけは payload に relabeled を含めない。** ラベルの割り当ては reducer が
行い、書き込み側は reducer の結果から relabeled を組み立てる（§6.5 の関所が新旧の state を
両方持つため可能）。ここだけ例外にするのは、割り当て規則を reducer と書き込み側で二重に
持たないため。

### 6.2 `generateId()` を uuid へ

`constants.ts:109-112` を `crypto.randomUUID()` に置き換える。既存行の id は変えない
（他テーブルから参照されておらず、変える必要が無い）。

`TextElementEditor.tsx:71` / `ImageElementEditor.tsx:74` / `ManuscriptPaperSettings.tsx:104` も
同じ `generateId()` を使っているので、関数の中身を変えれば揃う。

`generateId()` は 2026-08-03 に `crypto.randomUUID()` へ変えた。旧実装
（`asb_${Date.now()}_${連番}`）は連番がレンダラー起動ごとに 1 へ戻るため、2端末が同じミリ秒に
最初の要素を作ると**同一の主キー**になり、無関係な2要素が LWW で片方に上書きされた。
`__tests__/import-export/unit/uuidIdCoverage.test.ts` が id 生成の不変式を守っている。

### 6.3 生 `dispatch` の封じ込め

プレビューのドラッグ操作は、フックのコールバックを通らず `dispatch` を直接叩いている。

| 箇所                                       | 内容                                          |
| ------------------------------------------ | --------------------------------------------- |
| `AnswerSheetBuilderMainView.tsx:318`       | `AnswerSheetPreview` に `dispatch` を生で渡す |
| `usePreviewDragInteraction.ts:146,156,167` | 3箇所で直接 dispatch                          |
| `AnswerSheetBuilderMainView.tsx:122-127`   | `handleRenderModeChange` が直接 dispatch      |

**コールバックだけ配線すると、ドラッグでの変更が保存されない形で漏れる。**

`useAnswerSheetDefinition` が返す `dispatch` を、書き込みを伴う包んだ dispatch に差し替える。
生の `dispatch` は外へ出さない。これで関所が1つになる。

### 6.4 子要素のエディタを作り替える

テキスト要素・画像要素・OMR 設定・文字位置マーカーには action が無く、**親の `data` に配列ごと
乗せて更新している**。

| 箇所                                     | 現在                                    |
| ---------------------------------------- | --------------------------------------- |
| `SubQuestionForm.tsx:369`                | `onUpdate({ textElements: elements })`  |
| `SubQuestionForm.tsx:374`                | `onUpdate({ imageElements: elements })` |
| `SubQuestionForm.tsx:390`                | `onUpdate({ omrConfig: config })`       |
| `BranchQuestionForm.tsx:265,270,275`     | 同様                                    |
| `ManuscriptPaperSettings.tsx:92,102,110` | `charGuides` の配列を作り直して渡す     |

エディタ側の受け渡しを「配列を返す」から「1件の追加・更新・削除・並び替えを通知する」へ変える。

```ts
// 変更前
interface TextElementEditorProps {
  textElements: CellTextElement[]
  onUpdate: (elements: CellTextElement[]) => void
}

// 変更後
interface TextElementEditorProps {
  textElements: CellTextElement[]
  onAdd: (textElement: CellTextElement) => void
  onUpdate: (
    textElementId: string,
    data: Partial<AsbTextElementAttributes>
  ) => void
  onDelete: (textElementId: string) => void
  onReorder: (orderedIds: string[]) => void
}
```

`ImageElementEditor` / `ManuscriptPaperSettings`（`charGuides` 部）も同形。OMR 設定フォームは
upsert / delete の2つ。

**分割作業の重心はここにある。** IPC を足すこと自体より、この4つのエディタと呼び出し側
（`SubQuestionForm` / `BranchQuestionForm`）の受け渡し変更の方が量が多い。

### 6.5 書き込みの関所と網羅 switch

包んだ dispatch は、action を書き込みへ写して実行する。

```ts
// useAnswerSheetDefinition.ts
const dispatch = useCallback((action: AnswerSheetAction) => {
  rawDispatch(action)
  void persist(action, definitionRef.current) // 書き込みは非同期・UI は先に進む
}, [])
```

`persist` は action を網羅する switch を持ち、`default` で `assertNever(action)` を呼ぶ。

```ts
function assertNever(value: never): never {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`)
}
```

**action を足して書き込みを書かなければビルドが通らない。** action と書き込みを二重に持つ設計の
唯一の危険は「片方に足して片方に足し忘れる」ことで、これは同期除外リストで既に2回破れている
（`AsbCharGuide` は #913、`AsbDefinitionTag` はタグ対応）。ここは型で止める。

`assertNever` は既存が無ければ `src/lib/assertNever.ts` に置く。

### 6.6 undo / redo

undo / redo は「文書全体の過去の姿」を復元する操作で、対応する意図が存在しない。
`asb:replace-definition`（§4.5）へ流す。バルク経路も §5.4 で差分適用になるため、undo が全行を
touch することはない。

undo / redo は ASB のみの機能で、`INPUT` / `TEXTAREA` にフォーカス中はブラウザ標準を優先して
スキップする（`useUndoRedoShortcuts.ts`）。テキスト欄で編集中の Ctrl+Z はこの履歴に届かない。
**この挙動は本計画では変えない。**

### 6.7 書き込みの失敗・デバウンス・保存状態表示

**失敗時**: 定義を DB から読み直して UI を合わせ（DB を正とする）、toast で知らせる。現在は
toast だけで UI が DB より先へ進んだままになるが、書き込みが細かくなるぶんズレが積み上がりやすい。

**デバウンス**: テキスト欄は1打鍵ごとに action が飛ぶ。reducer は履歴を300msでまとめている
（`useUndoableReducer.ts:19`）ので、**書き込みも同じ窓でまとめる**。まとめる単位は
「同じ action type かつ同じ対象 id」。

**保存状態表示**: `useSaveStatus` の `showSaving` / `showSaved` は関所で呼ぶ。デバウンス窓の
最初で `showSaving`、最後の書き込み完了で `showSaved`。

### 6.8 開くだけで保存を止める

「DB に入っている状態」を ref で持ち、`definition` が参照として一致するなら書き込まない。
読み込み直後と書き込み成功時に ref を更新する。undo で読み込み時と同一参照へ戻る場合も、ref は
最後に書き込んだ状態なので書き込みが走り、正しく巻き戻せる。

§6.1〜6.5 が済めば「編集していないのに書き込みが起きる」経路自体が無くなるため、この ref は
バルク経路（undo / redo）の抑止だけに縮む。ただし**段階1の時点では自動保存 effect が残っている
ので、この ref が唯一の防波堤になる**。

---

## 7. 段階

**§3.4 のとおり、共有はまだ成立していない**（所有者以外の一覧に出ない）。したがって:

- 段階1〜3 … 単独利用でも起きている実害なので、所有者システムを待たずに進める
- 所有者システム（#1127、[docs/ownership-and-sharing-design.md](./ownership-and-sharing-design.md)）
  … 同書の段階4（一覧の絞り込みとロール判定）が入って初めて共有が成立する
- 段階4〜5 … 共有が成立してから効く。作りは段階1〜3から自然に繋がるので前倒ししてよいが、**急ぐ理由は無い**

| 段階 | 内容                                                          | ここで直るもの                                          |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | main を実体ごとの書き込み関数へ分解し、バルクを差分適用にする | タグ消失・`createdAt` リセット・tombstone・開くだけ保存 |
| 2    | 型の分解と action の id 化、`generateId` の uuid 化           | 添字の境界越え・id 衝突                                 |
| 3    | 子要素の action とエディタの受け渡しを作り替える              | 子コレクションの全置換                                  |
| 4    | IPC を31本へ割り、包んだ dispatch から呼ぶ。網羅 switch       | 他端末の編集の巻き戻し                                  |
| 5    | バルクを `asb:replace-definition` へ改名し3経路に限定         | 通常編集がバルクへ流れ込む再発                          |

### 7.1 段階1 — main の分解とバルクの差分適用

**変更**: `asbDefinition.ts` / 新規5ファイル / `asbDefinitionReplace.ts` /
`asbDefinitionTag.ts`（§8.2）/ `AnswerSheetBuilderMainView.tsx`（§6.8 の ref のみ）

**手順**

1. §5.2 の関数群を新規ファイルへ書く。中身は現行 `saveAsbDefinition` の各ブロックを、
   `create` から `upsert` へ変えて移す
2. `replaceAsbDefinition` を §5.4 の形で書き、`saveAsbDefinition` を置き換える
   （チャンネル名はまだ `asb:save-definition` のまま）
3. `AnswerSheetBuilderMainView.tsx` に §6.8 の ref を入れ、開くだけの保存を止める
4. `setAsbDefinitionTags` を upsert 差分へ（§8.2）

**完了条件**

- タグを付けた定義を編集画面で開いて閉じても、タグが残る
- `createdAt` が保存で変わらない
- 変更のない行の `updatedAt` が動かない

**IPC はまだ1本のまま。** この段階では利用者から見える挙動の修正だけが入る。

### 7.2 段階2 — 型の分解と action の id 化

**変更**: `src/types/answerSheetDefinition.types.ts` / `constants.ts` /
`useAnswerSheetDefinition.ts` / 各フォーム（コールバックの引数が添字から id になる）

**手順**

1. §5.3 の `*Attributes` 分解を型に施す。既存の `SubQuestion` 等は `extends` で組み直すので、
   利用側の型エラーは出ない
2. §6.1 の action ユニオンへ書き換え、reducer を id 検索ベースにする
3. `createDefault*` の呼び出しを reducer から**呼び出し側（フック）へ移す**。フックが実体を作り、
   action に載せる
4. `generateId()` を `crypto.randomUUID()` へ
5. フックのコールバック引数を添字から id へ変え、各フォームの呼び出しを直す

**完了条件**: 型検査が通り、既存の編集操作が従来どおり動く（保存経路はまだ1本）

### 7.3 段階3 — 子要素の action 化

**変更**: `TextElementEditor.tsx` / `ImageElementEditor.tsx` / `ManuscriptPaperSettings.tsx` /
OMR 設定フォーム / `SubQuestionForm.tsx` / `BranchQuestionForm.tsx` / action ユニオン / reducer

**手順**

1. §6.4 のとおりエディタの props を分解する
2. `SubQuestionForm` / `BranchQuestionForm` から、親の `onUpdate` 経由をやめて子の action を直接呼ぶ
3. reducer に子の action を実装する

**完了条件**: `UPDATE_SUB_QUESTION` の payload に子コレクションが一切現れない

### 7.4 段階4 — IPC の分割

**変更**: `answerSheetBuilderHandlers.ts` / `answerSheetBuilderApi.ts` /
`useAnswerSheetDefinition.ts` /
`usePreviewDragInteraction.ts` / `AnswerSheetPreview.tsx`

**手順**

1. §4.1 の31本を登録する。ハンドラは §5.2 の関数を呼ぶだけ
2. preload と型定義を揃える
3. §6.5 の関所（包んだ dispatch + 網羅 switch + `assertNever`）を書く
4. §6.3 のとおり生 `dispatch` を外へ出すのをやめる
5. `AnswerSheetBuilderMainView.tsx` の自動保存 effect を撤去する（書き込みは関所が行う）
6. §6.7 のデバウンス・失敗時処理・保存状態表示を入れる

**完了条件**

- 自動保存 effect が無い
- `AnswerSheetPreview` が `dispatch` を受け取らない
- action を1つ足すと、書き込みを書くまでビルドが落ちる

### 7.5 段階5 — バルクの限定と改名

**変更**: `answerSheetBuilderHandlers.ts` / `answerSheetBuilderApi.ts` / 型定義 /
`dataCreator.ts` / `useAnswerSheetDefinition.ts`（undo / redo）

**手順**

1. `asb:save-definition` を `asb:replace-definition` へ改名する
2. 呼び出し元を undo / redo・複製・アーカイブ取り込みの3つに限定する
3. ハンドラのコメントに「日常の編集をここへ流さない」理由を残す

---

## 8. 付随して直すもの

### 8.1 OMR 設定・選択肢の id が往復しない

renderer の `OMRCellConfig` に id が無く、`asbDefinitionConverters.ts:566` が保存のたびに
`crypto.randomUUID()` を振り直す。id が往復する子としない子が混在している。

| 子                                                                                                         | id の往復 |
| ---------------------------------------------------------------------------------------------------------- | --------- |
| headerFields / majorQuestions / subQuestions / branchQuestions / charGuides / textElements / imageElements | あり      |
| **omrConfig / omrChoiceOptions**                                                                           | **なし**  |

**本計画の範囲では複合 unique を鍵にすれば足りる**（§4.4）。移行は不要。

2端末が同じ小問に OMR を作ると id 違い・unique 同値の行ができるが、これは sqlite-nas-sync が
LWW で1行へ収束させる（#1128 のコメント参照）。**id を決定論的にする必要はない。**

残る問題は id が往復しないことそのもので、更新が実質「削除＋新規作成」になり毎回 changelog と
tombstone が動く。ただし `saveAsbDefinition`（`asbDefinition.ts:161`）が保存のたびに定義ごと
`deleteMany` してから作り直しているため、**churn は OMR に限らず定義全体で起きている**。
renderer が id を持つ子は同じ id で作り直されるので値としては往復するが、行としては毎回
削除→再作成である。**本計画の段階1（IPC 分割）で、定義全体を upsert 差分書き込みへ変えるときに
まとめて解消する。** `OMRCellConfig` に id を持たせるのはその一部。

### 8.2 `setAsbDefinitionTags` も delete → recreate

`electron-src/lib/prisma/asbDefinitionTag.ts:48` が `deleteMany` → `createMany`。同期対象テーブルへの
delete → recreate で、id も uuid 再生成。#1126 の tombstone の罠に該当する。

**段階1で upsert 差分へ変える。** id は uuidv4 のままでよく、鍵は `@@unique` にする
（#1128 の決定論的 id 化は撤回された）。

### 8.3 既存行のバックフィル

`sqlite-nas-sync` の `setupChangelog` はトリガーを張るだけで既存行を流さない。フルマージは
`hasChangelogGap` 検出時のみで、`lastSeenId === 0` では `false` を返す
（`~/dev/sqlite-nas-sync/src/changelog.ts:60`）。

現状で実害が小さいのは「開くだけで保存が走る」ために既存定義が結果的に流れているからで、
**§6.8 でそれを止めると、この偶然の伝搬経路も消える。**

対策: 同期設定の初期化後に一度だけ `UPDATE Asb... SET id = id` を流す。生 SQL なので Prisma の
`@updatedAt` は動かず、`updatedAt` を書き換えないまま UPDATE トリガーだけ発火する。LWW は行本来の
`updatedAt` で判定される。

**着手は所有者システム（#1127）の後でよい**（§7 の優先度）。それまで相手端末に届いても見えない。

### 8.4 `AsbDefinition.userId` を更新時に書き換えている

`asbDefinition.ts:173` が保存のたびに保存者を所有者にしている。共有すると「他の教員が開いただけで
所有者が移る」ことになる。delete → recreate の副産物か意図的な仕様か判断がつかない。

**段階1では現行挙動を保つ**（upsert の `update` にも `userId` を含める）。

行き先は決まっている（[docs/ownership-and-sharing-design.md](./ownership-and-sharing-design.md) §4.4）。
**`userId` は列名も `onDelete: Cascade` も変えず、作成者の記録として残す。** ロール判定は
メンバー表（`AsbDefinitionMember`）が持つ。したがって**保存時の書き換えはメンバー表が入った時点で
やめる**（作成者は作成時に決まり、以後変わらない）。

---

## 9. テスト計画

`__tests__/answer-sheet-builder/charGuideRoundTrip.test.ts` が `saveAsbDefinition` をテスト用
クライアントで叩く形を持っているので、書き込み関数のテストはこれに倣う。

| 段階 | 対象                   | 見るもの                                                          |
| ---- | ---------------------- | ----------------------------------------------------------------- |
| 1    | `replaceAsbDefinition` | **タグ紐付けが残る**（現行バグの回帰テスト）                      |
| 1    | `replaceAsbDefinition` | `createdAt` が変わらない                                          |
| 1    | `replaceAsbDefinition` | 変更のない行の `updatedAt` が動かない                             |
| 1    | 各書き込み関数         | 作成・更新・削除・並び替えが対象行だけを変える                    |
| 1    | delete                 | 削除後に `order` の穴が無い（0..n-1 に詰まる）                    |
| 1    | `setAsbDefinitionTags` | 据え置くタグの行 id が変わらない                                  |
| 2    | `generateId`           | uuid 形式である                                                   |
| 2    | reducer                | id 指定の更新・削除が正しい実体に当たる（添字ではなく）           |
| 3    | reducer                | 子要素の追加・削除が親の他の子に影響しない                        |
| 4    | 網羅 switch            | action を足して書き込みを書かないと**型エラーになる**（型テスト） |
| 4    | 関所                   | プレビューのドラッグでも書き込みが飛ぶ                            |
| 4    | デバウンス             | 連続打鍵が1回の書き込みにまとまる                                 |
| 8.1  | OMR                    | 保存を繰り返しても `AsbOmrConfig.id` が変わらない                 |

**ガードは外すと実際に落ちることを確認してから採用する。**

---

## 10. 判断が要る点

| 論点                      | 状況                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `userId`（所有権）        | **決着済み。** §8.4。段階1では現行挙動を保ち、メンバー表が入った時点で書き換えをやめる                |
| 一覧の絞り込みが3種類ある | §3.4。`ownership-and-sharing-design.md` §2.1 で整理済み。揃え方は同書 §6                              |
| 分割の粒度（31本）        | 成績算出49・試験外成績資料27・採点領域22と同水準。`reorder` を `update` へ畳めば7本減るが先例に反する |
| 段階4〜5 の着手時期       | 共有が成立する（#1127 が入る）まで効かない。作りの連続性を優先するなら前倒しでもよい                  |

---

## 11. やらないこと

- **undo / redo の作り替え** — 逆操作（command ベース）への移行はしない。バルク経路で足りる
- **undo / redo の挙動修正** — テキスト欄で効かない件（§6.6）は本計画で扱わない
- **他画面への undo / redo 導入** — ASB のみの機能である状態を変えない
- **所有者システムの設計・実装** — #1127 の担当
- **`AsbDefinition` のフラット列の正規化** — 設定が列としてフラットに並ぶ形は触らない
- **画像ファイルの共有** — DB は同期されるがファイル実体はローカルに残る。別課題（#1052）
- **既存 `asb_` 形式 id の書き換え** — 参照されておらず、変える必要が無い
- **OMR の id 往復** — 定義全体の delete → recreate と一体なので段階1で扱う（§8.1）

---

## 12. 影響ファイル

### main

| ファイル                                                  | 段階 | 変更                             |
| --------------------------------------------------------- | ---- | -------------------------------- |
| `electron-src/lib/prisma/asbDefinition.ts`                | 1    | 分解・更新関数へ                 |
| `electron-src/lib/prisma/asbHeaderField.ts`               | 1    | 新規                             |
| `electron-src/lib/prisma/asbQuestion.ts`                  | 1    | 新規                             |
| `electron-src/lib/prisma/asbCellElement.ts`               | 1    | 新規                             |
| `electron-src/lib/prisma/asbCharGuide.ts`                 | 1    | 新規                             |
| `electron-src/lib/prisma/asbOmrConfig.ts`                 | 1    | 新規（`createOmrConfig` を移動） |
| `electron-src/lib/prisma/asbDefinitionReplace.ts`         | 1    | 新規（バルク）                   |
| `electron-src/lib/prisma/asbDefinitionConverters.ts`      | 1    | OMR 生成部を移動                 |
| `electron-src/lib/prisma/asbDefinitionTag.ts`             | 1    | upsert 差分へ                    |
| `electron-src/ipc-handlers/answerSheetBuilderHandlers.ts` | 4,5  | 31本の登録・改名                 |
| `electron-src/preload-apis/answerSheetBuilderApi.ts`      | 4,5  | 同上                             |
| `electron-src/lib/import/asb-archive/dataCreator.ts`      | 5    | バルク改名の追従                 |

### renderer

| ファイル                                                                          | 段階 | 変更                                      |
| --------------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `src/types/answerSheetDefinition.types.ts`                                        | 2,3  | `*Attributes` 分解・action 書換           |
| `src/lib/assertNever.ts`                                                          | 4    | 新規（既存が無ければ）                    |
| `src/components/answer-sheet-builder/constants.ts`                                | 2    | `generateId` の uuid 化・`createDefault*` |
| `src/components/answer-sheet-builder/hooks/useAnswerSheetDefinition.ts`           | 2,4  | reducer の id 化・関所                    |
| `src/components/answer-sheet-builder/hooks/usePreviewDragInteraction.ts`          | 4    | 生 dispatch の解消                        |
| `src/components/answer-sheet-builder/AnswerSheetBuilderMainView.tsx`              | 1,4  | ref・自動保存 effect の撤去               |
| `src/components/answer-sheet-builder/components/preview/AnswerSheetPreview.tsx`   | 4    | `dispatch` prop の廃止                    |
| `src/components/answer-sheet-builder/components/form/TextElementEditor.tsx`       | 3    | props 分解                                |
| `src/components/answer-sheet-builder/components/form/ImageElementEditor.tsx`      | 3    | props 分解                                |
| `src/components/answer-sheet-builder/components/form/ManuscriptPaperSettings.tsx` | 3    | `charGuides` の受け渡し                   |
| `src/components/answer-sheet-builder/components/form/SubQuestionForm.tsx`         | 2,3  | 添字 → id・子の action                    |
| `src/components/answer-sheet-builder/components/form/BranchQuestionForm.tsx`      | 2,3  | 同上                                      |
| `src/components/answer-sheet-builder/components/form/QuestionListEditor.tsx`      | 2    | 添字 → id                                 |
| `src/components/answer-sheet-builder/components/form/HeaderFieldEditor.tsx`       | 2    | 添字 → id                                 |

---

## 13. 関連

| 文書 / issue                                                              | 関係                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------- |
| [docs/schema-relation-audit.md](./schema-relation-audit.md) §6.1          | 発端。Asb 系を同期対象にした作業                          |
| [docs/ownership-and-sharing-design.md](./ownership-and-sharing-design.md) | 所有と共有（#1127）。段階4〜5 の前提                      |
| [docs/coding-style.md](./coding-style.md) 「IPC の粒度」                  | 本計画から起こした規約                                    |
| #1126                                                                     | 本計画の元になった issue                                  |
| #1127                                                                     | 所有と共有の設計。段階4〜5 の前提                         |
| #1128                                                                     | 決定論的 id は撤回。競合解決は sqlite-nas-sync 側（§8.1） |
| #1052                                                                     | 画像ファイルの共有                                        |

---

## 更新履歴

| 日付       | 内容                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| 2026-08-02 | 初版。#1126 の調査から IPC 分割の計画として起こす                                              |
| 2026-08-02 | 実装計画として完成。所有者未整備による優先度の見直し・型分解・関数シグネチャ・段階別手順を追加 |
| 2026-08-03 | §3.4 の「main はログイン中のユーザーを知らない」を訂正。所有と共有の設計文書へリンク           |
