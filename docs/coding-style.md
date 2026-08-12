# コーディングスタイルガイド

このドキュメントは、Score at Once 試験のコード規約と設計方針をまとめたものです。

## 目次

1. [フォーマッター・リンター](#フォーマッターリンター)
2. [ファイル命名規則](#ファイル命名規則)
3. [命名規則](#命名規則)
4. [不要なコードの削除](#不要なコードの削除)
5. [ディレクトリ構造方針](#ディレクトリ構造方針)
6. [型管理の方針](#型管理の方針)
7. [ファイル分割基準](#ファイル分割基準)
8. [コンポーネント設計原則](#コンポーネント設計原則)
9. [import文の書き方](#import文の書き方)
10. [コメント規約](#コメント規約)

> コンポーネント設計原則の中に「[effect の使いどころ](#effect-の使いどころ厳守)」と
> 「[データ取得は `useQuery`](#データ取得は-usequery厳守)」がある。effect を書く前と、
> `react-hooks/set-state-in-effect` の警告を直す前に読むこと。

---

## フォーマッター・リンター

### 基本ルール

コードは **ESLint** と **Prettier** の設定に従うこと。

```bash
# チェック
npm run lint        # ESLint + Prettier チェック

# 自動修正
npm run lint:fix    # ESLint --fix + Prettier --write
npm run format      # Prettier --write のみ
```

### VSCode 設定

`.vscode/settings.json` で以下が設定済み：

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never" // ESLintに統一、競合回避
  },
  "editor.formatOnSave": true
}
```

> **Note**: `source.organizeImports`（TypeScript language server）と ESLint の simple-import-sort は異なるソート順を使うため、**ESLint に統一**している。VSCode の Option+Shift+O は使わず、保存時の ESLint auto-fix を使用すること。

### Import ソート

**eslint-plugin-simple-import-sort** を使用。保存時に自動実行される。

```bash
npm run lint:fix    # 手動でも実行可能
```

> **Warning**: VSCode の Option+Shift+O（Organize Imports）は別のソート順になるため**使用禁止**。

### Tailwind CSS v4 マイグレーション

Tailwind CSS v4 ではクラス名が変更されたものがある（例: `bg-gradient-to-br` → `bg-linear-to-br`）。

**公式マイグレーションツール**で一括変換：

```bash
npx @tailwindcss/upgrade --force
```

> **Note**: eslint-plugin-tailwindcss は現時点で v4 未対応のため、ESLint での自動検出はできない。VSCode の Tailwind CSS IntelliSense が警告を出すので、その際にマイグレーションツールを実行すること。

---

## ファイル命名規則

| 拡張子 | 規則       | 例                                        |
| ------ | ---------- | ----------------------------------------- |
| `.tsx` | PascalCase | `ActionButton.tsx`, `ScoringMainView.tsx` |
| `.ts`  | camelCase  | `useExam.ts`, `dataFetcher.ts`            |

### 例外

- **Next.js規約ファイル**: `page.tsx`, `layout.tsx`, `error.tsx` など
- **shadcn/ui コンポーネント**: `button.tsx`, `dialog.tsx` など（ライブラリ規約に従う）

---

## 命名規則

### 基本原則

- **関数名・変数名・引数名・返り値の型名は、その役割を正確に表す名前にする**
- **略語は避け、意味が明確な名前を使う**

### 命名の具体例

```typescript
// ✅ 良い例: 役割が明確
const studentCount = students.length
const isLoading = status === "loading"
function calculateTotalScore(scores: number[]): number

// ❌ 悪い例: 意味が不明確
const cnt = students.length
const flag = status === "loading"
function calc(arr: number[]): number
```

### 関数名

| 接頭辞               | 用途               | 例                                    |
| -------------------- | ------------------ | ------------------------------------- |
| `get`                | 値を取得           | `getStudentById`, `getExamList`       |
| `set`                | 値を設定           | `setCurrentPage`, `setFilter`         |
| `is` / `has` / `can` | 真偽値を返す       | `isValid`, `hasPermission`, `canEdit` |
| `create`             | 新規作成           | `createExam`, `createStudent`         |
| `update`             | 更新               | `updateScore`, `updateStatus`         |
| `delete` / `remove`  | 削除               | `deleteExam`, `removeStudent`         |
| `handle`             | イベントハンドラ   | `handleClick`, `handleSubmit`         |
| `fetch`              | 非同期でデータ取得 | `fetchExams`, `fetchUserData`         |

### 変数名

```typescript
// 配列: 複数形
const students: Student[] = []
const cropRegions: CropRegion[] = []

// 真偽値: is/has/can/should で始める
const isVisible = true
const hasError = false
const canSubmit = formValid && !isLoading

// カウント: xxxCount
const studentCount = students.length
const errorCount = errors.length
```

### 実体名の原則（引数・ローカル変数）

**その実体が何かを名前で言う。** 短縮（`u`）も濁り（`value`/`data`/`item`）も「命名の放棄」。変数の解像度は型の解像度を超えられない ── 濁った変数名は濁った型名（`Data`/`Info`/`Item`）の影であり、直すなら型名が先。ただし濁り名が許されるのは下表 A の例外（真のジェネリック・外部ライブラリ規約）の場合のみ。

配列の高階関数・`for...of` の要素は、要素の型に対応するフル実体名にする。

```typescript
// ✅ 要素の型を名前で言う
students.map((student) => student.id)
classrooms.find((classroom) => classroom.id === id)
cropRegions.filter((cropRegion) => cropRegion.points > 0)

// ❌ 1文字・濁った略語
students.map((s) => s.id)
classrooms.find((c) => ...)
cropRegions.filter((cr) => cr.points > 0)
```

予約語 `class` の回避で短縮しない。意味語を足す（`cls`/`clazz` ではなく `classroom`、CSS は `className`）。

**索引より高階関数を原則とする。** 生の索引 `for (let i = ...)` ループを避け、`map`/`filter`/`reduce`/`forEach` 等で表現する。`i` が許されるのは高階関数で自然に書けない場合の最終手段。

#### 慣例として残してよい名前

| 分類      | 名前                                            | 範囲                                                                                                                                                   |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A（基本） | `i`                                             | 裸のループカウンタ（**最終手段**。上記の高階関数原則が優先）                                                                                           |
| A         | `e`                                             | イベント引数（`e.target.value`）／catch のエラー                                                                                                       |
| A         | `<T>`/`<K>`/`<V>` 等                            | 真のジェネリック型パラメータ                                                                                                                           |
| A         | `value`/`data`/`x`                              | 真のジェネリック（`<T>(value: T)`）or 外部ライブラリ規約（axios `response.data`、React Query `{ data }`、shadcn/Radix `onValueChange={(value) => …}`） |
| B（拡張） | `prev`                                          | React `setState((prev) => …)` の前状態                                                                                                                 |
| B         | `acc`                                           | `reduce` のアキュムレータ                                                                                                                              |
| B         | `tx`                                            | Prisma `$transaction` クライアント                                                                                                                     |
| B         | `db` / `fs` / `fd`                              | database ハンドル／file system モジュール／file descriptor                                                                                             |
| B         | `x`/`y`/`w`/`h`, `dx`/`dy`, `rx`/`ry`/`rw`/`rh` | 幾何・矩形の座標／寸法／デルタ（数学的表記）                                                                                                           |

**外部ライブラリ規約のコールバックは `value` を使う**: `onValueChange={(value) => …}`（shadcn/Radix の多数派に従う。1文字 `v` は避けて `value` と綴る）。**実体名化する対象**: 実体要素の `s`/`c`/`m`/`cr`/`sg` → `student`/`classroom`/`membership`/`cropRegion`/`subtotalGroup`。

#### id ではなく実体を持つ原則（`xxxIds` の扱い）

**id を保持してよいのは、id そのものが目的の場合に限る。** 次の 4 用途のみ正当:

1. **選択・所属の判定** — UI の選択状態（`selectedStudentIds`）。意味論が「集合・重複なし・所属判定」なら `string[]` より `Set<string>` を優先する。
2. **並べ替えの順序** — reorder ペイロード（`orderedIds`）。順序そのものが payload。
3. **関連付けの設定** — `setExamTags(examId, tagIds)` のような関連の張り替え。
4. **IPC／シリアライズ境界の通過** — レンダラ→main へ id を渡し、DB を持つ main 側で取得する（実体を境界越しに運ばない）。

**downstream で実体のフィールドが要るなら、最初から実体を持つ。** 判定テスト:

> `.find((x) => x.id === id)` や id 指定 fetch で、前段が既に持っていた（or 持つべき）実体を作り直していないか？

作り直しているなら、その前段が実体を保持すべきだったサイン。特に **実体を `.map((e) => e.id)` で id 配列に潰した直後に DB／API を叩いて同じ実体を取り直す**のは冗長往復で禁止。

```typescript
// ❌ 実体を id に潰し、あとで DB/API から取り直す（冗長往復）
const studentIds = students.map((student) => student.id)
const reloaded = await api.getStudentsByIds(studentIds) // students は既に手元にある

// ❌ id 配列を .find のループで実体へ引き直す（O(n·m) の再構築）
const rows = visibleIds.map((id) => allRows.find((row) => row.id === id))

// ✅ 実体をそのまま持つ／どうしても id state なら Map で一括引き（順序保持・O(n)）
const rowById = new Map(allRows.map((row) => [row.id, row]))
const rows = visibleIds.map((id) => rowById.get(id)).filter(Boolean)
```

**例外**: 外部ライブラリが id 文字列を渡してくる場合（dnd-kit の `active.id: string` から行を引く等）は規約に従い `.find` で可。

---

## 不要なコードの削除

### 原則

**使われていないコードは削除する。コメントアウトして残さない。**

### 削除対象

- **未使用の変数・引数・関数**: ESLint が警告するもの
- **コメントアウトされたコード**: Git履歴で復元可能
- **デッドコード**: 到達不可能なコード
- **不要な型定義**: 使われていない interface / type

```typescript
// ❌ 悪い例: 未使用の引数を残す
function processData(data: Data, _unusedOption: string) {
  return data.value
}

// ✅ 良い例: 不要なら削除
function processData(data: Data) {
  return data.value
}

// ❌ 悪い例: コメントアウトを残す
// const oldImplementation = () => { ... }
const newImplementation = () => { ... }

// ✅ 良い例: 削除（Git履歴で復元可能）
const newImplementation = () => { ... }
```

### ESLint による検出

```bash
# 未使用変数・引数の検出
npm run lint
```

> **Note**: ESLint の `@typescript-eslint/no-unused-vars` ルールで検出。`_` で始まる変数は許可されているが、必要ない場合は削除を優先。

---

## ディレクトリ構造方針

本試験では **階層別住み分け方式** を採用しています。

### トップレベル配置（`/hooks`, `/types`, `/lib`）

**対象**: 試験全体で共有される要素

**配置基準**:

- ✅ 3つ以上の機能・画面で使用される
- ✅ 試験の根幹となる型・ロジック
- ✅ 外部ライブラリとのインターフェース
- ✅ 汎用的なユーティリティ関数

```
/hooks/useExam.ts       // 複数画面で使用される試験管理
/types/scoringStatus.types.ts  // ScoringStatus など renderer/electron 横断の共通型
/lib/utils.ts              // 日付フォーマット、バリデーション等の汎用関数
```

### 機能内配置（`/components/exams/06-answer-sheets/hooks` 等）

**対象**: 特定機能専用の要素

**配置基準**:

- ✅ その機能でのみ使用される
- ✅ 機能特有のビジネスロジック
- ✅ 機能専用の型定義・ユーティリティ
- ✅ 他機能では再利用されない

```typescript
// 機能内配置の例
/components/exams/06-answer-sheets/
├── hooks/useAnswerSheetUpload.ts     // 答案アップロード専用ロジック
├── types.ts                          // PendingChange 等の機能内共有型
└── utils/file-processing.ts          // ファイル変換・検証の専用関数
```

### 判断フロー

```
新しいhook・type・utilを作成する
    ↓
他の機能でも使う可能性は？ → Yes → トップレベル
    ↓ No
この機能でのみ使用する？ → Yes → 機能内
```

---

## 型管理の方針

### データ型の優先順位

データに関する型は以下の優先順位で選択する。**上位を使えるなら上位を使う。**

| 優先度 | 型の種類           | 説明                                           | 例                                                             |
| :----: | ------------------ | ---------------------------------------------- | -------------------------------------------------------------- |
|   1    | **Prisma型**       | `@prisma/client` が生成する基本型              | `Student`, `Exam`, `CropRegion`                                |
|   2    | **Prisma拡張型**   | `include` 等で生まれるペイロード型             | `Prisma.StudentGetPayload<{ include: { memberships: true } }>` |
|   3    | **シリアライズ型** | Decimal→number等、やむを得ず一部を再定義する型 | `SerializedQuestionScore`                                      |
|   4    | **独自定義型**     | 上記で対応できない場合のみ                     | UI専用の中間状態など                                           |

### 独自定義型を使ってよい条件

データに関する型を独自定義してよいのは、以下のケースのみ：

- **a. DBに保存しないデータ**: UI状態、フォーム入力値、一時的な計算結果など
- **b. 技術的制約がある場合**: パフォーマンス低下、見通しの悪化、DBに存在しないが必須のフィールドなど

```typescript
// ✅ OK: DBに保存しないUI状態
interface ScoringUIState {
  selectedRegionId: string | null
  isKeyboardMode: boolean
}

// ✅ OK: Prisma拡張型を使用
type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: { memberships: { include: { class: true } } }
}>

// ❌ NG: Prisma型で十分なのに独自定義
interface StudentData {
  id: string
  name: string
  // ...Prisma型と同じフィールドを再定義
}
```

### 独自型を制限する目的（なぜ上位を優先するか）

独自型の制限が守っているのは **DB への書き込み整合性** である。独自型で DB と異なる「特殊なデータ構造」をコンポーネント／IPC 間で運ぶと、それを DB に書き戻す（永続化する）ときに破綻する。逆に言えば、**DB に永続化しない経路は型制限の対象外**：

- **ファイル書き出し（Excel / PDF 等）**: DB に反映しない read-out。フックで得たデータを出力に必要な形へ整えて main 側へ渡してよい。ただし「好きな型」ではなく **必要な型**（変な型の乱立を防ぐ）。
- **フィルタ機能・DB 非保存の UI / DnD 状態**: 同様に carve-out（上記 a と同義）。ただし DB をミラーした view-model をこの名目で温存しない（それは下記のフックで解く）。

### DB 由来データを計算した値の扱い

DB で管理されるデータを **計算した値** を使いたい場合：

1. **原則そのコンポーネント内で計算する**。renderer にデータが揃っていれば再フェッチにはならない（禁止なのは「データ不足で再クエリ／再フェッチ」する方）。main 側で特殊な計算をして専用 IPC を生やさない。
2. 計算ロジックが長く別ファイルに出したい → **型を宣言せず引数で渡す**か **フックを定義**する。
3. **複数箇所で同じ計算値を使う → 共通フックを作って共有する**。フックの返り値「全体」に名前は付けない（推論／`ReturnType`）。名前を付けるのは複数箇所で共有する“データの形”のみ。
4. 新機能開発時は既存フックのロジックが適切か検証し、既存を変更するか新規に作るかを吟味する。

> 独自型を不必要に宣言すると、その裏に **重複ロジック・デッドコード・再クエリ・変更未追従** が生まれる。シンプルにデータを渡し、共通のデータ構造（Prisma 拡張型）を使うのが大規模コードベースの原則。

### Decimal 型・リテラル型の「適切な対応」（型注入）

Prisma 型のうち renderer で扱いにくい一部（Decimal、SQLite に enum が無いための `String` 列）は、**独自型を作らず「型注入」で上書き**する。共通形は `Omit<PrismaModel, "field"> & { field: 補正型 }` ＋ **境界で1回だけ変換**。

- **Decimal → number**: 型は `types/prismaExtensions.ts` に集約（例 `SerializedQuestionScore = Omit<QuestionScore, "partialScore"> & { partialScore: number | null }`）。実行時は境界で `decimal.toNumber()`。理由: Prisma の Decimal（decimal.js）は IPC で壊れ renderer で扱いにくい。
- **string → literal union**: SSOT を 1 ファイルに（`ScoringStatus` / `ExamStudentStatus` が前例）。`const XS = [...] as const` → `type X = (typeof XS)[number]`（1 配列から union 導出）＋型ガード `isX` ＋境界コンバータ `toX(s): X`（想定外は安全な既定へ）。型は `Omit<PrismaModel, "status"> & { status: X }`、実行時は境界で `toX(row.status)`。union をあちこち手書きしない。

`Omit` は「上書き（Decimal / union）・機密除去（`password` 等）」に使う。禁止するのは「表示のために小さくする縮小 `Pick`」の独自 view の方。

### 禁止事項

- **`any` の使用**: 原則禁止（ESLint で warn として検出）。どうしても必要な場合は `unknown` + 型ガードを検討
- **`as` の乱用**: 型ガードで解決できる場合は型ガードを使う
- **Prisma型の不要な再定義**: `Student` 型があるのに同等の `StudentData` を作らない

### IPC の粒度（厳守）

**IPC は意図を運ぶ。状態を運ばない。**

- **意図** — 「この小問の配点を3にした」。書き込み先はその1行に限定される
- **状態** — 「これが今の全体像です、合わせてください」。**利用者が触っていない行まで含めて全体の権威を主張する**

DB は NAS 共有され複数端末が同時に書く。状態を運ぶ IPC は、他端末が直した行まで自分の手元の
（古いかもしれない）値で上書きするため、**LWW の下で他人の編集を黙って巻き戻す**。

したがって編集内容を書き換える IPC は、**実体ごと・操作ごとに割る**。既存の粒度:

| 機能                    | ハンドラ                | チャンネル数 |
| ----------------------- | ----------------------- | ------------ |
| 成績算出                | `gradeHandlers.ts`      | 49           |
| 試験外成績資料          | `courseworkHandlers.ts` | 27           |
| 採点領域（02-template） | `cropRegionHandlers.ts` | 22           |

**例外（状態を運んでよい経路）**: undo / redo・複製・アーカイブ取り込み。これらは本当に
「この姿にしろ」という一括操作なので、文書丸ごとを運ぶのが正しい。名前で一括操作と分かるようにし
（`replace-*`）、日常の編集がそこへ流れ込まないようにする。

**アンチパターン**: 解答用紙作成（`asb:save-definition`）が定義ツリー全体を1本で受け取り、
delete → recreate していた。編集画面を開くだけで保存が走るためタグ紐付けが消え、`createdAt` が
毎回リセットされ、同期先の定義が復活しない経路があった。分割の計画は
[docs/asb-ipc-split-plan.md](./asb-ipc-split-plan.md)。

**割るときの注意**: action と書き込みを二重に持つことになるので、書き込み側の switch を網羅にして
`default` で `assertNever(action)` を置く。片方に足して片方に足し忘れると**その操作だけ黙って
保存されない**。「一覧に書き足す運用」に依存する設計は、この試験では既に破れている実績がある
（同期除外リストで2回）。

### IPC の失敗の伝え方（厳守）

**失敗は例外で伝える。予期される結果は値で返す。**

キャンセル・未検出・空は失敗ではない。保存ダイアログを閉じたことを例外にしない。これらは
payload の一部として素直に返す（`null` / `{ canceled: true }` 等）。

`{ success, error }` のエンベロープは、**IPC の境界と preload の間だけで使う搬送形式**である。
プロセスをまたぐと例外がそのままでは渡らないため、境界で値へ詰め替え、preload で例外へ戻す。

| 層                           | 扱うもの                                                     |
| ---------------------------- | ------------------------------------------------------------ |
| main の `lib/`               | payload を返す。失敗は `throw`                               |
| 境界（ハンドラ登録ラッパー） | 例外を捕まえてエンベロープへ詰める。`serializePrisma` もここ |
| preload の `invoke`          | エンベロープをほどく。失敗は `throw`                         |
| renderer                     | payload を受け取る。失敗は reject                            |

**エンベロープを宣言する場所は1つ、消費する場所は1つ。** 両端の型からは見えない。

### renderer 側で IPC 契約を宣言しない（厳守）

チャンネルの引数と戻り値は **main の登録簿（`electron-src/ipc-handlers/index.ts` の
`Handlers`）から導く**。renderer 側に手書きの署名を置かない。

- preload の1メソッド = `bind("channel")`。引数を素通しするだけなら型を書かない
- 引数の並び替え・既定値の補完が要るときだけアロー関数で書く（型は `invoke` から付く）
- `window.electronAPI` の形（`MyAPI`）は preload の `create*Api()` の返り値から合成する

手書きの契約を `.d.ts` に置くと `skipLibCheck: true` の下では**中身が検査されない**。
壊れた import が暗黙の `any` になり、その先の食い違いが全部素通しになる（実例は
[ipc-and-data-fetching-plan.md](./ipc-and-data-fetching-plan.md) 段階5）。

**DB 上 String の union 列は境界で倒す。** 型で union を名乗るだけでは値は絞られない。
lib の返り値で `defineStringUnion` の `to*` を通し、renderer は union として扱う。

```typescript
// ❌ lib が失敗を値で返す（呼び出し側が見落としても型が止めない）
export async function getGrade(id: string) {
  const grade = await prisma.grade.findUnique({ where: { id } })
  if (!grade) return { success: false, error: "成績が見つかりません" }
  return { success: true, grade }
}

// ✅ payload を返し、失敗は投げる
export async function getGrade(id: string): Promise<GradeWithRelations> {
  const grade = await prisma.grade.findUnique({ where: { id }, include: … })
  if (!grade) throw new Error("成績が見つかりません")
  return grade
}
```

**理由**: 値で返す失敗は、呼び出し側が `success` を見なくてもコンパイルが通る。main の内部呼び出し
でも renderer でも、見落としが型で止まらない。例外は握り潰すほうに明示的な記述（`try`）が要るので、
既定が安全側に倒れる。

### IPC通信における型の一貫性（厳守）

Main process（electron-src）と Renderer process（components, hooks）間のIPC通信では、**同一の型定義を参照すること**。

| 型の種類       | 参照元                                                               |
| -------------- | -------------------------------------------------------------------- |
| Prisma基本型   | `@prisma/client` から直接 import                                     |
| Prisma拡張型   | `/types/prismaExtensions.ts` から import                             |
| 共通ドメイン型 | `/types/scoringStatus.types.ts` 等の `/types/*.types.ts` から import |

```typescript
// ✅ OK: Main/Renderer両方で同じ型を参照
// electron-src/ipc-handlers/exam-handlers.ts
import type { ScoringStatus } from "../../src/types/scoringStatus.types"
import type { StudentWithMemberships } from "../../src/types/prismaExtensions"

// components/exams/ExamList.tsx
import type { ScoringStatus } from "@/types/scoringStatus.types"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

// ❌ NG: Main側とRenderer側で別々に型を定義
// electron-src/types/exam.ts
interface ExamData { ... }  // Main独自

// components/types/exam.ts
interface ExamData { ... }  // Renderer独自（微妙に違う可能性）
```

**理由**: IPC通信のデータは Structured Clone で受け渡されるため、型定義が一致していないと実行時エラーや型の不整合が発生する。

**ハンドラの戻り値にエンベロープを書かない。** renderer が見る型はハンドラの戻り値から
導かれるので、`success` / `error` と、それに伴う payload の `?` を書くと呼び出し側全部に
握りが伝播する。失敗は preload が例外へ戻すため、renderer の型には現れない
（「[IPC の失敗の伝え方](#ipc-の失敗の伝え方厳守)」）。

```typescript
// ❌ エンベロープを返す（payload が optional になり、全呼び出し側が握りを書く）
"grade:getById": async (id: string) => {
  const grade = await getGrade(id)
  return grade
    ? { success: true, grade }
    : { success: false, error: "成績が見つかりません" }
}

// ✅ payload を返す（失敗は throw）
"grade:getById": async (id: string) => getGrade(id)
```

### 型定義の配置ルール

| スコープ         | 配置場所                                                                                                    | 例                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 単一ファイル     | ファイル内で宣言                                                                                            | Props型、ローカルな状態型                                 |
| 機能内で共有     | 機能ディレクトリの `types.ts`（フラット単一ファイル。`types/index.ts`・`types/xxxTypes.ts` 形式は使わない） | `components/exams/07-score-at-once/types.ts`              |
| アプリ全体で共有 | `/types/` ディレクトリ                                                                                      | `types/examArchive.types.ts`, `types/prismaExtensions.ts` |

### Prisma拡張型の管理

`include` を使用した拡張型は `/types/prismaExtensions.ts` に集約する。

```typescript
// types/prismaExtensions.ts
import type { Prisma } from "@prisma/client"

// ✅ Prisma.XxxGetPayload を使用
export type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: { class: true }
      where: { endDate: null }
    }
  }
}>

export type CropRegionWithDetails = Prisma.CropRegionGetPayload<{
  include: {
    examPage: { include: { exam: true } }
    questionScores: { include: { student: true; user: true } }
  }
}>
```

### 後方互換性の方針

- **コードベース全体**: 後方互換性のためのエイリアスや deprecated 型は廃止する
- **Importer**: 後方互換性は全て `/electron-src/lib/import/transformers/` 内で処理する

```typescript
// ❌ NG: コードベースに後方互換エイリアスを残す
/** @deprecated Use StudentWithMemberships instead */
export type StudentWithClass = StudentWithMemberships

// ✅ OK: Transformerで旧形式を変換
// V1_2_0_to_V1_3_0.ts
export class V1_2_0_to_V1_3_0 implements VersionTransformer {
  transform(data: ArchiveData): TransformResult {
    // studentId → studentNumber のリネーム処理
  }
}
```

### 判断フロー

```
新しい型を定義する
    ↓
データに関する型？
    ↓ Yes
Prisma型（優先度1）で表現可能？ → Yes → Prisma型を使用
    ↓ No
Prisma拡張型（優先度2）で表現可能？ → Yes → Prisma.XxxGetPayload を使用
    ↓ No
シリアライズ等の技術的制約？ → Yes → 最小限の再定義（優先度3）
    ↓ No
DBに保存しないデータ or どうしても必要？ → Yes → 独自定義（優先度4）
    ↓ No
設計を見直す
```

---

## ファイル分割基準

### 分割対象の基準

| 行数      | 対応           |
| --------- | -------------- |
| 200行未満 | 分割不要       |
| 200行以上 | 分割を検討     |
| 500行以上 | 分割を強く推奨 |

### その他の分割判断基準

- **複数の責任**: 異なる機能が混在している場合
- **再利用性**: コンポーネントやフックが他の場所で使用される可能性
- **可読性**: 1つのファイルが複雑すぎる場合

### 分割後の構造

```
/large-feature/
├── types.ts              # 型定義
├── constants.ts          # 定数定義
├── hooks/                # カスタムフック
│   └── useFeature.ts
├── components/           # UIコンポーネント
│   ├── FeatureHeader.tsx
│   ├── FeatureContent.tsx
│   └── FeatureFooter.tsx
└── page.tsx              # メインページ（100行以下が理想）
```

### 分割の実行手順

1. **型定義の分離**: `types.ts` に型定義を抽出
2. **定数の分離**: `constants.ts` に定数を抽出
3. **ロジックの分離**: `hooks/` にカスタムフックを作成
4. **UIの分離**: `components/` にUIコンポーネントを作成
5. **メインファイルの簡素化**: インポートと組み立てのみに限定

---

## コンポーネント設計原則

### 単一責任の原則

1つのコンポーネントは1つの責任のみを持つ。

```typescript
// ❌ 悪い例: 複数の責任が混在
function UserProfile() {
  // データ取得ロジック
  // フォームバリデーション
  // UI表示
  // 状態管理
}

// ✅ 良い例: 責任を分離
function UserProfile() {
  const { user, isLoading } = useUser()

  if (isLoading) return <LoadingSpinner />
  return <UserProfileView user={user} />
}
```

### コンポーネントの分類

| 種類           | 責務                 | 例                         |
| -------------- | -------------------- | -------------------------- |
| Container      | データ取得・状態管理 | `UserProfileContainer.tsx` |
| Presentational | UI表示のみ           | `UserProfileView.tsx`      |
| Hook           | ロジックの再利用     | `useUser.ts`               |

### Props設計

```typescript
// ✅ 必要最小限のprops
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: "primary" | "secondary"
  disabled?: boolean
}

// ❌ 過剰なprops（避ける）
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: string
  disabled?: boolean
  className?: string
  style?: CSSProperties
  id?: string
  testId?: string
  ariaLabel?: string
  // ...10個以上のオプショナルprops
}
```

### 状態管理の原則

```typescript
// 状態は必要最小限に
// ✅ 派生値は計算で求める
const [items, setItems] = useState<Item[]>([])
const completedCount = items.filter((i) => i.completed).length

// ❌ 派生値を別の状態として持たない
const [items, setItems] = useState<Item[]>([])
const [completedCount, setCompletedCount] = useState(0) // 同期が必要になる
```

### effect の使いどころ（厳守）

effect の用途は2つだけ。

1. **React の state を外部システムへ押し出す** — canvas への描画、DOM の直接操作、`focus()` など
2. **外部システムを購読し、コールバックの中で setState する** — `addEventListener`、各種 Observer など

2 で `addEventListener` のコールバックの中で setState するのは正しい。**effect の本体で setState
するのが問題**である。

effect でやってはいけないもの:

| やりたいこと                       | 正しい手段                   |
| ---------------------------------- | ---------------------------- |
| props/state から値を導く           | レンダー中に計算する         |
| prop が変わったら state をリセット | `key` を渡してマウントし直す |
| ユーザー操作に反応する             | イベントハンドラ             |
| データ取得                         | `useQuery`（次節）           |

#### `react-hooks/set-state-in-effect` が見ているもの

このルールが判定しているのは **setState を含む関数がどこで定義されているか**であって、`await` の
有無ではない。

- effect の**外**で定義した関数（`useCallback` でも素の関数でも）を effect から呼ぶ → 警告
- effect の**中**で定義した関数の中の setState → 追わないので警告は出ない

したがって `await` の後でしか setState しない取得処理も、ローダーを外へ切り出していれば警告になる。
同じ処理を effect の中に書けば警告は出ない。**警告の有無でコードの良し悪しは決まらない。** 判断は
上の表で行う。

このため、effect の中で作った関数へ包み直して警告だけ消すことは**禁止**する。実行時の挙動は
変わらず、痕跡の残らない `eslint-disable` を書いたことになる。

#### 派生に落とす

props→state のミラーリング、開くたびのリセット、読み込み中フラグの先出しは、**結果に「どの入力に
対するものか」を同梱して状態に持ち、表示時に引き直す**形へ置き換える。入力が変われば一致しなく
なるので、リセットの effect が要らなくなる。

```typescript
// ❌ 入力が変わったら状態を作り直す effect
const [data, setData] = useState<T | null>(null)
const [isLoading, setIsLoading] = useState(false)
useEffect(() => {
  if (!enabled) {
    setData(null) // ← 同期 setState
    return
  }
  setIsLoading(true) // ← 同期 setState
  fetchData(examId)
    .then(setData)
    .finally(() => setIsLoading(false))
}, [examId, enabled])

// ✅ 取得結果に入力を同梱し、表示時に引き直す
const [fetched, setFetched] = useState<{ examId: string; data: T } | null>(null)
const isCurrent = fetched?.examId === examId
const data = enabled && isCurrent ? fetched.data : null
const isLoading = enabled && !isCurrent // 読み込み中フラグも派生値
useEffect(() => {
  if (!enabled || isCurrent) return
  fetchData(examId).then((data) => setFetched({ examId, data }))
}, [enabled, isCurrent, examId])
```

同梱するキーは**識別子そのもの**（`examId` 等）か、`useMemo` で作った**安定した参照**にする。
毎レンダー作り直される配列やオブジェクトを比較すると永久に一致せず、取得が止まらない。

> データ取得そのものは `useQuery` へ移すため、上の形が要るのは取得以外の派生に限る。

派生に落とせないものには、ほかに次の受け皿がある。

- **開いている間だけの状態** → ダイアログの中身の子コンポーネントへ移す。Radix は閉じている間
  `DialogContent` / `AlertDialogContent` をマウントしないので、開くたびの初期化は作り直しで済む
- **props をそのまま写していただけの state** → 撤去して制御コンポーネントにする（親が状態を持つ）
- **「選択が消えたら先頭へ寄せる」** → 選択は利用者が選んだものだけを持ち、表示対象は
  `find(...) ?? first ?? null` で引き直す。消えた選択を状態へ書き戻さない

### データ取得は `useQuery`（厳守）（厳守）

**effect でデータを取らない。** 取得は TanStack Query に載せる。

```typescript
const {
  data: grade,
  isLoading,
  error,
} = useQuery({
  queryKey: queryKeys.grade.detail(gradeId),
  queryFn: () => window.electronAPI.grade.getById(gradeId),
})
```

- **`queryKey` は `src/lib/queryKeys.ts` を経由する。** 文字列リテラルを画面側に書かない。同定は
  **id** で行い、順序・表示名・添字を混ぜない。キーは配列の前方一致で無効化されるので、キーの構造が
  そのまま無効化の粒度になる
- **変更後の再取得は `invalidateQueries`。** `loadData()` の手撃ちは禁止。手撃ちは自分の画面しか
  更新せず、同じデータを見ている別の画面が古いまま残る
- **フックが返す名前は `isLoading` / `error`。** ライブラリの名前をそのまま通し、翻訳層を作らない
- **失敗を `console.error` で握り潰さない。** `error` に載せて画面が判断する
- 既定は `refetchOnWindowFocus: false` / `retry: false`（`src/contexts/QueryProvider.tsx`）。IPC は
  ネットワークを跨がないので再試行しても結果は変わらない。窓の復帰で他端末の変更を拾いたい画面だけ、
  その `useQuery` で有効にする

**競合の始末はライブラリが持つ。** 入力が変わって再取得が走ったとき、古い応答が新しい結果を
上書きしない。自前の effect で取ると、この取り消しを1件ずつ手で書くことになり、実際には
ほとんど書かれていなかった。

> **移行中**: `useEffect` から `window.electronAPI` を呼んでいる箇所は未移行。手順は
> [docs/ipc-and-data-fetching-plan.md](./ipc-and-data-fetching-plan.md)。

---

## import文の書き方

### 自動ソート（ESLint）

**eslint-plugin-simple-import-sort** がインポートを自動ソートする。手動でのグループ分けは不要。

```bash
npm run lint:fix    # 保存時も自動実行される
```

ソート後のイメージ：

```typescript
import { useEffect, useState } from "react"

import { clsx } from "clsx"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { useExam } from "@/hooks/useExam"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { FeatureHeader } from "./components/FeatureHeader"
import { useFeature } from "./hooks/useFeature"
import type { FeatureProps } from "./types"
```

> **Note**: グループ間の空行は ESLint が自動挿入する。

### パスの使い分け

| パス種類 | 使用場面                                 |
| -------- | ---------------------------------------- |
| `@/`     | トップレベルモジュール、別機能からの参照 |
| `./`     | 同一機能内の参照                         |
| `../`    | 親ディレクトリへの参照（2階層まで）      |

```typescript
// ✅ トップレベルは絶対パス
import { useExam } from "@/hooks/useExam"

// ✅ 機能内は相対パス
import { useFeature } from "./hooks/useFeature"

// ⚠️ 深い相対パスは避ける
import { something } from "../../../shared/utils" // → @/を使用
```

### type import

型のみをインポートする場合は `type` キーワードを使用。

```typescript
// ✅ 型のみのインポート
import type { ScoringStatus } from "@/types/scoringStatus.types"

// ✅ 値と型の混在
import { useExam } from "@/hooks/useExam"
import type { ScoringStatus } from "@/types/scoringStatus.types"

// または
import { useExam, type ExamData } from "@/hooks/useExam"
```

インライン型 import（`import("./x").Foo` を型注釈に埋め込む書き方）は**禁止**。型の一部でありモジュール解決の走査から漏れるため、knip 等の静的解析が参照を追えず、実際に使われている型を未使用と誤判定する。grep もできない。ESLint（`no-restricted-syntax` の `TSImportType`）で検出する。

### 名前空間 import（`import * as`）

以下は**名前空間 import に統一する**。ESLint で強制している。

| モジュール    | 名前空間名   |
| ------------- | ------------ |
| `path`        | `path`       |
| `fs`          | `fs`         |
| `fs/promises` | `fsPromises` |
| `os`          | `os`         |
| `crypto`      | `crypto`     |
| `exceljs`     | `ExcelJS`    |

```typescript
// ✅ 呼び出し箇所に出自が残る
import * as crypto from "crypto"
import * as fsPromises from "fs/promises"
import * as os from "os"
import * as path from "path"

const id = crypto.randomUUID() // Math.random() ではないと分かる
const tmp = path.join(os.tmpdir(), name) // OS の一時ディレクトリだと分かる
await fsPromises.readFile(tmp) // 同期版 fs ではないと分かる

// ❌ 出自が消える
import { randomUUID } from "crypto"
import { tmpdir } from "os"
import { join } from "path"

const id = randomUUID() // crypto なのか自前ユーティリティなのか読めない
const tmp = join(tmpdir(), name) // 配列の join かどうかも紛らわしい
```

**`fs/promises` を `fs` と名付けてはいけない。** 同期版と区別がつかず、実際に「同期 API が必要になった箇所で `const fs = require("fs")` を書いて外側を潰す」という事故が起きていた。

型のみの import（`import type { Stats } from "fs"`）は対象外。

`react` および shadcn/ui・Radix UI（`import * as React from "react"` / `import * as TooltipPrimitive from "@radix-ui/react-tooltip"`）は**ライブラリ側の慣例に従う**。

### 別名 import（`as`）

`as` による改名は、**同名の別束縛と衝突する場合に限る**。

```typescript
// ✅ DOM グローバルの MouseEvent と衝突する
import type { MouseEvent as ReactMouseEvent } from "react"

// ✅ ライブラリ側が推奨している形（Playwright の型定義に記載）
import { _electron as electron } from "playwright"

// ❌ 衝突がないのに改名している（定義側の名前をそのまま使う）
import { createExam as dbCreateExam } from "../lib/prisma/exam"

// ❌ ライブラリが正式名を用意しているのに自前で別名を付けている
import { X as XIcon } from "lucide-react" // → import { XIcon } from "lucide-react"
```

呼び出し側で別名を付けたくなったら、**まず定義側の名前が命名規則に合っているかを疑う**。別名は命名の食い違いを import 文で隠すだけで、定義側の問題は残る。

---

## コメント規約

### コメントを書くべき場所

```typescript
// ✅ 「なぜ」そうしているかを説明
// Safari対応のため、Date.parse()ではなく手動パースを使用
const parseDate = (dateStr: string) => { ... }

// ✅ 複雑なビジネスロジックの説明
// 採点競合の解決: 同一設問に複数の採点がある場合、
// 最新のタイムスタンプを持つ採点を優先する
const resolveConflict = (scores: Score[]) => { ... }

// ✅ 一時的な対処の理由
// TODO: Prismaのバグ修正後に削除 (Issue #123)
const workaround = () => { ... }
```

### コメントを書くべきでない場所

```typescript
// ❌ コードを読めばわかる内容
// ユーザーを取得する
const user = getUser()

// ❌ 古くなりやすいコメント
// 3つのパラメータを受け取る（実際は4つに変更済み）
function process(a, b, c, d) { ... }
```

### JSDoc

**トップレベルの関数（他のファイルから export される関数）には必ず JSDoc を書く。**

複雑な関数や、使い方が分かりにくい関数には特に丁寧に書く。

```typescript
/**
 * 試験の採点データをExcel形式でエクスポートする
 *
 * @param examId - エクスポート対象の試験ID
 * @param options - エクスポートオプション
 * @returns エクスポートされたファイルのパス
 * @throws {ExportError} エクスポートに失敗した場合
 *
 * @example
 * const path = await exportToExcel('proj-123', { includePartial: true })
 */
export async function exportToExcel(
  examId: string,
  options: ExportOptions
): Promise<string> { ... }
```

### TODO/FIXME

```typescript
// TODO: 機能追加の予定
// TODO: 個人成績表PDF出力を実装 (#456)

// FIXME: 既知の問題
// FIXME: 大量データ時にパフォーマンス低下 (#789)

// NOTE: 注意点の説明
// NOTE: この処理は非同期で実行されるため、呼び出し元で await が必要
```

---

## 更新履歴

| 日付       | 内容                                                             |
| ---------- | ---------------------------------------------------------------- |
| 2025-01-12 | 初版作成                                                         |
| 2025-01-12 | 型管理方針を改訂（優先順位の明確化、後方互換性の方針追加）       |
| 2025-01-12 | IPC通信における型の一貫性ルールを追加                            |
| 2025-01-12 | フォーマッター・リンターセクションを追加                         |
| 2025-01-12 | eslint-plugin-simple-import-sort を導入                          |
| 2025-01-12 | 命名規則・不要コード削除のセクションを追加                       |
| 2025-01-12 | ESLint設定との整合性確認・修正、Tailwind CSSマイグレーション追加 |
| 2026-07-04 | 命名規則に「実体名の原則・高階関数優先・慣例例外 A/B」を追加     |
| 2026-07-05 | 命名規則に「id ではなく実体を持つ原則（`xxxIds` の扱い）」を追加 |
| 2026-08-02 | 「IPC の粒度（意図を運ぶ／状態を運ばない）」を追加               |
| 2026-08-09 | 「effect の中で setState しない」（A/B/C群の分類）を追加         |
| 2026-08-11 | 「IPC の失敗の伝え方」を追加。契約はエンベロープを宣言しない     |
| 2026-08-11 | effect の節を「使いどころ」へ改訂（A/B/C群を廃止・判定の訂正）   |
| 2026-08-11 | 「データ取得は `useQuery`」を追加                                |
