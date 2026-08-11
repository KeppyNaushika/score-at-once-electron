# IPC の失敗表現と renderer のデータ取得 — 実装計画

main の失敗の伝え方、renderer の IPC 契約、renderer のデータ取得を、1つの計画として揃える。

本書の数字は **2026-08-11 時点の実測**（TypeScript コンパイラ API による AST 走査。grep ではない）。

規約の本文は [coding-style.md](./coding-style.md) の「IPC の失敗の伝え方」「IPC通信における型の一貫性」
「effect の使いどころ」「データ取得は `useQuery`」にある。本書は**手順と根拠**を持つ。

---

## 1. なぜ1つの計画なのか

3つの作業に見えるが、**触る場所が同じ**である。

| 作業                          | 触る場所                                   |
| ----------------------------- | ------------------------------------------ |
| 失敗を例外へ寄せる            | main の `lib/` → 境界 → preload → renderer |
| 契約 `.d.ts` の手書きを廃す   | 境界 → preload → 契約                      |
| effect の取得を `useQuery` へ | renderer                                   |

別々に進めると、renderer の取得を 112 箇所書いた後で契約の形が変わり、全部書き直しになる。
逆に契約だけ先に導出しても、エンベロープが型に残ったままでは導出の記述が複雑になる（§4.2）。

---

## 2. 現状

### 2.1 エンベロープはドメインごとにばらついている

契約 `src/types/electron/*.d.ts` の `success` 出現数 / チャンネル数:

| 状態                           | ドメイン                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| **エンベロープ無し**（目標形） | `tag` 0/14・`examClassroom` 0/8・`userExam` 0/5・`navigation` 0/2・`auditLog`        |
| ほぼ全部エンベロープ           | `grade` 47/47・`coursework` 27/29・`settings` 11/11・`drawing` 10/10・`export` 15/18 |
| **混在**                       | `cropRegion` 10/26・`classroomStudent` 4/18・`exam` 6/13・`masterImage` 1/10         |

**この計画は新しい規約の導入ではない。** 既に5ドメイン・約40チャンネルが payload を直接返している。
混在ドメインは同じドメインの中に呼び出し規約が2つある状態で、これがいちばん危険である。

### 2.2 数

| 対象                                             | 数                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| チャンネル                                       | 277（`registerHandler` 165 / `registerSafeHandler` 94 / 生 `ipcMain.handle` 18） |
| 登録済みチャンネルと `ipcRenderer.invoke` の一致 | **277 対 277**。死んだチャンネルも存在しない呼び出しも 0                         |
| main で `success:` を組み立てている箇所          | 533（`lib/prisma` 238・`lib/export` 69・`lib/import` 65・他）                    |
| renderer で `.success` を読む箇所                | **321（116ファイル）**                                                           |
| 手書き契約                                       | 2,563行（署名 約1,960行 / 本物の型定義・コメント 約483行）                       |
| effect からのデータ取得                          | **112**（effect 内に async を書く形 61 / 外のローダーを呼ぶ形 51）               |
| うち競合の取り消しガードを持つもの               | **11**                                                                           |
| `react-hooks/set-state-in-effect` の警告         | 43（全て「effect からデータを取っている」もの）                                  |

エンベロープを組んでいるのは handlers ではなく **main の lib 層**で、handlers はほぼ素通しである。

### 2.3 いま守られていること

**この計画は「壊れているから直す」ではない。**

- **Decimal の変換漏れは 0 件。** 推論戻り値型に `Decimal` が残るのは4チャンネル
  （`get-question-scores-for-exam` / `get-question-score` / `create-question-score` /
  `update-question-score`）のみで、いずれも失敗時の早期 return が union を引きずっているだけ。
  実行時にその枝へ値は入らない（§7.1）
- **型そのものは既に共有されている。** 契約の 9/22 ファイルが `@prisma/client` を直接 import し、
  `@/electron-src/lib/prisma/*` の型も直接参照している
- **renderer → main の値 import は 7 件のみ**（型のみは 104 件）。7 件はすべて DB を触らない純粋計算

### 2.4 守られていないこと

**チャンネルと型の対応づけが照合されていない。**

```ts
// main の実装（electron-src/ipc-handlers/examHandlers.ts:61）
registerHandler("get-exam", async (examId: string) => getExam(examId))
//                                  → 戻り値は Exam | null（prisma から決まる）

// 契約（src/types/electron/examApi.d.ts:34）— 独立した申告
getExam: (examId: string) => Promise<Exam | null>
```

同じ型を指しているが、この2行は互いを参照していない。契約側には何を書いてもコンパイルは通る。
今日一致しているのは、人が一致させているからである。

過去にズレた記録は `docs/type-assertion-audit.md` §13（preload の二重定義・到達不能な IPC 4経路）。
いずれもレビューで発見された。規約はその間ずっと存在していた。

**そして失敗の見落としが型で止まらない。** `{ success, error }` を値で返す限り、`success` を
見なくてもコンパイルは通る。main の内部呼び出し（533箇所）でも renderer（321箇所）でも同じである。

---

## 3. 目標の形

| 層                   | 扱うもの                                                     |
| -------------------- | ------------------------------------------------------------ |
| main の `lib/`       | payload を返す。失敗は `throw`                               |
| 境界（登録ラッパー） | 例外を捕まえてエンベロープへ詰める。`serializePrisma` もここ |
| preload の `invoke`  | エンベロープをほどく。失敗は `throw`                         |
| 契約 → 最終的に導出  | payload の型だけ                                             |
| renderer             | `useQuery` / payload / 失敗は reject                         |

**エンベロープを宣言する場所は1つ、消費する場所は1つ。** 両端の型からは見えない。

副産物として得られるもの:

- `registerHandler`（165）と `registerSafeHandler`（94）の使い分けが**1つに統合される**。
  境界が常に同じことをするので分ける理由が消える
- 契約が payload 型だけになるので、`ReturnType` からの導出が素直に成立する
- renderer の `.success` 321箇所と、payload の `?` optional が消える

### 3.1 型の導出

preload は **型だけ** import する。値として main を import すると、esbuild が main の依存グラフ
（`@prisma/client` / ネイティブモジュール）を preload バンドルへ引き込んでビルドが壊れる
（`scripts/buildPreload.js` は `bundle: true`, `external: ["electron"]`）。

```ts
import type { Handlers } from "@/electron-src/ipc-handlers/registry"

export const invoke = async <Channel extends keyof Handlers>(
  channel: Channel,
  ...args: Parameters<Handlers[Channel]>
): Promise<Serialized<Awaited<ReturnType<Handlers[Channel]>>>> => {
  const envelope = await ipcRenderer.invoke(channel, ...args)
  // 失敗エンベロープだけをほどいて投げ直す
  …
}
```

`Handlers` は実装を1つのオブジェクトに集めたもの。**書く量は増えない。**

```ts
// 現状
registerHandler("get-exam", async (examId: string) => getExam(examId))

// 変更後
"get-exam": async (examId: string) => getExam(examId),
```

preload に残るのは「メソッド名 ↔ チャンネル名」の対応だけ（`getExam` ↔ `"get-exam"`、
`drawing.create` ↔ `"drawing:create"`）。これは人が決める情報なので残す。

`MyAPI` は preload から導出する。参照元は `src/types/electron.d.ts` のみ（モックも他の消費者も無い）。

### 3.2 Decimal

`Serialized<T>`（`src/types/prismaExtensions.ts:26`）と `serializePrisma`
（`electron-src/lib/prisma/serializePrisma.ts`）は既にある。新規作成は不要。

`Serialized<T>` は **Decimal 以外では恒等関数**である。277チャンネル中273本で何も変わらない。
「例外が多い」のではなく「名前の付いた例外が1つある」状態。

適用位置は境界に置き、ハンドラの裁量にしない。引数側（renderer → main）は、**ハンドラの引数に
`Prisma.Decimal` を書かない**ことを規則とする。`number` で受け、main 内で `new Decimal()` へ倒す。

---

## 4. 採らなかった案

### 4.1 renderer の各 `queryFn` で握る

```ts
queryFn: async () => {
  const result = await window.electronAPI.grade.getById(gradeId)
  if (!result.success || !result.grade) throw new Error(result.error ?? "…")
  return result.grade
}
```

同じ処理を既に321箇所でやっている状況に、さらに112箇所足すことになる。

### 4.2 preload で失敗だけ例外化し、payload はエンベロープのまま返す

`invoke` の戻り値を `Exclude<…, { success: false }>` とし、renderer は `(await …).grade` で受ける案。
main のロジックに触らずに済むが、

- **main の内部呼び出しの見落としは塞がらない**（533箇所は値のまま）
- `Exclude` を効かせるため `success: true as const` を372箇所へ足し、**新しいコードでも足し続けることを
  人に覚えさせる**規約になる。忘れると union が判別不能へ戻り、`grade?` の optional が復活する

覚えていないと壊れる規約は、規約として弱い。

### 4.3 セレクタ方式のヘルパー

```ts
unwrapIpc(
  window.electronAPI.grade.getById(id),
  (result) => result.grade,
  "成績"
)
```

判別可能 union になった時点で `result.grade` が引けなくなり、署名と全呼び出し箇所を書き直すことになる。
`select` を使わず include をそのまま持つ規約とも逆で、射影を挟む形になる。

### 4.4 Suspense + `use()`

`use()` に渡す promise はレンダー中に作れないため、promise キャッシュが必須になる。
そのキャッシュにはキー設計・無効化・重複排除が要り、TanStack Query を自作することになる。
Suspense は表示の見せ方の選択肢であって、原因の手当てではない。キャッシュ層の上に後から乗せられる。

なお **RSC でのデータ取得は構造的に不可能**である。データは `window.electronAPI`、つまり preload が
renderer にだけ注入するブリッジ経由なので、サーバー側には存在しない。

### 4.5 IPC の外部パッケージ

調査した（2026-08-09 時点）。

| パッケージ                    | 版    | 最終公開           | 週DL   | 方式         |
| ----------------------------- | ----- | ------------------ | ------ | ------------ |
| `electron-trpc`               | 0.7.1 | 2024-12            | 22,362 | 実装から推論 |
| `@electron-toolkit/typed-ipc` | 1.0.2 | 2024-11            | 4,362  | 手書きの表   |
| `electron-ipc-decorator`      | 1.0.1 | 2026-05            | 835    | デコレータ   |
| `@kjn/electron-typesafe-ipc`  | 2.0.0 | 2022-06            | 6      | 手書きの表   |
| `electron-typed-bridge`       | —     | 2023-09 アーカイブ | —      | 停止         |

- 手書きの表方式は**目的が違う**。宣言 2 回 → 1 回であって 0 回ではない
- 推論方式は `electron-trpc` のみだが、tRPC 一式（router / procedure）の導入となり、277チャンネルの
  書き換え量が本計画より大きい。`serializePrisma` の事情も乗らない
- 自前で書く量は `invoke` ラッパー10行弱。依存を増やす釣り合いが取れない
- 通信の中核であり、壊れたときに自分で直せる状態を保つ

ただし `electron-trpc` の「main の型を renderer へ渡す部分」は設計の参考になる。**導入せず実装だけ読む。**

### 4.6 モデルごとに `SerializedXxx` を手書きする

Decimal 列を持つ12モデル分作ることになる。既に一般化した型関数（`Serialized<T>`）がある。

---

## 5. 適用しない範囲

**塞がらないものを先に確定させる。**

| 対象                                             | 数                           | 扱い                                    |
| ------------------------------------------------ | ---------------------------- | --------------------------------------- |
| `event` を第1引数に取るチャンネル                | **17**                       | `Parameters<>` が使えない。§5.1         |
| バイナリを返すチャンネル                         | **1**（`omr:correct-image`） | serialize 前に素通しが必須。§5.2        |
| push 系（`webContents.send` → `ipcRenderer.on`） | —                            | 別立て。本計画の対象外                  |
| `status` のような絞り込み                        | —                            | 型から導けない。手書きを継続            |
| 死んだチャンネルの検出                           | —                            | tsc は未使用キーを報告しない。§7 で担保 |
| 変更系の `useMutation` 化                        | —                            | 本計画では扱わない。§6 段階5 の注記     |

### 5.1 `event` を取る17チャンネル

```
archive:preMatch / archive:detectScoringConflicts / archive:idIntegrationImport
coursework:analyzeArchive / coursework:importArchive
export:convertSvgToPng / export:printHtmlToPdf / export:openPrintDialog
navigation:get-state / navigation:go-to-index
omr:batch-recognize
pdf-tools:select-save-path
settings:getFullScreen / settings:setFullScreen
studentArchive:analyzeArchive / studentArchive:preMatch / studentArchive:import
```

`event.sender` からウィンドウや履歴を取るために生 `ipcMain.handle` で書かれている。
registry の値を `withEvent(fn)` でくるみ、型の上で第1引数を落とすヘルパーを1つ用意する。

### 5.2 バイナリ

`serializePrisma` の `convert()` は Decimal / Date / 配列でないオブジェクトを `Object.entries` で
分解する。`Uint8Array` を通すと巨大な `{0: 137, 1: 80, …}` になる。**段階1で必ず先に入れる**
（実行時・型の両方）。

```ts
// convert() 内、Date の分岐の隣
if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value

// Serialized<T> 内、Date の分岐の隣
: T extends ArrayBuffer | ArrayBufferView ? T
```

引数側でバイナリを受けるチャンネル（`pdfTools.exportAsPng` の `Buffer`、
`pdfTools.createDecryptedCopy` の `Uint8Array`、`omr` の `Uint8Array`）は戻り値ではないため影響しない。

---

## 6. 手順

各段階は単独でマージでき、後戻りできる。

### 段階0 — 前提の固定

renderer から main へ型を通す設計は、**値も通せてしまう**。`tsc` に区別する機能は無いので ESLint で塞ぐ。

`src/**` に対して `@typescript-eslint/no-restricted-imports` で `@/electron-src/**` を
`allowTypeImports: true` に制限する。素の ESLint 版にこのオプションは無く、typescript-eslint 版だけが
AST の `importKind` を見る。宣言レベルの `import type` も指定子レベルの `import { type X }` も通る。

あわせて `@typescript-eslint/consistent-type-imports` を入れる（現在未設定）。これは制限の前提ではなく
（`no-restricted-imports` は単独で型のつもりの値 import を捕まえる）、既存の104件を `--fix` で片付け、
境界とは無関係な場所も含めて書き方を揃えるために入れる。

**例外は「読む側のファイル」を名指しする。** モジュールの一覧で書きたいところだが、
`no-restricted-imports` の `group` は gitignore 記法で、`@/electron-src/**` が中間ディレクトリごと
除外してしまうため `!` で個別に再包含できない（実測で確認）。そのため許可の単位がファイルになる。

値 import を持つ7ファイル（実測。いずれも DB を触らない純粋計算を main と共有するもの）:

```
src/components/exams/07-score-at-once/ScoringMain/ScoringMainView.tsx
src/components/exams/08-export/components/IndividualReportSettings.tsx
src/components/exams/08-export/components/individual-report/computeReportData.ts
src/components/exams/08-export/hooks/useExportPage.ts
src/components/exams/08-export/hooks/useItemAnalysis.ts
src/components/exams/08-export/hooks/useSpAnalysis.ts
src/components/grades/03-data-sources/hooks/useDataSourceDefaults.ts
```

参照先は6モジュール（`lib/shared/utilities/examPaperSize`、`lib/shared/calculations/` の
`numericStats` / `itemAnalysis` / `spAnalysis` / `gradeDataSourceMaxScore`、
`lib/export/individual-report/types` の定数）。

> **この一覧を消す道**: 上記6モジュールを `electron-src` の外へ出せば例外は0になる。
> 5つは41〜248行で利用者も少ない（main 1〜2 / src 1〜3）が、`individual-report/types` は
> main から167箇所参照されており、renderer が値として要るのは `STATISTIC_KINDS` /
> `STATISTIC_SCOPES` / `DEFAULT_INDIVIDUAL_REPORT_OPTIONS` の3つだけ。定数の切り出しが要る。
> 本計画の対象外とし、別途扱う。

> **注意**: `electron-src/lib/shared/` は安全ではない。`lib/shared/calculations/gradeCalculator.ts:17`
> が `prisma`（DB 接続の実体）を import している。ディレクトリ名では守れないため**ファイル名で列挙する**。

### 段階1 — `Serialized` / `convert` にバイナリ素通しを追加

§5.2。単独で無害。段階2の前提。

### 段階2 — 境界の統合

`registerHandler` と `registerSafeHandler` を1つにし、エンベロープ詰めと `serializePrisma` を
そこへ置く。**この時点では lib も renderer も変えない**ので、エンベロープを二重に包まないよう、
既に `{ success }` を返している lib の戻り値はそのまま payload として扱う。

### 段階3 — preload の `invoke`

失敗エンベロープをほどいて投げ直す。型はまだ契約 `.d.ts` が持つ。

### 段階4 — ドメイン単位の移行（本体）

**1ドメイン = 1PR。** ドメインごとに次を一度に済ませる。

1. `lib/` を payload / `throw` へ
2. 契約 `.d.ts` から `success` / `error` / payload の `?` を削る
3. renderer の `.success` を除去
4. その ドメインを使う取得を `useQuery` へ（`queryKeys` に鍵を足す）

チャンネル単位で混在できる。`invoke` は失敗エンベロープを見たときだけ投げ、それ以外は素通しするため、
**未移行チャンネルは今のまま動く。**

着手順（小さく・影響の大きいものから）:

| 順  | ドメイン                                                         | チャンネル | 理由                                        |
| --- | ---------------------------------------------------------------- | ---------- | ------------------------------------------- |
| 1   | `settings`                                                       | 11/11      | 全てエンベロープ。**112件の最大の塊**がここ |
| 2   | `masterImage`                                                    | 1/10       | 混在の解消。小さい                          |
| 3   | `classroomStudent`                                               | 4/18       | 混在の解消                                  |
| 4   | `exam`                                                           | 6/13       | 混在の解消                                  |
| 5   | `cropRegion`                                                     | 10/26      | 混在の解消。最大の混在                      |
| 6   | `drawing` / `scoring` / `studentAnswer`                          | —          | 07 の中核                                   |
| 7   | `export` / `archive` / `coursework` / `grade`                    | —          | 大きい                                      |
| —   | `tag` / `examClassroom` / `userExam` / `navigation` / `auditLog` | —          | 既に目標形。`useQuery` 化のみ               |

### 段階5 — registry 化と契約の削除

全ドメインが payload を返すようになってから**一括で**行う。ドメインPRに混ぜると、意味の変更
（失敗の伝え方）と構造の変更（registry 化）が同じ差分に入って切り分けられなくなる。

署名（約1,960行）を削除し、**本物の型定義（約483行）は main 側へ移す**。

> `drawingApi.d.ts` には「なぜ採点者引数が無いのか」「なぜ `AnnotationWithContext` か」といった
> 設計判断のコメントがある。**型と一緒に消さず、ハンドラ側へ移すこと。**

### 段階6 — lint の締め

`react-hooks/set-state-in-effect` を `error` へ。`package.json` の `--max-warnings` を撤去。

> **変更系（mutation）は本計画では扱わない。** `loadX()` の手撃ちを `invalidateQueries` へ
> 差し替えるところまでで止める。`useMutation` への移行は消費側の契約が全面的に変わるため別立て。

---

## 7. 検証

型検査だけでは塞がらない部分をスクリプトで担保する。いずれも現時点で 0 件なのでグリーンのまま導入できる。

| 検査                 | 内容                                         | 現在値              |
| -------------------- | -------------------------------------------- | ------------------- |
| チャンネル突き合わせ | 登録と `invoke` の差分                       | 0 / 0               |
| Decimal 走査         | 推論戻り値型に `Decimal` が残るチャンネル    | 4（§7.1）           |
| 値 import 走査       | `src/` から `electron-src/` への値 import    | 7（すべて許可済み） |
| エンベロープ残存     | 契約 `.d.ts` の `success` 出現               | 移行の進捗そのもの  |
| effect からの取得    | `useEffect` から `window.electronAPI` へ到達 | 112 → 0             |

いずれも TypeScript コンパイラ API による AST 走査で書ける。grep では `import * as path` や
複数行 import を誤判定するため不可。

### 7.1 Decimal 4件が「漏れ」ではない理由

```ts
const result = await getQuestionScoresForExam(examId, userId)
if (!result.success) {
  return result // ← ここが union 全体を返している
}
const scores = result.scores?.map(serializeScore) || []
```

`success: true` が `boolean` へ広がるため判別可能 union にならず、`!result.success` で絞り込めない。
結果、失敗用の早期 return が成功枝（Decimal 入り）の型まで引きずる。実行時にその枝へ値は入らない。

**段階4でこの4チャンネルが payload / `throw` になると、この現象ごと消える。**

なお `serializeScore`（`scoringHandlers.ts:36`）は戻り値に `: SerializedQuestionScore` と注釈されて
いるため、`.toNumber()` の書き忘れも `QuestionScore` への列追加も**コンパイルエラーになる**。
この箇所の設計は健全である。

---

## 8. この計画が前提にしていること

**main と renderer が同じ TypeScript プログラムに属していること。**

ルート `tsconfig.json` の `include` が `["**/*.ts", …]` で `electron-src` を含んでいるため、現在は
成立している。`electron-src` を別ビルドへ切り出す、preload を独立プロジェクトにする等でこの前提が
崩れると、**段階5の仕組みは成立せず手書きに戻る。**

---

## 9. 規約としての差分

| 状態     | 内容                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 旧       | main と renderer で同一の型定義を参照すること                                            |
| 状況     | **達成済み。** 型そのものは既に共有されている                                            |
| 追加済み | 失敗は例外・予期される結果は値。エンベロープは境界と preload の間だけの搬送形式          |
| 追加済み | 契約はエンベロープを宣言しない（payload の型だけ）                                       |
| 追加済み | effect の用途は2つ（押し出す／購読してコールバックで setState）。データ取得は `useQuery` |
| 段階0で  | `src/` から `electron-src/` への import は型のみ（例外は名指しの一覧）                   |
| 段階5で  | **renderer 側の IPC 契約を宣言しない。main の実装から導出する**                          |
| 段階5で  | main と renderer を同じ tsc プログラムに保つこと                                         |

「追加済み」は [coding-style.md](./coding-style.md) に反映済み。段階0・段階5の項目は、その段階の
PR で同時に書き足す。
