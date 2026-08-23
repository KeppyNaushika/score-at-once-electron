# IPC の失敗表現と renderer のデータ取得 — 実装の記録

main の失敗の伝え方、renderer の IPC 契約、renderer のデータ取得を、1つの計画として揃えた。
**本書は済んだことの記録**である（段階0〜18 と R1〜R8）。**これからのことは
[remaining-work.md](./remaining-work.md)** にある。

本書の数字は **2026-08-11 時点の実測**（TypeScript コンパイラ API による AST 走査。grep ではない）。

規約の本文は [coding-style.md](./coding-style.md) の「IPC の失敗の伝え方」「IPC通信における型の一貫性」
「effect の使いどころ」「データ取得は `useQuery`」にある。本書は**手順と根拠**を持つ。

---

## 済んだこと（一覧）

段階0〜18 と R1〜R8 が完了。詳細は §6「手順」の各段にある。

| 段階       | 何をしたか                                                                                     | 締め   |
| ---------- | ---------------------------------------------------------------------------------------------- | ------ |
| **0**      | 型だけを通す境界を lint で固定した                                                             | —      |
| **1〜3**   | `Serialized` / `convert` の整備、境界の統合、preload の `invoke`                               | —      |
| **4〜5**   | ドメイン単位で移行し、registry 化して手書き契約を消した                                        | —      |
| **6**      | lint を締めた                                                                                  | —      |
| **7〜9**   | 3回のレビューで出た回帰を直し、前提を洗い直した                                                | R1〜R3 |
| **10**     | 読み書きを `src/queries/` へ集める形を確立した                                                 | R1     |
| **11**     | 楽観更新を撤去し、ジェスチャの規約を立てた                                                     | R2     |
| **12**     | 採点(07)と出力(08)を移した                                                                     | R4     |
| **13**     | 07 の採点行を採点領域の木から取るようにした                                                    | R5     |
| **14**     | `window.electronAPI` を `src/queries/` だけにした                                              | R5     |
| **15〜17** | ASB の main を実体ごとに分解し、型と action を id 基準にし、IPC を割って書き込みの関所を置いた | R6・R7 |
| **18**     | 設定の JSON を行へ割った                                                                       | R8     |
| **R7＋R8** | 枝全体のレビュー。**指摘16件を全て直した**                                                     | —      |

**R7/R8 の指摘16件の詳細は [branch-review-findings.md](./branch-review-findings.md)**
（1件ずつ「何が起きるか・なぜそうなるか・どう直したか」）。ASB の分割（段階15〜17）の
詳細は [asb-ipc-split-plan.md](./asb-ipc-split-plan.md)。

### この作業で分かった、繰り返し出た形

| 形                                              | どこで踏んだか                                                  |
| ----------------------------------------------- | --------------------------------------------------------------- |
| **消したフックが守っていたものを引き継がない**  | R1 の10件中6件。R7/R8 でも #13 が同じ形                         |
| **read-modify-write**（キャッシュを読んで書く） | R2 の10件中6件。#2 も関門がキャッシュを見ていた                 |
| **型を緩めると検出が死ぬ**                      | #3（行の手写しで全 optional）・#16（union を捨てた）            |
| **成功経路にしか後始末が無い**                  | #7（`isExporting` が戻らない）・#14（作った相手を覚えていない） |
| **同じ規則が2箇所にある**                       | #16（得点化が2実装で、旧データの扱いだけ食い違っていた）        |

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

## 2. 着手前の状態（2026-08-11 時点・履歴）

**この節の数値は着手前の記録である。現在値ではない。** 契約 `.d.ts` は段階5 で全廃し、
エンベロープは撤去済み、effect からの取得も残り3件まで減っている。ここを更新すると
「何がどれだけ変わったか」が読めなくなるので、**あえて凍結する**。現在値が要るときは
検査（§7）を走らせる。

### 2.1 エンベロープはドメインごとにばらついていた

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

`Serialized<T>` は **Decimal 以外では恒等関数**である。ほぼ全てのチャンネルで何も変わらない。
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
- 推論方式は `electron-trpc` のみだが、tRPC 一式（router / procedure）の導入となり、全チャンネルの
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

### 段階0 — 前提の固定（完了）

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
>
> **→ 段階14 で消えた。** 定数の切り出しは要らなかった。`individual-report/types.ts` を
> 丸ごと `src/types/individualReport.types.ts` へ移すと、main 側の167箇所は**型**の参照
> なので向きが変わっても規約に触れない（`src/` → `electron-src/` の型 import は許される）。
> 残り5つは `src/lib/shared/` へ（値で引く `subtotalAssignments` も連れて6つ）。

> **注意**: `electron-src/lib/shared/` は安全ではない。`lib/shared/calculations/gradeCalculator.ts:17`
> が `prisma`（DB 接続の実体）を import している。ディレクトリ名では守れないため**ファイル名で列挙する**。

### 段階1 — `Serialized` / `convert` にバイナリ素通しを追加（完了）

§5.2。単独で無害。段階2の前提。

### 段階2 — 境界の統合（完了）

`registerHandler` と `registerSafeHandler` を1つにし、エンベロープ詰めと `serializePrisma` を
そこへ置く。**この時点では lib も renderer も変えない**ので、エンベロープを二重に包まないよう、
既に `{ success }` を返している lib の戻り値はそのまま payload として扱う。

### 段階3 — preload の `invoke`（完了）

失敗エンベロープをほどいて投げ直す。型はまだ契約 `.d.ts` が持つ。

### 段階4 — ドメイン単位の移行（本体・完了）

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

### 段階5 — registry 化と契約の削除（完了）

全ドメインが payload を返すようになってから一括で行った。手書き契約 22ファイル・1,957行を削除。

**手書き契約は型検査を受けていなかった。** `tsconfig.json` の `skipLibCheck: true` は `.d.ts` の
中身を検査しないため、契約ファイル内の壊れた import はエラーにならず、その型は暗黙に `any` へ
落ちる。実際 `answerSheetBuilderApi.d.ts` は存在しない再エクスポートを import しており、
`loadDefinition` の戻り値が `any` になっていた。おかげで payload へ移行済みのチャンネルに対し
`result.success && result.data` と書いた3画面が残り続け、**解答用紙ビルダーは定義を読み込めない
まま**だった（エラートーストだけが出る）。契約を書く場所が検査の外にあったことが、
「人が一致させている」という前提すら成り立っていなかった理由である。

導出へ切り替えた時点で表に出た食い違い:

| 場所                                      | 契約の主張             | 実体                                 |
| ----------------------------------------- | ---------------------- | ------------------------------------ |
| `asb:load-definition`                     | （検査されず `any`）   | 定義そのもの。3画面が壊れていた      |
| `updateExam`                              | `ExamForDetail`        | スカラーのみ。詳細画面の集計が消える |
| `coursework:getAvailableStudents`         | `{ className }` を持つ | Student 行。学級名は常に空だった     |
| `GradeWithRelations.referenceDate`        | `string`               | `Date`（structured clone）           |
| `CourseworkSummary.items[].letterScales`  | 持つ                   | 一覧の include では引いていない      |
| `ExamForDetail.gradeDataSources[].weight` | `Decimal`              | 境界で number へ倒れている           |

DB 上 String の union 列（`inputMode` / `kind` / `aggregate` / `absentMethod` /
`estimationMode` / `status`）は、契約で union を名乗るだけで変換していなかった。
境界（lib の返り値）で `defineStringUnion` の `to*` を通す形へ揃えた。

### 段階6 — lint の締め（完了）

`react-hooks/set-state-in-effect` の違反39件を全て `useQuery` / `useMemo` へ移し、
ルールを `error` へ上げた。`--max-warnings` は 0。

> **「39件」は lint 由来の数で、fetch-effect の総数ではなかった。** このルールが見るのは
> **effect の外で定義した関数**だけで、effect の中へ直接書いた取得は数えない
> （`eslint.config.mjs` に書いた注意書きのとおり）。実測では **effect の本体に
> `window.electronAPI` が現れるものが 47箇所**残っていた。この棚卸しは段階7で
> 済ませ、**7箇所**（取得ではない effect のみ）まで減らした。

移し方は3通りだった。

| 形                                   | 移し先                               | 例                                       |
| ------------------------------------ | ------------------------------------ | ---------------------------------------- |
| 取得して表示するだけ                 | `useQuery`                           | 一覧・詳細・設定                         |
| 取得して**編集可能な状態**の種にする | `useQuery` ＋ 編集の置き場所を決める | 名簿・割当マトリクス・追加パネル         |
| 取得ではなく**派生値**               | `useMemo`                            | 採点画面の絞り込み（`useScoringFilter`） |

2番目が一番判断を要した。編集中の値をどこに置くかで3つに割れた。

- **キャッシュを直に差し替える**（`setQueryData`）… 編集がそのまま保存対象になるもの。
  割当マトリクス・名簿の並び順・OMR設定・除外設定
- **選択・ドラフトを別に持つ**… 編集が保存対象と別物のもの。生徒追加パネルの選択
  （id の集合）、評価項目の編集ドラフト
- **取得結果から導く**… そもそも状態を持つ必要がなかったもの。採点領域画面の表示ページ

この整理の過程で、同じ内容を2つの state で持っていた箇所（割当マトリクスの
`assignments` と `originalAssignments`）が見つかった。保存のたびに両方を更新して
いたので常に同じ値で、「変更をリセット」は何もしていなかった。

### 段階7 — レビューで出た回帰の修正（完了）

段階4〜6のマージ前レビュー（finder 4本 → 候補39件 → 検証で8件棄却）で、**この移行が
入れた回帰が10件**確定した。追加調査で4件（E）、47箇所の棚卸しでさらに3件を足し、
**全て直した**。

原因は3系統に分かれる。どれも「移行の型」そのものの誤りだったので、同じ形が他にも
無いかを確かめながら直した（E と棚卸しの節がその結果）。

#### A. キャッシュキーの衝突（2組）

**「1つの取得にまとめる」ときにキーを使い回した。** キーは _取得の対象_ ではなく
_格納する形_ ごとに分ける。同じキーに違う形を書くと、`isPending` が false のまま
相手のデータで描画される（TanStack Query はキャッシュを同期的に返す）。

| #   | 場所                                                                                                                      | 衝突相手                                                                                               | 症状                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | `CourseworkItemsContainer.tsx:191` が `queryKeys.coursework.detail` に**項目の配列**を書く                                | `CourseworkDetail.tsx:55` が同じキーに**資料オブジェクト**を書く                                       | 詳細→評価項目で `items.map is not a function`、逆順で `coursework.classrooms.map` が undefined。どちらも画面ごと落ちる |
| 6   | `04-question-group/page.tsx:38` が `queryKeys.exam.cropRegions` に `{activeSubtotalGroups, cropRegions, subtotalRegions}` | `03-region-info/page.tsx:59` が同じキーに `{currentUser, examPages, backgroundImageUrls, cropRegions}` | 04→03 で 0ページ・背景なしの領域エディタが出る。しかも `currentUser` が null なので `autoSaveRegions` が `if (!examId  |     | !currentUser) return` で黙って何もせず**編集が失われる**。03→04 では type で絞られていない cropRegions が設問割当マトリクスの行に並び、小計欄に対して QUESTION_ASSIGNMENT を書き込む |

**直した形**: 画面固有の複合ペイロードには画面固有のキーを与えた
（`exam.regionInfoPage` / `exam.questionGroupPage` / `exam.exportPage` /
`exam.detailPage`）。`*.detail` は「その実体そのもの」を1つの queryFn で取る用途に
だけ残す。

> `grade.detail` は3つの消費者（`page.tsx` / `useBoundaries` / `useDataSources`）が
> **同一の queryFn** を持つので衝突しない。共有してよいのはこの形だけ。

評価項目（#1）は複合ではなく資料の子なので、別キーへ複製せず
`coursework.detail` に `select` を足して取り出す形にした。**同じ実体が2つの形で
キャッシュに載らない**のが要点で、キーを増やすことではない。

`grade.detail` / `coursework.detail` は `["grade", gradeId]` のように**他のキーの
前方**でもあった。実体を入れたまま無効化すると `sourceFits` や `results` まで
前方一致で巻き込む（#7 はその帰結）。どちらも末端の葉へ移した。

#### B. 「破壊的更新をやめた」ことが依存を壊した（3件）

| #   | 場所                                             | 何が起きるか                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2   | `QuestionAssignmentMatrixWithFillHandle.tsx:140` | フィルハンドルのループが各書き込みを**レンダー時の** `assignments` から組み立てる。`toggleAssignment` が Set を複製するようにしたため値が累積せず、同じ行で複数マスを塗ると最後の1件しか永続化されない。保存が delete-all→recreate なので既存の割り当てが消える。以前は Set をその場で書き換えていたから累積していた（＝あの「破壊的更新」は**意図的な累積**だった） |
| 3   | `QuestionAssignmentMatrixWithFillHandle.tsx:78`  | 採点領域ごとの try/catch を `Promise.all` に置き換えたため、1領域の取得失敗で全体が reject し「全マス未チェック」で描画される。そこでのクリックが delete-all→recreate で割り当てを消す                                                                                                                                                                               |
| 5   | `CourseworkItemsContainer.tsx:227`               | 並べ替えが `setQueryData` で新しい配列を書く → レンダー中の `items !== draftSource` が成立 → 全ドラフトを（無効化していない古い）キャッシュ行から作り直す。リネーム直後に並べ替えると入力が旧名へ戻り、デバウンス中なら `draftsRef` も巻き戻って**旧名が DB へ書き戻される**                                                                                         |

**直し方**:

- #2 は書き込み値をループ内で持ち回る（`updates` を rowId でまとめ、1行1回の書き込みにする）
- #3 は領域ごとに `catch` して空集合へ倒す（`Promise.allSettled`）。取得に失敗した領域は
  「未チェック」ではなく**編集不可**にするのが本来だが、最低限、全体を空にしない
- #5 はドラフトの作り直しを「取得結果が変わったとき」ではなく「**サーバーから取り直したとき**」に
  限定する。並べ替えは `items` の順序だけを変える別経路にする（`draftSource` の比較対象を
  id の並びではなく行の内容にする、または並べ替えを楽観更新せず invalidate に寄せる）

#### C. 投げっぱなしの書き込み（2件）

IPC が throw する形になったのに `void` で投げているため、失敗が誰にも届かず楽観更新も戻らない。

| #   | 場所                                                              | 症状                                                                                                                                                   |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4   | `useCourseworkScores.ts:253`（アンマウント時と250行のデバウンス） | 点数の保存失敗が unhandled rejection になるだけ。`pendingChanges` はクリア済みで再試行もされず、キャッシュは入力値を表示し続ける。次に開くと消えている |
| 8   | `TagsPageContainer.tsx:318`                                       | タグ並べ替えの保存失敗が届かず、巻き戻しもされない                                                                                                     |

**直し方**: `.catch` でトーストを出し、キャッシュを元へ戻す。アンマウント時は
巻き戻す先の画面が無いので、**トーストだけは出す**（`toast` は画面をまたいで残る）。

#### D. 失敗が無言になった / 取り残し（3件）

| #   | 場所                                                         | 内容                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | `03-region-info/page.tsx:72`                                 | queryFn が「試験が見つかりません。」を throw するが、コンポーネントは `error` を読まない。以前トーストを出していた失敗が、無言の空編集画面になる。`04-question-group` は `queryError` をエラー表示へ繋いでいるので、そちらに合わせる                                                                                                                                                                                |
| 7   | `useDataSources.ts:36`                                       | `loadData` が `["grade", gradeId]` を無効化するので、前方一致で `["grade", gradeId, "sourceFits"]` まで巻き込む。「名前・並べ替えでは R を再算出しない」というコード内の明言が実際には守られておらず、入力のたびに `buildGradeCalcContext`（全試験のスコア取得）が走る。キーを兄弟（`["gradeDetail", gradeId]` と `["gradeSourceFits", gradeId]`）に分けるか、`invalidateQueries({ queryKey, exact: true })` にする |
| 10  | `archiveHandlers.ts:95` ほか、`studentArchiveHandlers.ts:28` | `archive:exportExam` / `archive:analyzeArchive` / `studentArchive:*` が旧 `{success, error}` エンベロープのまま。キャンセルを `result.error === "キャンセルされました"`（`src/app/exams/[examId]/page.tsx:100`・`StudentArchiveExportDialog.tsx:127`）という**文言比較**で判定している。他ドメインと同じく payload/throw ＋ `{canceled}` の判別可能 union へ移す                                                    |

#### E. レビューが取りこぼしたもの（追加調査分）

レビューの棄却8件は**理由が記録されていない**ため手で確認した。うち4件は再検討が要る。

| #   | 場所                          | 内容                                                                                                                                                                                                                                    |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | `useExportPage.ts:90`         | 出力設定の取得が永続 `initializedRef` で1回だけに固定されている。試験を切り替えても前の試験の設定が残る。lint が数えない「effect の中に書いた取得」の実例                                                                               |
| 12  | `gradeCalculator.ts:199`      | `absentMethod: (…) as AbsentMethod`。この移行で `toAbsentMethod` を用意したのに、この経路だけ型アサーションの素通しのまま                                                                                                               |
| 13  | `useExportPage.ts:274`        | `queryKeys.exam.students(examId)` に `{exam, students}` という複合を入れている。消費者が1つなので今は衝突していないだけで、**系統Aと同じ形**                                                                                            |
| 14  | `useClickScoringConfig.ts:53` | `{...DEFAULT, ...parsed}` で保存済み JSON をそのまま広げており、壊れた値が union を名乗ったまま通る。`CLICK_SCORING_ACTIONS` が同じファイルにあるのに使っていない（この移行より前からの穴だが、境界で倒す方針を入れた以上ここも揃える） |

#### 棚卸しの結果（47箇所 → 7箇所）

lint が数えない「effect の本体に書いた取得」を全て見た。**40箇所を `useQuery` へ移し、
7箇所を effect のまま残した。** 実測は TypeScript コンパイラ API による AST 走査
（`useEffect` の本体に `window.electronAPI` が現れるもの）。

移すときに分かったのは、**同じものを画面ごとに引き直していた**ことである。

| 引いていたもの    | 引いていた画面数 | 移した先                                 |
| ----------------- | ---------------- | ---------------------------------------- |
| `tagGetAll`       | 6                | `useTags`（既存）                        |
| `fetchStudents`   | 4                | `useStudents`（新設）                    |
| `fetchClassrooms` | 4                | `useClassrooms`（新設）                  |
| `fetchUsers`      | 3                | `queryKeys.users.all`                    |
| `loadDefinition`  | 4                | `queryKeys.answerSheetDefinition.detail` |

パンくずが名前だけのために別途引いていた4つの layout は、実体そのもののキャッシュを
`select` で共有する（`grade.detail` と同じく、**同一の queryFn を持つ消費者だけが
キーを共有してよい**）。

effect のまま残した7箇所は、いずれも取得ではない。

| 場所                                | 何をしているか                                   |
| ----------------------------------- | ------------------------------------------------ |
| `useSyncSettings.ts:43`             | main からの押し出しを購読                        |
| `useOmrAutoScoring.ts:103`          | 認識の進捗を購読                                 |
| `AnswerSheetBuilderMainView.tsx:99` | 編集内容の自動保存（書き込み）                   |
| `useScoredAnswerPdfExport.ts:331`   | ストリーミング出力の確定（書き込み）             |
| `useMarkerCorrection.ts:133`        | 画像の補正・復元（DOM のパイプライン）           |
| `useAnswerWhiteness.ts:80`          | 白紙判定の測定（同上）                           |
| `useImageLoader.ts:36`              | 答案画像のデコードと `imageRef` への反映（同上） |

`useImageLoader` だけは IPC（`checkFileExists`）を含むが、結果は `HTMLImageElement`
であってキャッシュに載せるものではない。

**この過程で、レビューが挙げていない同型の穴も直した。**

- `useKeyboardSettings` と `ShortcutProvider` がキーバインディングを別々に持っていた。
  設定画面で変えても、開いている採点画面には届かなかった
- `ExportContainer`（成績の出力設定）も `useExportPage` と同じ永続 ref で1回に固定して
  いた。成績を切り替えても前の成績の設定が残る（#11 と同型）
- `useScoringDataLoader` は操作者が取れないとき `"default-user"` という**存在しない id**
  へ倒していた。返り値の型は元から `string | null` なので、null を返す形に直した

**棄却1は確定した #6 と同一の問題だった。** 同じキー衝突を、片方の検証が棄却し
もう片方が確定させている。**検証の一貫性は保証されていない**ので、棄却＝安全とは読まない。

#### 検証

- `npm run check-all`（0 errors / 0 warnings）と `npx vitest run`（1,345件）

**ただしこの2つでは足りない。** この移行で見つけた実バグは全て「型」が教えたもので、
**アプリを一度も起動していない**（`npm run dev` も e2e も走らせていない）。

- キー衝突（#1・#6）は tsc もテストも捕まえない。**この検査を追加した**
  （`__tests__/renderer/queryKeyConventions.test.ts`）。ソースを AST で走査し、
  (1) キーは必ず `queryKeys` を経由する、(2) 同じキーの `queryFn` が呼ぶ IPC の
  集合は1つだけ、を確かめる。**入れた時点で違反が8件見つかった**（生キー7件と、
  `currentUser.all` へ別の出所の「今のユーザー」を書いていたもの1件）
- `useScoringFilter` にはテストが1件も無い。その中核の派生ロジックを書き換えた
- 389ファイル・±3万行に対して finder 4本・候補39件。**網羅の主張はできない**

**テストを1件、新しい挙動に合わせて書き換えた。**
`useAllStudentAnnotations` は「設問を切り替えると取り直す」ことを検証していたが、
要求（`drawing.getByExamStudent`）に設問領域は入らないので、取り直しても同じ答えしか
返らない。取り直さないことを検証する形へ変えた。**通らなくなったテストを消したのでは
なく、何を保証すべきかが変わったという判断**なので、根拠をここに残す。

---

### 段階8 — 2回目のレビューで出た回帰の修正（完了）と、残した判断

段階7 のマージ前レビュー（前回以降の差分のみ・10コミット）で、**確定8件・可能性2件**が
出た。9件を直し、1件は方針により見送った。

#### 見送った1件

`CourseworkItemsContainer` のドラフトが他端末の変更を潰す件。シナリオが
「教員Aと教員Bが同じ資料の評価項目を同時に編集」だった。

**同一利用者が複数端末で同時に操作することは想定しない**（OWNER 判断）。共同編集が
成り立つのは採点だけで、そこは利用者ごとに採点結果を別々に保存しているから成立する。
それ以外で編集が戻ることが技術上避けにくい場合は、無理に回避しない。単一利用者では
ドラフトの値が常に最新なので破綻しない。

#### 直した9件の中心にあった2つの型

**(1) 取得結果を編集用 state へ写す処理が、書き込みと繋がっていなかった。**
出力設定・解答用紙・試験タグ・プロジェクターモードは、DB へ書くだけでキャッシュに
何も言っていなかった。キャッシュに古い値が残っている状態で再マウントすると、
古い値が編集状態へ入り、次の操作でそれが DB へ書き戻る。

> **`gcTime`（5分）は関係ない。** `staleTime` は 0 なので必ず取り直しに行くが、
> `useQuery` はキャッシュを同期的に返すので、最初の1レンダーで古い値が写される。
> 写すのは1回きりなので、あとから正しい値が届いても入らない。壊れる条件は
> 「キャッシュに古い値が1件でも残っていること」で、時間の条件ではない。

**(2) 巻き戻し先がクライアントの断面だった。** 04 の設問割当は全消し→作り直しで
保存するので、消す方だけ通ることがある。断面へ戻すと DB に無い割り当てを画面が
表示し続ける。キーバインディングは未取得時に `previous` が `undefined` で、
`setQueryData` が書き込みを中止するため**そもそも巻き戻っていなかった**。

これを受けて **書き込みは「楽観更新 → 失敗したら invalidate」に統一**した
（[coding-style.md](./coding-style.md) の「データ取得は `useQuery`」に明記）。
それまで3通りに割れていた（楽観更新／保存して取り直し／保存だけ）。

#### 解答用紙（ASB）— #1126 §1〜§3 と #1127

レビュー #1 の破壊力は #1126 §2「開くだけで保存が走る」そのものだった。部分的に
直すのは筋が悪いので、issue として着手した。

**所有と共有（#1127）は OWNER / VIEWER にした。Editor は作らない。**

|                                  | 一覧に出る | 開いて見る | 編集・削除・タグ |
| -------------------------------- | ---------- | ---------- | ---------------- |
| 担当者（作成者 or 譲り受けた人） | ○          | ○          | ○                |
| それ以外の全員                   | ○          | ○          | ×                |

- 一覧の既定は自分が担当の分だけ。チェックで全員分に切り替える
- 担当を渡せるのは今の担当者だけ（横から取り上げられない）。作成者不在のときは複製で逃げる
- 用語は「定義」をやめて **「解答用紙」** で通す（モデル名 `AsbDefinition` は据え置き）

**保存は差分更新にした（§3）。** 残るものは id ごと残し、消えたものだけ消す。
**そして変わった行だけを書く。** OMR設定と選択肢も作り直しをやめた。作成日時の
リセット（§3）も同時に消える。検証は
`__tests__/answer-sheet-builder/saveDiffUpdate.test.ts`。
§1（同期での消失）は実測したところ再現しなかった。下の「段階8 の続き」1番を見ること。

> **「削除だけ差分、更新は全書き換え」は差分更新ではない。** 全消しをやめた後も
> 全行を上書きしていた時期があり、これは触っていない行の `updatedAt` まで「今」に
> する。同期は行ごとの LWW なので、**2端末が別々の大問を編集しただけで、後から
> 保存した側の木が丸ごと勝ち、相手の編集が消える**。触った行だけを書けば、重ならない
> 編集は両方残る。判定は `electron-src/lib/prisma/rowDiff.ts`。

#### 段階8 の続き（1〜4は完了。残るのは issue への追記だけ）

**1. 同期の前提を実測した — #1126 §1 の前提は誤りだった**

差分更新は「delete→recreate が同期で消失を生む」という前提の上に立っていた。
`~/dev/sqlite-nas-sync/__tests__/` に2端末のシナリオを一時的に置いて実測した結果、
**旧挙動でも端末Bから行は消えない**。再現しなかった。

計ったこと（親1行＋子2行を、同一トランザクションで delete → 同じ id で再作成）:

| 試したこと                             | 結果                                 |
| -------------------------------------- | ------------------------------------ |
| 削除と再作成が同じ sync に入る（通常） | 消えない。内容も新しい方へ更新される |
| 削除と再作成が別々の sync に分かれる   | 一度消えるが、再作成が届いて戻る     |
| 再作成の時刻が削除と同じ秒（ミリ秒 0） | 消えない                             |

理由は2つあって、どちらもソースで裏が取れている:

- `sync.ts:64` `deduplicateEntries` が (テーブル, id) ごとに**最後のエントリだけ**を
  残す。同じ sync に入った DELETE→INSERT は INSERT に畳まれ、削除はそもそも伝わらない
  （受け取る側の `_tombstone` にも何も残らない）
- 別々の sync に分かれても、`_tombstone.deletedAt` はトリガーの `datetime('now')` で
  **秒に丸められる**のに対し、再作成の `updatedAt` はその後の時刻。丸めは常に切り捨て
  なので再作成が必ず勝ち、`applyInsert` の tombstone 判定（`conflict.ts:98`、同時刻なら
  削除が勝つ）には掛からない
- フルマージ経路も `sync.ts:401-408` が「リモートに現存する行の tombstone は無視する」
  ので同じ

**差分更新は巻き戻さない。** 根拠が §1 から §3 へ移るだけで、やっていること
（残るものは id ごと残す）は正しい:

- 保存のたびに作成日時が「今」へ戻るのを止める（§3）— これは実在した
- 担当（`userId`）が保存のたびに書き換わるのを止める
- 1回の保存で全行の削除と挿入を変更履歴へ流すのをやめる（消失は生まないが、
  相手側の全行 UPDATE を毎回引き起こす）

**#1126 §1 の記述は事実と違うので、issue 側を直す必要がある。**

確認済みの事実（ソースを読んだ結果）:

- `setup.ts:41` `setupChangelog` はトリガーを張るだけ。**既存行を `_changelog` へ
  投入しない**
- `changelog.ts:60` `hasChangelogGap` は `lastSeenId === 0`（その相手と初回）のとき
  `false` を返す。**初回接続でもフルマージは走らない**

つまり #1126 §4「アップグレード前の既存行は伝搬しない」は事実。ただし §2 を直した
いま、issue が「実害が小さい」とした根拠（＝開けば伝わる）の方が消えている。
**#1126 にこの変化を追記する必要がある**（バックフィルは `setupChangelog` の仕事なので
ライブラリ側の課題）。

**2. `getCurrentUser` の暫定実装を消した（#1127 の積み残し）**

`electron-src/lib/prisma/user.ts:16` は `prisma.user.findFirst()` を返す暫定実装で、
`// TODO: Implement actual current user retrieval logic` が付いたままだった。残っていた
呼び出しは2箇所で、どちらも **「誰かがログインしているか」の門番**にしか使っておらず、
`userId` は書き込みへ渡していなかった。ところが `findFirst()` は**誰もログインして
いなくても非 null を返す**ので、門番として機能していなかった。

| 場所                                             | 置き換え                                      |
| ------------------------------------------------ | --------------------------------------------- |
| `02-template/hooks/useCropRegionSave.ts`         | フックの中で `useAuth()` を読む（引数を廃止） |
| `src/app/exams/[examId]/03-region-info/page.tsx` | `useAuth()` の `user` で保存を止める          |

`useTemplateData` の取得と `InitialDataState.currentUser` も要らなくなったので消し、
`getCurrentUser` 本体・`get-current-user` チャンネル・preload の口を**丸ごと削除**した。
認証の再設計は要らなかった。#1127 が「前提になる」と書いた部分（`ownership-and-sharing-design.md`
の段階1）はこれで片付いている。同書 §2.4 の「別人として記録されうる」という記述も
実態と違ったので直した。

**3. 規約の穴を塞いだ**

| 穴                                                                       | 塞ぎ方                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `queryKeyConventions.test.ts` が `setQueryData` の書き込み側を見ていない | 同じキーを読む側の形に収まるかを型検査器で照合する。誰も読まないキーへの書き込みも見る         |
| §7 の「チャンネル突き合わせ」「値 import 走査」が未実装                  | `ipcBoundaryConventions.test.ts` を新設（登録 277 / 呼び出し 277・死んだチャンネル 0・値 7件） |
| §7 の「Decimal 走査」                                                    | **置かない。** 下記の理由で書き忘れという状態が作れない                                        |

`queryKeyConventions.test.ts` は型検査器が要るので Program を1つ作る（走査込みで約5秒）。
検査が実際に落ちることは、書き込みの形を壊す・チャンネルの呼び出しを消す・許可一覧から
1件抜く、の3通りで確かめた。

**Decimal 走査を置かない理由。** 境界（`registerChannel`）が戻り値へ一律に
`serializePrisma` を掛け、preload の `invoke` が型に `Serialized<>` を掛ける。
ハンドラ側に選択肢が無いので「掛け忘れたハンドラ」が存在できない。§7 が数えていた4件は
`success` の union が絞れないことによる見かけの残存で、エンベロープを畳んだ時点で消えた。

**値 import の許可一覧はテストの中にあった**（`ALLOWED_VALUE_IMPORTS`）。「純粋計算なら
良い」という判断基準は書かない、という扱いだったが、段階14 で6モジュールを
`src/lib/shared/` へ出して**一覧ごと消えた**（例外なし）。

**4. 動作確認を e2e として足した**

今回直したものの大半は型でもユニットテストでも出ない。基盤は既にあった
（`npm run test:e2e`、`__tests__/tests/electron/`、`helpers/launchApp.ts` が一時データ
ディレクトリで新規インストール状態を作る）。

全て `__tests__/tests/electron/queryCacheRegressions.spec.ts` に置いた。**7本すべて実際に
通っている**（既存の解答用紙作成1本を含む）。

| #   | 何を確かめるか                                           | 出所              |
| --- | -------------------------------------------------------- | ----------------- |
| 1   | 04 を開いてから 03 へ移っても 03 の画面が出る            | 段階7 #6          |
| 2   | 08 で出力設定を変え、07 へ移って戻ると、変えた設定のまま | 段階8 (1)         |
| 3   | 資料の概要 → 評価項目 → 概要 を往復しても、どちらも出る  | 段階7 #1          |
| 4   | 解答用紙で編集 → 概要 → 作成 と戻っても編集が残る        | 段階8 レビュー #1 |
| 5   | 一覧に担当の切り替えがあり、担当の列が出る               | #1127             |
| 6   | 未ログインで 07 を開くとログインへ戻る                   | 段階8 レビュー #9 |

下ごしらえ（試験を作る・模範解答を1枚上げる・資料を作る）は
`helpers/fixtures.ts` に置いた。**DBへ直接書かず画面から作る** — 画面が実際に通る経路を
確かめるため。

**同じ作業ツリーで開発用サーバーが動いていても走るようにした。** 以前は 3000番を
`reuseExistingServer: true` で再利用していたので、隣のセッションの dev サーバーが居ると
**そちらのコードに対してテストしてしまう**状態だった（2026-08-13 に実際に起きて、
一度も走らせられなかった）。分けたのは2つ:

| 何       | どう分けたか                                                                     |
| -------- | -------------------------------------------------------------------------------- |
| ポート   | 既定 3123（`helpers/rendererPort.ts`）。アプリ側は `SCORE_AT_ONCE_RENDERER_PORT` |
| ビルド先 | `NEXT_DIST_DIR=.next-e2e`（`next.config.js` が env を見る）                      |

`.next` を共有したままポートだけ分けても、2つの `next dev` が同じ成果物を奪い合う。

> **`npx vitest run` の後は** better-sqlite3 が node 向けにリビルドされている。
> `npm run test:e2e` の globalSetup が Electron 向けへ戻すが、その後 vitest を走らせると
> また node 向けへ戻る（どちらの入口も自動で面倒を見るので、順に走らせるぶんには問題ない）。

---

### 段階9 — 3回目のレビューと、そこで変わった前提（完了・保留は段階11以降へ）

`51f6afd0..HEAD`（7コミット・71ファイル）を対象にレビューを回し、10件が確認された。
**大半は段階7〜8 で入れた回帰**である。

#### いちばん効いた原因: キー配列を依存配列へ入れた

段階8 で「書き込みは楽観更新 → 失敗したら `invalidateQueries`」へ揃えたとき、
`invalidateQueries({ queryKey })` を catch へ足しながら、**`queryKey` を `useCallback` の
依存へ機械的に足した**。

```ts
const queryKey = queryKeys.exam.exportSettings(examId) // 毎レンダー新しい配列
const flush = useCallback(..., [examId, queryClient, queryKey]) // 毎レンダー別物になる
useEffect(() => () => void flush(), [flush]) // 「アンマウント時だけ」が毎レンダーに化ける
```

`queryKeys.*(id)` は**毎レンダー新しい配列**を返す。依存に入れた時点でコールバックが不安定に
なり、アンマウント時だけ走るはずの後始末が毎レンダー走る。結果、**効いていたデバウンスが2つ
とも死んだ**（08-export の出力設定・資料 04-scores の点数）。履歴で確認したとおり、
どちらも段階8 の前は正しく効いていた。

`react-hooks/exhaustive-deps` は「足せ」としか言わない。**足したことで関数が不安定になる**方は
警告しない。むしろ足さないと警告が出る。

> **恒久策の候補**: `queryKeys` の各エントリが毎回同じ配列を返すようにする。そうすれば
> 依存へ入れても安定するので、同種の事故が構造的に起きなくなる。

#### 直したもの

| #   | 内容                                                     |
| --- | -------------------------------------------------------- |
| 1   | 担当でない利用者に編集画面が出て、編集が黙って捨てられる |
| 2   | 認証の門番が未ログイン・復元中に黙って書き込みを落とす   |
| 4   | 04-scores が毎打鍵 IPC ＋ 失敗時に無限リトライ           |
| 6   | 担当を譲った後も owner/detail キャッシュが古い           |
| 7   | 子だけ変更すると解答用紙の更新日時が動かない             |
| 9   | 担当エラーが catch に飲まれて「見つかりません」になる    |
| 10  | 未ログイン e2e の遷移先が `/` でなく `/login`            |

**#2 は認証ゲートの一本化で直す。** これまで `ProtectedRoute` は 40ページ中16ページにしか
付いておらず、試験ワークフローでは 06・07 と試験詳細だけだった（`exams/[examId]/layout.tsx`
は `useAuth()` を読むがリダイレクトしない）。実際に踏むのは「未ログイン」より
**「認証ストアからの復元がまだ終わっていない窓」**で、これはログイン済みの利用者でも
毎回通る。ゲートを1つ置いて全ページを同じ形で包み、`isLoading` の間は中身を描かない。
未ログインの飛び先は `/login` 直行にする（従来は `/` 経由の二段で、#10 の不安定さの元）。

#### 保留（このブランチでは直さない）

| #   | 内容                                           | なぜ保留か                                                   |
| --- | ---------------------------------------------- | ------------------------------------------------------------ |
| 3   | 08-export のデバウンスが死んでいる             | 設定を意図へ割ればデバウンスごと不要になる。暫定対応は捨て札 |
| 5   | 担当でなくても他人の解答用紙にタグを付けられる | 担当者ガードを境界の共通処理へ寄せるときに一緒に塞ぐ         |
| 8   | 観点間制約が無条件 upsert                      | 「必要最小限の更新を各所へ広げる」方向自体を取り下げた       |

> **⚠ このブランチは現状のままではマージできない。** #3 を保留にしたため、08-export は
> **設定を1文字打つたびに20〜30行を upsert する**状態が残っている（`upsertExamExportSettings`
> が重ね描きスタイル・採点状態7行・統計の表示可否・本体を無条件に書くため）。
> 段階8 で入れた回帰なので、マージ前に必ず解消すること。

#### デバウンスの棚卸し（2026-08-13 時点）

**方針: デバウンスは原則入れない。入れてよいのは入力欄で、本当に必要なときだけ。**

書き込みが重いからデバウンスする、という順序が逆だった。**書き込みを意図へ割れば1回1
レコードになり、デバウンスの理由が消える。** そうすれば即時書き込みにでき、強制終了でも
直前の操作まで残る。`onBlur` 確定も候補に挙がったが、**リロードでは保証されず強制終了では
発火しない**ので、未保存の状態を作らない即時書き込みに劣る。

| 画面               | 引き金                                | デバウンス | 判断                                        |
| ------------------ | ------------------------------------- | ---------- | ------------------------------------------- |
| 資料 04-scores     | `EditableTable` の **blur 確定**      | 500ms      | **元から不要**。削除する                    |
| 08-export          | チェックボックス＋数値入力 `onChange` | 400ms      | 設定を意図へ割って撤去                      |
| 03-region-info     | ラベル・配点の `onChange`             | 1000ms     | 同上。タイマーを `useState` に入れている    |
| 成績 05-boundaries | ラベル・％の `onChange`               | 500ms      | 同上。**離脱時に flush せず捨てる**（下記） |
| 解答用紙 ASB       | 名前欄などの `onChange`               | **無し**   | 1打鍵ごとにツリー全体を保存している         |
| 07 要素移動        | ドラッグ                              | **無し**   | `debouncedUpdate` という名前だが中身は即時  |

#### 今回と無関係の既存不具合（別件で扱う）

| 何                                                           | 内容                                                                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `BoundaryEditor`                                             | アンマウント時にタイマーを捨てるだけで flush しない。最後の打鍵から500ms以内に画面を離れると黙って消える             |
| `useElementMovement.debouncedUpdate`                         | 名前が嘘。中身は即時（コメントにも「デバウンスなし」と書いてある）                                                   |
| `setExamTags` / `setCourseworkTags` / `setSubtotalGroupTags` | タグの集合を全消し→作り直し。`setAsbDefinitionTags` と同じ形（そちらは修正済み）。意図へ割れる                       |
| `replaceGradeItemBoundaries`                                 | 名前のとおり本来バルク。必要最小限の更新を持たせる側                                                                 |
| `ALLOWED_VALUE_IMPORTS` と `eslint.config.mjs` の例外一覧    | 二重管理。粒度が違う（テストはモジュール＋シンボル、eslint はファイル）ので機能は重複しないが、増やすとき2箇所を触る |
| #1126 への追記                                               | §1 の前提が実測で否定され、§4 の「実害が小さい」の根拠も §2 修正で消えた。issue 編集は指示待ち                       |

### 段階10 — 読み書きを `src/queries/` へ集める形を確立する（完了・R1 修正済み）

**規約の本文は [coding-style.md](./coding-style.md) の「データの読み書き」章にある。**
ここは**手順と残量**を持つ。この節だけを読めば作業を続けられるように書く。

#### なぜこの形にしたか（結論だけ）

SQLite に複数テーブルを同時更新する SQL は無い（実測）。だから「木をまるごと保存」は
最初から N 個の操作で、**N を決めるのは利用者の操作**。main が推測してはいけない。
そこから、読みは木・書きはレコード → IPC は実体ごと → renderer はキーとチャンネルを
隠す、が導かれる。

#### 目標形

```
コンポーネント（.tsx）           ← useQuery / useMutation を呼ぶ唯一の場所
  ↑ import
src/queries/<domain>.ts          ← window.electronAPI と キー はここだけ
  ├ xxxQuery(id)      = queryOptions（キー ＋ 呼び出し）
  └ xxxMutation(id)   = defineMutation（呼び出し ＋ meta ＋ scope）
src/queries/queryClient.ts       ← 無効化と失敗トーストの実装（1箇所）
src/queries/keys.ts              ← 前方一致の「まとまり」だけ
```

- フックは**データを引数で受け取る**。取らない・書かない
- 計算は**純粋関数**。`useMemo` は React 側の都合があるときだけ
- `src/queries/` は **`electron-src/preload-apis/` と1対1**（23ファイル）

#### 試作で確かめたこと（2026-08-14・`e3f12a91` / `8e2c7b0e`）

対象は成績の除外切り替え（`useGradeItemExclusions` → `src/queries/grade.ts`）。
**-98行 / +59行**、フック1つが消えた。

| 確かめたこと                       | 結果                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `meta` を型で必須にできるか        | **できない。** ライブラリが `meta?:` と optional 宣言。`defineMutation` を唯一の入口にして塞ぐ                   |
| 画面ごとの文言でトーストを出せるか | できる（`meta.errorMessage` → `MutationCache.onError`）                                                          |
| 連打したときの取り直し回数         | **10回書けば10回**。`isMutating({ mutationKey })` でまとめて **1回**へ                                           |
| `scope` をレコード単位にできるか   | **できない。** 格子のマスごとに `useMutation` が要り、フックはループ内で呼べない。`invalidates` と同じ単位で取る |

#### 罠（同じところで詰まらないために）

- **`git ls-files` は追跡済みしか返さない。** 新規ファイルが検査を丸ごと素通りする。
  走査は `--cached --others --exclude-standard` を使う。かつ **`--others` は `**` を
  含む pathspec と噛み合わない**（`src/queries/` のようにディレクトリで指定する）
- **`useQuery(xxxQuery(id))` は、オブジェクトリテラルを探す走査に映らない。**
  移行するほど既存の検査が空洞化する。`queryKeyConventions.test.ts` は
  `src/queries/` の定義を先に読んで結びつけている
- **`queryOptions` の `DataTag`** により `setQueryData(query.queryKey, v)` は型検査される。
  移行が済んだ範囲では、走査より型のほうが強い

#### 手順（1ドメインずつ）

1. `src/queries/<domain>.ts` を作る（対応する `preload-apis/<domain>Api.ts` を見る）
2. 取得を `queryOptions` へ。キーは `scopeKeys` から組み立てる
3. 書き込みを `defineMutation` へ。`meta.invalidates` と `meta.errorMessage` を書く
4. 呼び出し側（コンポーネント）を `useQuery(...)` / `useMutation(...)` に直す
5. **消すフックが何を守っていたかを数えてから消す。** 空になったフックは消してよいが、
   フックは取得と書き込み以外のものを抱えていることが多い。R1 の10件中**6件**が
   これを引き継がなかった事故だった（下表）。数え終わるまで消さない
6. 残すなら、データを引数で受け取る形にする
7. `ipcBoundaryConventions.test.ts` の `NOT_YET_MIGRATED` から**その分を削る**
8. `npm run check-all` → `npx vitest run` → 必要なら `npm run test:e2e`

**フックが抱えていた「取得と書き込み以外」の実例**（R1 で全て実害になった）:

| 種類                     | 消えた例                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| 保存文字列への**符号化** | `useUserPreference` の `serializePreference` / `parsePreference` の対 |
| 保存前の**絞り込み**     | 境界の `debouncedSave` が空ラベルの行を保存しなかった                 |
| 既定値の**種まき**       | 資料の `toDraft` が文字評価へ切り替えた項目に A/B/C を作っていた      |
| 進行中フラグの**範囲**   | `isUploading` が PDF 変換中も覆っていた                               |

**この手順は段階11以降でもそのまま使う。**

**段階10 の完了条件**（達成済み）: 移行の形（`queryOptions` / `defineMutation` / `meta` の
判別ユニオン / 3つの規約テスト）が固まり、`grade` `coursework` `student` `classroom` `tag`
`user` `subtotal` `auth` `settings` `sync` `auditLog` `misc` `pdfTools` `archive` と
**試験の 01〜06** が移り終わっていること。

残り（07・08・ASB・端数）は**段階11以降**へ送る。`NOT_YET_MIGRATED` を空にするのは段階14。
理由は「同じ形を28回繰り返す作業なので、**大量複製の前に一度レビューを通す**」ため。

#### 残量

一覧の実体は `__tests__/renderer/ipcBoundaryConventions.test.ts` の `NOT_YET_MIGRATED`。
**これが減っていくのが進捗**である（数値は下の「進捗」節に置く）。

#### この移行で一緒に片付くもの

| 課題                               | どう片付くか                                            |
| ---------------------------------- | ------------------------------------------------------- |
| 段階9 #3（08-export のデバウンス） | 撤去済み（段階12。設定も行ごとの意図へ割った）          |
| 段階9 #5（タグの担当者ガード漏れ） | 書き込みが `src/queries/` に集まるとガードも1箇所       |
| `.tsx` からの直接 IPC 呼び出し     | 定義上ゼロになる                                        |
| 業務データの `$transaction`        | 意図へ割ると要らなくなる（並べ替えとバルクを除く）      |
| **複数 IPC を束ねた読み**          | **解体する。** main に束ねる1本を足すのではない（下記） |

**束ねた読みは解体する。** 当初は「main に画面の木を返す1本を足して吸収する」と書いて
いたが、実際にやったのは逆で、`queryFn` は境界の返り値をそのまま返す形へ割った
（03・04・05・試験詳細・認証）。束ねた入れ物をキャッシュへ載せると、1レコードの
書き込みに対して取り直す先が派生物になり、楽観更新へ追い込まれるからである。

**例外は 06 の `getStudentAnswersDataset` だけ。** これは main 側の1チャンネルが
受験生徒＋模範解答ページ＋配置済み答案を返すもので、renderer が複数の呼び出しを
束ねているわけではない（`queryFn` は1本を素通ししている）。

#### 決めたこと（2026-08-14）

未決3件を実測して決めた。**3件のうち独立した問題は1件だけだった。**

##### 1. 独自宣言の DB 行らしい型 — 直す（対象は19件）

`id: string` を持つローカル宣言を全走査すると **105件**ある。「DB 行らしいか」を
人力で判定すると必ず揉めるので、**プロパティ名の集合が1つの Prisma モデルの列の
部分集合になっているか**という機械判定を当てた。

| 群                                                      | 数  | 判断                                                         |
| ------------------------------------------------------- | --- | ------------------------------------------------------------ |
| アーカイブの版ごとの形（`src/types/*Archive.types.ts`） | 28  | **正しい。** ファイルの wire format で、版ごとに違う形を持つ |
| ASB 定義ツリー（`answerSheetDefinition.types.ts`）      | 5   | JSON 埋め込みの影。RDB 化で Prisma 型に変わる                |
| **DB 行の手写し**                                       | 19  | 直す                                                         |

UI の器（`WorkflowStep` / `TextBox` / `SeriesConfig` / `ImportedFile` / `DetectedRect` /
`*Sortable` / `RosterRow`）は1つも引っかからない。

**判定は完全ではない。** `LetterScaleDraft` は `{id, label, score}` が
`CourseworkLetterScale` と一致するだけで、`id` は DB に存在しない UI 専用の uuid
だった（保存時に落ちる）。**プロパティ名しか見ないので `id` の意味の違いは分からない。**
名指しの例外に入れる。

- 規約: DB 由来のデータの型は Prisma 型から導出する。手で書き写さない。`Pick` で
  絞るのも射影なので不可
- 例外は名指し: アーカイブ型 / ASB 定義型（RDB 化で消える）/ `LetterScaleDraft`
- 検査: `__tests__/renderer/rowTypeConventions.test.ts`（19件を直しきってから導入）

**手写しが隠していたもの**: `fetchUsers` は `prisma.user.findMany()` をそのまま返して
おり、**パスコードの bcrypt ハッシュが renderer へ渡っていた**。6箇所の手書き
`interface User` がそれを隠していた。renderer は `user.passcode` を読んでいないので
`omit: { passcode: true }` を足せば直る。

##### 2. 添字106件 — ASB 計画へ畳む

`majorIndex` / `subIndex` / `branchIndex` の全179箇所を数えたところ、**1件残らず
解答用紙作成だった**（13ファイル）。`asb-ipc-split-plan.md` の §6.1・段階2 が
「action ユニオンを id ベースにする」と既に書いている。段階10 に独立の規約は置かない。

##### 3. id を受け取って自分で取得16件 — 問題の名前が違った

props に `xxxId: string` を持ち自分で取得するコンポーネントは **27件**。中身は
page 直下の `*Container`（＝目標形そのもの）と、親が持っていない集合を取る
selector で、抜き取りで調べた範囲に**実際の重複は無かった**。

害があるのは「子が取ること」ではなく**同じ行に2つの鍵があること**。子が同じ
`queryOptions` を呼ぶ限りキャッシュは共有され、往復は増えない。したがって規則は
props ではなくキーに置く: **親が持つ木の一部を、別のチャンネルで取り直さない。**
`src/queries/` が preload と1対1で1チャンネル1 `queryOptions` である限り、移行時に
キーが2本生えるかどうかで露見する。

##### 4. 値 import の二重管理 — 例外ゼロにする（段階14 で完了）

`eslint.config.mjs`（読む側7ファイル）と `ALLOWED_VALUE_IMPORTS`（モジュール＋名前6件）
が別の単位で同じことを許可していた。**6モジュールを `src/lib/shared/` へ移した。**
main は既に `src/types/` から型を引いているので前例があり、移した結果
「src → electron-src は型のみ、例外なし」になって両方の一覧が消えた。

#### 進捗（2026-08-14 時点）

| ドメイン                                           | 状態                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `grade`                                            | **完了**（フック4つを削除・境界を行ごとに・デバウンス撤去）               |
| `coursework`                                       | **完了**（刻みを行ごとに・点数の束ね取りを解体・フック1つを削除）         |
| `student` / `classroom` / `tag` / `user`           | **完了**（薄いフック5つと表・モーダルの直接呼び出しを解消）               |
| `subtotal`                                         | **完了**（04 の束ね取得を解体・割り当ての書き込みを1本に）                |
| `auth` / `settings` / `sync` / `auditLog` / `misc` | **完了**（トークンと利用者一覧の束ねを解体）                              |
| `pdfTools` / `archive`                             | **完了**                                                                  |
| `exam` 系                                          | **完了**（07・08 は段階12 で移った）                                      |
| `scoring` / `drawing`                              | **完了**（段階12 で新設）                                                 |
| `answer-sheet-builder`                             | **完了**（段階14。[IPC 分割](./asb-ipc-split-plan.md)は前提ではなかった） |

**残り 0ファイル**（`NOT_YET_MIGRATED`。段階12 で 29 減り、段階14 で残り20 が消えた）。

| 場所                              | 数  | 送り先         |
| --------------------------------- | --- | -------------- |
| `components/answer-sheet-builder` | 10  | 段階14（完了） |
| `app`                             | 4   | 段階14（完了） |
| その他                            | 6   | 段階14（完了） |

`src/types/electron.d.ts` は `window.electronAPI` の**宣言そのもの**なので、残量では
なく `NOT_A_CALL_SITE`（名指しの例外）へ移した。

#### この間に決まったこと（実装済み）

- **`meta` は DB を書くかどうかで形が違う**（判別ユニオン）。書くなら `invalidates`
  必須、書かないなら `writesDatabase: false`。行き先は1つ以上のリスト。型テスト6件で固定
- **取得は境界の返り値をそのまま返す。** 束ねた入れ物・`Set`・並べ替えた配列を返さない。
  検査は `queryKeyConventions.test.ts`。既存の型規約をキャッシュの入口で見ているだけ
- **`passcode` の流出を止めた。** `fetchUsers` が bcrypt ハッシュごと返しており、6箇所の
  手書き `interface User` がそれを隠していた

#### R1（4回目のレビュー）の結果と、そこで分かったこと

`0e68a2f4..HEAD`（31コミット）を対象に回し、**10件**が確認された（9件 CONFIRMED、
1件 PLAUSIBLE）。上限10件のため掃除系の指摘は落ちている。

**10件のうち6件が同じ原因**だった。**消したフックが持っていた保証を引き継がなかった。**
「フックが空になったら消す」を手順どおりに実行したが、**消す前にそのフックが何を
守っていたかを数えていなかった**。手順5 に書き足した。

残りは (a) `useMutation` の戻り値を effect の依存へ入れたことによる自走ループ、
(b) 1打鍵ごとに書く入力欄と取り直しの競り合い、(c) 行ごとに割ったときに増えた
監査アクションの目録漏れ。

| #   | 内容                                                    | 直し方                                      |
| --- | ------------------------------------------------------- | ------------------------------------------- |
| 1   | 補正 effect が自走し補正 IPC が無限に飛ぶ               | `useEffectEvent` で包む                     |
| 2   | `clickScoringConfig` の読み書きで JSON の段数が食い違う | `useWritePreference` へ集約                 |
| 5   | 03 のラベル入力が取り直しに上書きされ DB に壊れた値     | 編集中の値をコンポーネントの state に置く   |
| 4   | 文字評価へ切り替えても変換表が作られず入力不能          | 切り替えた時点で A/B/C を作る               |
| 3   | 空ラベルの境界が保存され全生徒の評価が空欄              | 空の間は書かない                            |
| 10  | 設定の楽観更新が消え、往復するまで UI が動かない        | `useWritePreference` が先にキャッシュへ置く |
| 9   | `quickLogin` が取り直し前に遷移し `/login` へ弾かれる   | トークンを先にキャッシュへ置く              |
| 6   | 側パネルの折りたたみの保存形式が変わり既存値が失われる  | 同上（符号化を1箇所へ）                     |
| 7   | `isUploading` が PDF 変換中を覆わず二重投入できる       | 変換も覆う                                  |
| 8   | 新しい監査アクション6件が目録に無く「（不明）」になる   | 目録へ足す                                  |

**R1 の直し方を一度間違えた（記録として残す）。** 症状ごとに道具を足し、楽観更新を
7箇所へ入れた。これは `coding-style.md` の「**楽観更新は既定で書かない**」（段階10 の
`2d57f225` で自分が書いた規約）に正面から反していた。さらにその副作用を隠すために
新しい規約を足そうとした。**規約を読み直す前に道具を作ったのが誤り**である。

正しい形は決定どおり1つだけ:

> **キャッシュは DB の姿だけを持つ。操作している最中の値はコンポーネントの state。
> 書き込みは即時。**

編集中の文字（`""`・`8.`・重複ラベル）をコンポーネントが持つのは、DB に書けない値を
画面に出すためであって、書き込みを遅らせるためではない（`onBlur` 確定は段階9 で退けた）。

#### まだ数え直していないもの

**独自宣言の行型の一覧（19件）は下限である。** 判定が `id: string` を持つものしか見て
いないため、**平坦化して名前を変えた射影**（`CourseworkStudentRow` の
`courseworkStudentId` のような形）を1件も拾えていない。射影は普通その形を取るので、
実数はもっと多い。数え直しは「取得は境界の返り値をそのまま返す」の検査が効くように
なった後で行う（そちらが根を止めるので、残るのは props で運ばれる射影だけになる）。

---

### レビュー境界（この計画の残りをどう区切るか）

移行は反復作業で、**判断の誤りは次の段階でそのまま複製される**。区切りは「作業量」では
なく「**誤りが増える前に止められる位置**」で置く。

| レビュー | どこで                  | 対象範囲             | 結果             |
| -------- | ----------------------- | -------------------- | ---------------- |
| **R1**   | 段階10 の直後           | `0e68a2f4..9c0b94d4` | 10件。修正済み   |
| **R2**   | R1 の修正の直後         | `9c0b94d4..ecc776b0` | 10件。**段階11** |
| **R3**   | 段階11 の直後           | `2c42200f..59ef93fa` | 11件。修正済み   |
| **R4**   | 段階12 の直後           | `59ef93fa..f2010e08` | 12件。10件修正   |
| **R5**   | 段階14 の直後（13＋14） | `f2010e08..b501c3df` | 8件。修正済み    |
| **R6**   | 段階16 の直後（15＋16） | `9de34765..dfc516ee` | 15件。12件修正   |
| **R7**   | 段階17 の直後（ASB）    | `main...HEAD` 全差分 | 16件。修正済み   |
| **R8**   | 段階18 の直後           | 同上（R7 と同時）    | 同上             |

**R9 以降**（段階19〜22 の締め）は [remaining-work.md](./remaining-work.md) にある。

**R7 と R8 は1回で回した。** 段階18 が段階17 と独立（ASB を待たない）だったため、どちらの
締めも同じ時点に来た。対象も段階の差分ではなく `main...HEAD` の全差分にしてある — この計画は
同じ判断を 715 ファイルへ複製する作業なので、最後は枝全体で見ないと**複製された誤り**が
残る。**指摘は [branch-review-findings.md](./branch-review-findings.md) にある**（1件ずつ裁いた
記録）。**15件の報告に加え、調べる過程で1件（#16）が増えて16件になり、2026-08-20 に
全て手を入れた。**

---

#### R5（8件）で分かったこと

**3件は同じ根で、設定の符号化が1段ずれていた。** `setUserPreferenceMutation` は
「値を型のまま渡せば保存文字列に直す」約束なのに、読む側で `parsePreference` を
飛ばして生の保存文字列を解釈していた。採点状態色は**一切保存されず**（読むたびに
既定へ落ちる）、プリセットidは引用符ごと読めて選択の表示が一致しなかった。
書き込み側だけを見て読み込み側を確かめないと、型でもテストでも出ない。

直し方は**段を数える場所を1つにする**こと。`parseScoringStatusColors` が保存の
符号化ごと剥がすようにし、専用の presetId 読み手は消した（`parsePreference` で足りる）。
往復の検査を `__tests__/renderer/userPreferenceRoundTrip.test.ts` に置いた
（わざと戻すと2件落ちることを確認済み）。

**「失敗したら DB から蒔き直す」は、失敗では DB が変わらないことを踏まえて書く。**
08 の巻き戻しは「新しいデータが届いたら蒔き直す」条件だったので、**一度も発火して
いなかった**（取り直しても同じ参照が返る）。待つ対象はデータの変化ではなく
`invalidateQueries` の解決。同じ形の取りこぼしが学級トグルにもあった（失敗しても
押した状態が残り、保存済みに見える）。

**消してから作るを2つの書き込みに割ると、消す方の失敗が作る方を止められない。**
注釈の同期は、間で待たない（取り直しのちらつきを避ける）ために2つを続けて積んで
いたが、削除が失敗しても作成は走って注釈が二重に載っていた。1つの書き込み
（`replaceQuestionScoreAnnotationsMutation`）にすれば、順序も後始末も1回で済む。

**`isFetching` を「読み込み中」に使わない。** 背景の取り直しまで拾うので、
書き込みのたびに一覧が消える。最初の1回だけを見るなら `isPending`。

**紐付けを変えたらタグ一覧も取り直す。** タグ一覧は紐付けを利用先として同梱して
いる。指摘は解答用紙だけだったが、試験・資料・小計点グループも同じ形だったので
まとめて直した（7箇所）。

### R1・R2 で分かったこと（段階11 以降の前提）

**R1（10件）の6件は「消したフックが守っていたものを引き継がなかった」事故**だった
（手順5 に反映済み）。

**R1 の直し方を一度間違えた。** 症状ごとに道具を足し、楽観更新を7箇所へ入れた。これは
`coding-style.md` の「**楽観更新は既定で書かない**」（段階10 の `2d57f225` で自分が書いた
厳守規約）に正面から反していた。`ecc776b0` で全て撤去した。

**R2（10件）はその撤去の帰結**である。6件が同じ形をしていた:

> **いまの値をキャッシュから読んで、変えた値を書く**（read-modify-write）。
> 取り直しが終わる前に次の操作が来ると、直前の操作が無かったことになる。

**楽観更新を戻すのは誤り。** 原因は2つに分かれる。

1. **ジェスチャの途中を書いている。** ドラッグ中の60個の座標は60個の意図ではない。
   → `coding-style.md`「**ジェスチャは終わったときに1回書く**」を新設した
2. **書き込み経路が状態を運んでいる。** 04 の割り当ては
   `delete-crop-subtotals-by-crop-region-id` ＋ `create-many-crop-subtotals` で集合まるごとの
   置き換え、01 の並べ替えは絶対順序の送り付け。**古い集合を送るから壊れる**ので、
   待っても手元に持っても本質は直らない。意図（1行の追加／削除、1つ動かす）へ割る

---

### 段階11 — R2 の修正とジェスチャの統一（完了）

**renderer だけで直るもの**

| 対象                                                      | 直し方                                                   |
| --------------------------------------------------------- | -------------------------------------------------------- |
| 02-template のドラッグ（領域の移動・リサイズ）            | 途中は state、`pointerup` で1回書く                      |
| スライダー3箇所（1行の件数・透明度・デバウンス）          | `onValueChange` は state、`onValueCommit` で書く         |
| カラーピッカー3箇所（選択枠色・タグ・採点マーク）         | `<input type="color">` の `change` で書く                |
| `RegionDetailsTable` が blur で入力中の文字を捨てていない | `onBlur` で `forget`（他2画面と揃える）                  |
| 文字評価の種まきが `await`／`catch` されず二重化          | 呼び出し側で待つ。既存の刻みは取り直してから見る         |
| 境界のラベルを空に戻せない                                | 空を書けるようにする（保存はするが出力では扱いを決める） |
| 設定の符号化を変えたのに旧形式を移行していない            | 読む側で旧形式を受け入れる（`parsePreference`）          |
| `TagsPageContainer` の楽観更新の取り残し                  | 外す                                                     |

**main も要るもの（意図を運ぶ形へ割る）**

| 対象            | いまの形                           | 割った後                                        |
| --------------- | ---------------------------------- | ----------------------------------------------- |
| 04 の割り当て   | 領域の集合を delete-all → recreate | `create-crop-subtotal` / `delete-crop-subtotal` |
| 01 のページ移動 | 全ページの絶対 `pageNumber` を送る | 「この1枚を1つ動かす」                          |

**完了条件**（達成済み）: R2 の10件が全て塞がり、`grep setQueryData src/` が未移行画面
（07・08・設定・名簿）だけになること。

#### ジェスチャの置き場所

同じ規約を8箇所に書き写さないよう、途中の値を持つ部分は3つに畳んだ。

| 何             | どこ                                      | 終わり          |
| -------------- | ----------------------------------------- | --------------- |
| スライダー     | `src/hooks/useSlidingValue.ts`            | `onValueCommit` |
| 色             | `components/common/GestureColorInput.tsx` | 生の `change`   |
| 領域のドラッグ | `02-template/hooks/usePointerHandlers.ts` | `pointerup`     |

- **スライダーはコンポーネントでなくフックにした。** つまみの隣の数値表示
  （`5件` `50%` `300ms`）も動かしている間は手元の値に従わせる必要があり、
  つまみと数値の並べ方が画面ごとに違うため。
- **色は生の `change` を自分で聴く。** React の `onChange` は
  `<input type="color">` では `input` に対応するので、React 側からは確定を取れない。
- **手元の値は「書いた結果が返ってきたら」捨てる。** 終わった時点で捨てると、
  取り直しが着地するまでの一瞬だけ古い値へ戻って見える。

数は計画時の見積もりより多かった（スライダーは3ではなく4、色は3ではなく4）。
`ExportOptionsCard` の並列数と 07 の描画ストロークは段階12 に残る。

#### 規約の外側で見つけて直したもの

`useFillHandleDrag` が `setState` の更新関数の中から保存を呼んでいた。React が
更新関数を2度走らせることがあるので、1マス＝1レコードへ割った後は同じ行を2件
作りに行く（全消し→作り直しの頃は冪等だったので表に出ていなかった）。

#### 確かめていないこと

Chromium が色パネルの操作中に `change` を何回出すかは実機で測っていない。仕様
どおり確定時だけなら書き込みは1回に減るが、`input` と同数出す実装だとしても
規約どおりの形ではある（`scope` の直列化と取り直しの畳み込みは効く）。

→ **R3**

#### R3 の結果（11件・全て修正済み）

**11件すべてが段階11 で入れた回帰だった。** 大半は「割った・畳んだときに、
元の形が持っていた性質を判断せずに落とした」もので、R1 の6件と同じ形である。

**添字で実体を指した（2件）** — `AdjustingArea` を `areaIndex` で持ったため、
取り直しで並びが変われば別の領域を書き換える。しかも捨てる条件が「座標が完全一致」
だけだったので、書き込みに失敗すると次の無関係な `pointerup` がそれを書いた。
`cropRegionId` へ変え、「その領域がもう無い」「書けなかった」でも捨てるようにし、
書き出しは**いま終わったジェスチャが掴んでいたもの**に限った。

> 「[密行列UIの添字結合の罠](https://github.com/KeppyNaushika/score-at-once-electron)」で
> 一度学んだはずのものを、同じ画面の別の場所で踏んだ。**行・列・マスの同定は id。**

**一意でない列で索引を張った（1件）** — マスの状態を `小計id → 割り当ての行` の
`Map` で持った。当時 `CropSubtotal` に `(cropRegionId, subtotalId, assignmentType)` の
unique が無かったため、同期のマージで2行残りうる。索引が2行目を握り潰すので、
チェックを外しても外れないマスができていた。

> 無いのは規約が禁じているからではなかった（規約は「uuid 以外を unique にしない」で、この
> 3列は uuid 2つと固定値の区分）。張れば同期のマージが LWW で1行へ畳み、`CropSubtotal`
> は子を持たないので
> [sync-secondary-unique-hazard.md](./sync-secondary-unique-hazard.md) §3 の詰まりにも
> 当たらない。**段階30 で張った**（`20260823120000_subtotal_uniques_by_uuid`）ので、
> いまは2行残らない。

**索引そのものが要らなかった。** 行は `cropRegion.cropSubtotals` に実体で来ており、
マスを描く時点で手元にある。`Map` を捨てて直に読む形にすると、一意性の仮定も
`rowId`/`colId` への潰しも消えた（`useFillHandleDrag` も実体を運ぶ形へ）。

**冪等性を落とした（1件）** — `delete` は行が無ければ P2025 を投げる。望んだ状態が
既に成立しているのに失敗を告げるのは誤りなので `deleteMany({ where: { id } })` へ。
**`create` 側の存在チェックは足さない**（重複は同期が作りうるので、UI が耐えるのが
正しい。main に非 id の照会を足しても偽の安心が増えるだけ）。

**取り直しを畳めなくした（1件）** — `fillCells` が1マスずつ `await` していたため、
20マス塗ると20回の全体無効化が走っていた。`scope` は実行を直列にする一方、順番待ちの
間も `pending` に数えられる（`mutation.ts:212` で確認）。待たずに投げれば
`isMutating > 1` が効き、取り直しは最後の1件だけになる。

> **「まとめ書き」は取り戻さなかった。** 20マス＝20レコード＝20回書くのが決めた形で、
> 旧の4回は撤去した全消し→作り直しそのものである。

**一意でない列で隣を探した（1件）** — `moveExamPage` が `pageNumber` の `lt`/`gt` で
隣を決めていた。`pageNumber` は一意ではない（2台が同時にページを足すと同じ番号の行が
別 id で並ぶ）ので、同値を飛び越して2つ先と入れ替わる／端でもないのに動かない。
並びは他の経路と同じ `[{pageNumber},{id}]` で決め、入れ替えた後に 1..N へ振り直す
（**動いていない行は書かない**ので、通常は2行）。

> 全ページを見るが**踏み潰しには戻らない**。並びを作るのが renderer の古い一覧では
> なく、main が書く直前に読む DB だからである。IPC を渡るのは意図のまま。

**残り5件** — 手元の値が永久に残る類が2件（色の大文字小文字・`onCommit` に
「何もしない関数」を渡していた `ScoringSidePanel`）、`forget` が行の全欄を捨てて
いた1件、事実と逆のコメント1件、番号飛びを作れていないテスト1件。

### 段階12 — 採点(07)と出力(08)を移す（完了）

**対象 29ファイル**（`NOT_YET_MIGRATED` の `07-score-at-once` 18 と `08-export` 11）。
段階10 の「手順（1ドメインずつ）」をそのまま使った。

**完了条件**（達成済み）: `NOT_YET_MIGRATED` から `components/exams` が消える。
`grep -rn "window.electronAPI" src/components/exams/` は 0件。残りは 20ファイル。

#### 新しく置いた境界

| ファイル                 | 中身                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `src/queries/scoring.ts` | 採点行・裁定サマリ・採点担当・答案の白さ                          |
| `src/queries/drawing.ts` | 手書き注釈（4通りの取り出し方と CRUD）                            |
| `export.ts` へ追記       | プレビュー3種・書き出し・ストリーミング PDF の各段                |
| `subtotal.ts` へ追記     | `get/setSubtotalGroupSelection`                                   |
| `omr.ts` へ追記          | マーカー検出・一括認識・進捗の購読（フックの外から呼ぶ3つ）       |
| `misc.ts` へ追記         | `checkFileExists`（`<img>` の読み込みの中から呼ぶので関数のまま） |

`scopeKeys` に `annotation()` を足した。注釈は取り出し方が4通りあり、削除は id しか
受け取らないので、**書き込み側から「どの取り出し方が当たるか」を絞れない**。まとめて取り直す。

#### 解体した束ね取得と、消えた楽観更新

| 何                            | どうしたか                                                                 |
| ----------------------------- | -------------------------------------------------------------------------- |
| `useScoringDataLoader`（07）  | 試験＋答案＋設問領域の1キーを3つのクエリへ割った                           |
| `useExportPage`（08）         | 設定＋小計選択、試験＋受験者、をそれぞれ別のクエリへ                       |
| 07 の `questionScores`        | `useState` ＋ 楽観更新をやめ、`questionScoresForExamQuery` へ              |
| 08 の出力設定                 | デバウンス＋`setQueryData` をやめ、1操作＝1回の書き込みへ                  |
| `StatisticsClassroomSelector` | チェックの楽観更新を撤去（`updateExamClassroomMutation` へ）               |
| `useAnnotationBrowser`        | 一覧の `useState` を撤去。お気に入りと追加のあと手元の配列をつつくのもやめ |
| `useScoredAnswerPreview`      | 取得と画像デコードを分けた（キャッシュに載るのは main の行だけ）           |
| `useAnswerWhiteness`          | 「測ったページ」を覚える ref と state をやめ、キャッシュのキーへ           |

**07 の採点で楽観更新をやめられる根拠**（実測ではなく構造）:

- `create-question-score` は main が「生徒×設問×採点者」で引き当ててから作る（＝冪等）
- 書き込みは `scope: exam:<id>:questionScores` で直列。取り直しが届く前にもう一度
  打っても、2件目は1件目の行を見つけて更新する
- 連打の取り直しは `isMutating` が畳む（段階11 で確かめた）

#### 段階9 #3（デバウンス）の決着 — 設定も行ごとに割った

**デバウンスを撤去し、設定の書き込みも行ごとの意図へ割った。**

`saveExamExportSettings`（設定一式 → 6テーブル 20行以上を1つの `$transaction`）を
廃し、レコード1つにつき1本の口へ分けた。

| チャンネル                                  | 書く行                               |
| ------------------------------------------- | ------------------------------------ |
| `settings:setExamAnswerOverlayStyle`        | `ExamAnswerOverlayStyle`（種別ごと） |
| `settings:setExamAnswerOverlayVisibility`   | `ExamAnswerOverlayVisibility`        |
| `settings:setExamReportStatisticVisibility` | 統計の可視性（種別×母集団の1マス）   |
| `settings:setExamReportSettings`            | 個人成績表の設定本体（1試験に1行）   |
| `settings:setExamReportTableSection`        | 表の節（小計・設問）                 |
| `settings:setExamReportGraphSettings`       | グラフ設定（1試験に1行）             |

**UI は作り替えていない。** 設定コンポーネントは今も一式を返す（`onChange(next)`）。
書く直前に `exportSettingChanges.ts` が**前後を比べて変わった行だけを出す**。
意図ごとのコールバックへ作り替える案もあったが、そちらは入力欄ごとに「送り忘れ」が
起こりうる。1箇所で割れば起こしようがない。

割り方の要点:

- **行の値は引き算で決める**（同定 `id`/`examId`/種別 と履歴 `createdAt`/`updatedAt` を
  落とした残り）。列を並べて書くと、列を足したときに比較からも書き込みからも漏れる
- **設定本体の行は「他の行が持つものを引いた残り」で比べる。** オプションに項目が
  増えたら自動的にここへ入る。判断できないものは**書く側へ倒す**（落とすほうが害が大きい）
- **書けなかったら手元の種を捨てる。** 変わった行だけを書くので、失敗した1行は次の
  操作では拾われない。`onError` で seed を外し、DB の姿から蒔き直す
- 統計の種別・母集団の綴りは main で正規化する（`toStatisticKind`）。`STATISTIC_KINDS`
  は `electron-src` の値で renderer からは引けないため、文字列で渡って main が畳む

検査は `__tests__/renderer/exportSettingChanges.test.ts`（13件）。**壊した実装で落ちる
ことを実測した**（同定を無視しない／残りから `graphOptions` を引かない、で6件が落ちる）。

デバウンスが肩代わりしていた「直列化」と「取り直しの畳み込み」は、`defineMutation` の
`scope` と `MutationCache` が持つようになった。

#### ジェスチャ（段階11 からの持ち越し）

| 対象                         | 結果                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| 07 の描画ストローク          | 既にストロークの終端で1回書いていた（`useDrawingState` が途中を持つ）    |
| `ExportOptionsCard` の並列数 | **書き込みが無かった。** 画面内の `exportOptions` だけを動かすつまみで、 |
|                              | DB へは行かない。割る途中も終端も無いので、直すものが無い                |
| 採点マーク設定の色           | `InlineColorPicker` が段階11 の `GestureColorInput` を通っている         |

#### ついでに落とした死んだチャンネル

`get-question-score`（07 の楽観更新の巻き戻しだけが使っていた）と
`get-answer-sheets-by-exam-id`（`get-student-answer-images-by-exam-id` と**同じ関数**を
呼ぶ二重登録）を preload・ハンドラごと削除した。

`src/lib/queryKeys.ts` は `exam` / `grade` / `coursework` / `annotation` / `userPreference` /
`students` / `classrooms` / `returnDiff` が全て空き家になったので消した。残るのは段階14 の
4群（`answerSheetDefinition` / `roster` / `studentExamResults` / `classroomExamResults`）。

#### 検査の穴を1つ塞いだ

`__tests__/helpers/queryWrapper.tsx` が**素の `QueryClient`** を作っていたので、
テストでは `meta.invalidates` が一度も走っていなかった（`MutationCache` はアプリ側の
`createAppQueryClient` にしか無い）。「書いたのに取り直さない」状態で通っていたことになる。
アプリと同じクライアントを使うように直した。

→ **R4**

#### R4 の結果（12件・10件修正・1件は不要・1件は判断待ち）

**12件すべてが段階12 で入れた回帰だった。** R1・R3 と同じ「割った・畳んだときに、
元の形が持っていた性質を落とした」が半分、残りは**楽観更新を外したことで表に出た
往復の遅さ**である。後者は規約どおりに直すと消えるものと、消えないものに分かれた。

**手元の姿を DB へ戻すつもりが、古いキャッシュへ戻していた（1件）** — 書き込みに
失敗したとき seed のフラグだけを外していたので、レンダー時のガードが**取り直しの
着地前に**同じ（古い）キャッシュから蒔き直していた。以後 DB と食い違ったまま戻らない。
種は「どの試験の、どのデータから蒔いたか」で持ち、**新しいデータが届いてから**
蒔き直す形へ。

**同期で連続する `mutate` は、最後の1件しか失敗を知らせない（1件）** —
`MutationObserver.mutate` は毎回 `this.#currentMutation?.removeObserver(this)` で前回の
観測を外す（`query-core/src/mutationObserver.ts:134`）。「デフォルトに戻す」は最大10行を
一度に出すので、最後以外が失敗しても後始末が走らなかった。失敗は `mutate` の第2引数
ではなく **`mutateAsync` の拒否**で受ける形へ。

> 直前に「連打は `scope` と `isMutating` が畳む」と書いたが、**畳まれるのは取り直しで
> あって、観測子は畳まれない**。同じ口を続けて叩くときはコールバックを当てにしない。

**取得の順序で、空の採番学級が焼き付いていた（2件）** — `studentPlacements` はキーに
入らず取り直しの合図も無いので、採番学級より先にプレビューが走ると `{}` のまま固定され、
main が `memberships[0]` へフォールバックして**別の学級・別の出席番号**を描く。
プレビューは揃うまで走らせない（`enabled`）。書き出しは押した瞬間に `fetchQuery` で
解き直す（値ではなく関数で受け取る）。

**取り消しの2度目が消えていた（1件）** — 学級のチェックが往復を待つ間 `checked` が
変わらないので、取り消そうとした2度目のクリックが1度目と同じ値を送っていた。
キャッシュには書かず**押した値をコンポーネントの state に持つ**（段階11 の
`useSlidingValue` と同じ形。書いた値が返ってきたら捨てる）。

**待ってから積んだので取り直しが2回走った（1件）** — `syncElements` が削除を `await`
してから一括作成を呼ぶため、削除の後始末の時点で兄弟の書き込みがまだ無く、注釈の
まとまりが2回無効化されていた（1回目は**空になった DB** を読む）。`scope` が実行の
順序を保つので、**間で待たずに両方積む**（段階11 の `fillCells` と同じ）。

**残り** — デコード済み画像の溜め込み（ページが変わったら捨てる）、無効なクエリで
`isPending` が永久に true、`skipToken` を外した箇所の `enabled` 抜け。

**直さなかったもの2件**:

- **「試験が見つかりません」の通知（不要）** — 失われたのは汎用のトーストのほうで、
  `ScoringErrorState` が今も「• 試験情報が見つかりません」と理由を出している
- **採点1マスごとの取り直しの重さ（判断待ち）** — 下記

##### 積み残し → 段階13 で分かった、もっと手前の誤り

R4 は「1マス採点するたびに include 付きの9000行が IPC を渡る」を指摘した。**この
見立ては誤りだった。** 境界の `serializeScore` はスカラー8列しか返さないので、
include した木は IPC を渡っていない（main で組み立てて捨てている）。

さらに掘ると、**そもそも `QuestionScore` を根にした取得が要らなかった**。採点行は
07 が既に呼んでいる採点領域の取得に、子として含まれている。詳細は段階13。

取り直しの費用そのものは**まだ測っていない**。

### 段階13 — 07 の採点行を、採点領域の木から取る

**R4 の後に OWNER の指摘で分かった、段階12 の設計上の誤り。**

#### 何を間違えたか

段階12 で `questionScoresForExamQuery`（`QuestionScore` を根にした取得）を新設した。
しかし 07 が既に呼んでいる `getQuestionAnswerRegionsByExamId` の include が

```ts
const cropRegionWithSubtotalsAndScoresInclude = {
  examPage: true,
  cropSubtotals: { include: { subtotal: true } },
  questionScores: true, // ← 採点行は既に子として届いている
}
```

となっており、**同じ行が既にキャッシュへ載っていた**。境界（`serializeCropRegion` ＋
`ipcHandlerUtils` の `serializePrisma`）で Decimal も number へ直っている。

つまり `queryKeyConventions` が名指しで警戒している「**同じデータが別のキーで2度
キャッシュされる**」を、自分で作っていた。

**根の取り方も逆だった。** `QuestionScore` に `examId` は無いので、`QuestionScore` を
根にすると `cropRegion → examPage → examId` と**2つ上へ登る** `where` が要る。
`CropRegion` を根にすれば `examPage.examId` を1つ見るだけで、採点行は**下に**
ぶら下がる。これが「読みは木」の形である。

#### やること

- `questionScoresForExamQuery` を消す
- 採点行は `questionAnswerRegionsQuery` の木から読む。**平らにしない**
  （`flatMap` で潰すと、`(examStudentId, cropRegionId)` の2つで探し直すことになる。
  木のままなら「その設問の中を見る」ので照合は `examStudentId` だけで済む）
- `findQuestionScore` / `getScoringStatusFromArray` から `cropRegionId` の引数が消える
- 07 の `CropRegionWithExamPage`（`examPage` だけの手書き宣言）を境界の返り値から
  導く形へ直す。段階19 と同じ性質の是正

> **`Map` や `flatMap` で索引を作らない。** 段階11 の 04 で同じ間違いをして、
> 「索引そのものが要らなかった」と結論している。行は実体で手元にある。

#### 表示は変えない（OWNER 決定・2026-08-18）

**07 が出すのは「自分の採点」だけ。** include で他の教員の採点も手元には届くが、
画面には出さない。確定（裁定）は**将来の `07-2-finalize`** として別に立てる。
採点する場と、食い違いを裁く場を混ぜない。

したがって **`scoreResolution.ts` のリゾルバを 07 へ通さない。** あれは集計・出力系
（Excel・個人成績表・PDF・小計・成績連携）が使うもので、08 は既に全教員ぶんを1つに
畳んでいる。**07 だけが「自分のぶん」を見るのは設計であって漏れではない。**

#### 同じマスに2行あることがある

`QuestionScore` に `(cropRegionId, examStudentId, userId)` の unique がいま無い
（実際 `@@index([examStudentId])` しか無い）。同期のマージで2行残りうるので、`find` で
最初の1件を取ると2行目を黙って握り潰す。段階11 の `CropSubtotal` で実際に踏んだ形。
木のまま見れば、そのマスに何行あるかがその場で分かる。

無いのは規約が禁じているからではない。規約は「uuid 以外を unique にしない」で、この3列は
すべて uuid なので張ること自体は規約に反しない。ただし `QuestionScore` は子
（`DrawingAnnotation`）を持つため、いま張ると衝突時に勝った端末が外部キー違反で詰まり、
その相手からの以後すべての変更が届かなくなる
（[sync-secondary-unique-hazard.md](./sync-secondary-unique-hazard.md) §3）。**段階20** が
入るまでは張れず、実際に張るかどうかは**段階30** で判断する。

#### 検査

**採点経路を守る網が1本も無い。** e2e 9件はどれも採点しない。

e2e で採点まで到達させるには fixture が3つ要る（採点領域＝02 のドラッグ・受験生徒＝05・
答案画像＝06 のファイル名推測）。**今回の変更本体より大きい**ので、ここでは張らない。

代わりに**フック単位**で置く。危険は renderer 側の導出に集中しているため、そちらのほうが
安く狙いも正確である。

- `useScoringData` の**出力**（採点行と進捗）を固定する。内部が平らな配列から木へ
  変わっても出力は変わらないので、改修をまたいで生き残る
- 「他の教員の採点が混ざらない」「同じマスに2行あっても取りこぼさない」を明示的に置く

採点経路の e2e は、fixture を揃えるときに別途。

#### 測っていないこと

1マス採点するたびに木を取り直す費用は**実測していない**。R4 は「include 付きの9000行が
IPC を渡る」としたが、**これは誤り**で、境界がスカラーへ直すので渡るのはスカラーである
（`serializeCropRegion`）。残るのは main の join と行数で、体感に出るかは未確認。
**測ってから決める。**

**完了条件**: `questionScoresForExamQuery` が無くなり、07 が採点行を木から読むこと。
表示は1ピクセルも変えないこと。

#### この先に見えているもの（この計画の外）

**`07-2-finalize`**（仮）。採点する場（07）と、食い違いを裁く場を分ける。いまの
`ScoreDecisionPanel` はモーダルとして 07 に同居しているが、その前身と見るのが自然。
リゾルバ（`scoreResolution.ts`）が居場所を得るのはそこで、07 ではない。

この計画（IPC とデータ取得の移行）の範囲ではないので、着手はしない。**07 が自分の
採点しか出さない理由**をここに残しておく。

#### やったこと（完了・2026-08-18）

`questionScoresForExamQuery` を消し、IPC チャンネル `get-question-scores-for-exam`
と preload の束縛も落とした（読む側がいなくなった。main 側の
`getQuestionScoresForExam` は出力・返却差分が今も使うので残る）。

採点行は `cropRegion.questionScores` から読む。`findQuestionScore` は**採点領域を
そのまま受け取り**、`examStudentId` と `userId` で絞る。`cropRegionId` の照合は
消えた（その領域の中しか見ないので、照合する相手が無い）。`flatMap` も `Map` も
置いていない。

**取り直し先を採点領域へ向けた。** 採点の書き込み4本（作成・更新・確定・OMR 一括）の
`invalidates` は `cropRegionScopes(examId)`（`cropRegions` と `questionAnswerRegions`
の2本）になった。手動の取り直し（裁定パネル・OMR 取り込み後）も同じ行き先。

**型を境界から導いた。** `CropRegionWithExamPage`（`Prisma.CropRegionGetPayload` の
手写し）は、`examPage` しか宣言していないのに実体には `cropSubtotals` と
`questionScores` が載っていた。境界の返り値から導く `QuestionAnswerRegionRow` へ
置き換え（26ファイル）、採点行1件も `QuestionScoreRow` として同じ木から導いた。

> 手写しは**綴りの広さでも**ずれていた。`SerializedQuestionScore.status` は絞った
> ユニオン、境界の実物は `string`。取り直したことで初めてコンパイルエラーとして
> 出てきた。段階19 で潰す型の、これは1件目である。

`ScoringData/types.ts` の再輸出（`export type { ... }`）も落とした。規約どおり
各ファイルが本来の所在から取る。

#### 直したもの（表示の変更ではない）

**同じマスに同じ利用者の行が2つある場合**、`find` は先頭を取っていた。DB の返す
順に依存し、どちらが出るか決まらない。最後に書かれた行（更新時刻 → id）を採る
形へ変えた。集計側 `scoreResolution.ts` の `pickLatest` と同じ規則である。
行が1つの通常の場合は今までと同じ結果になる。

#### 検査

`__tests__/renderer/utils/questionProgress.test.ts` を木の形へ移し、
`__tests__/renderer/hooks/scoring/useScoringData.test.tsx` を新設した（フックの
**出力**を固定するので、内部が変わっても生き残る）。置いた性質は3つ:

- 採点領域に届いている行だけで数える（採点行を別に取りに行かない）
- 他の教員の採点は混ざらない／操作者が分からなければ誰の採点も数えない
- 同じマスに2行あっても取りこぼさない（並び順を入れ替えても同じ結果）

**わざと壊して効くことを確かめた。** 利用者の絞りを外すと2件、最新の選び方を
`scores[0]` に戻すと3件が落ちる。

採点経路の e2e は張っていない（fixture が3つ要る。この変更本体より大きい）。
1マス採点するたびに木を取り直す費用も**まだ測っていない**。

### 段階14 — `window.electronAPI` を `src/queries/` だけにする

**対象 19ファイル**＋境界の後始末。

1. **ASB 11ファイル**（`answer-sheet-builder` 10 ＋ `[definitionId]/layout.tsx`）。
   `src/queries/answerSheetBuilder.ts` を作る。触っている API は14本で大半が読み出し
2. **端数8ファイル** — `useClassroomExamResults` / `useStudentDetail` /
   `useStudentExamResults` / `useStudentAddPanel` / `useImportWizard` /
   `useStudentImportWizard` / `useNavigationHistory` / `useStudentImport` /
   `scoringStatusColors`
3. **共有計算6モジュールを `src/lib/shared/` へ移す**（段階10「決めたこと §4」）。
   `ALLOWED_VALUE_IMPORTS` と `eslint.config.mjs` の例外一覧が**両方とも消える**

4. **画面の目隠し（`ScreenBlackout`）の設定を `localStorage` 直読みから移す。**
   下記「段階12 で見つけた宿題」を参照

**ASB は IPC 分割を待たない。** 分割計画（`asb-ipc-split-plan.md` §12）が触る renderer
ファイルとの重なりは2つだけ（`AnswerSheetBuilderMainView.tsx` / `ImageElementEditor.tsx`）。

**完了条件**: `NOT_YET_MIGRATED` が空。**IPC 移行の完了。**

#### やったこと（完了・2026-08-18）

**`NOT_YET_MIGRATED` は空になった。`ALLOWED_VALUE_IMPORTS` と `eslint.config.mjs` の
例外一覧も消えた。** 移行の対象は20ファイル（見積りは19）で、内訳は ASB 11 ＋ 端数9。

新しく置いた口は2つ:

- `src/queries/answerSheetBuilder.ts` — 15チャンネル。DB を書く8つ（作成・保存・削除・
  複製・担当の受け渡し・取り込み・試験への変換）と、書かない7つ（ダイアログ・PNG／
  定義の書き出し・画像の出し入れ）を分けた
- `src/queries/navigation.ts` — 窓のセッション履歴（戻る/進む）

`archive.ts` には**取り込みの実行**を書き込みとして足し、下見（解析・事前照合・変換・
競合検出）は関数のまま出した。ウィザードは段ごとに失敗をモーダルの中に出すので、
`meta` を与えると同じ失敗が二重に知らされる。

#### 直したもの（表示の変更ではない）

| 何                       | 直る前                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| 履歴メニューの固有名     | このファイルが持つ `Map` に溜めっぱなしで、**試験の名前を変えても古い名前が残り続けていた** |
| 採点状態色               | モジュール変数 ＋ `window` イベントで配っていた。設定画面と採点画面が別々の写しを持っていた |
| 画面の目隠しの設定       | `localStorage` 直読み ＋ 自作イベント。**端末に付いていて、利用者に付いていなかった**       |
| 一覧のタグ               | 資料の概要でタグを変えても、一覧の行のタグは古いままだった（一覧が取り直されない）          |
| 試験アーカイブの取り込み | 取り込み後に取り直す先の宣言が無かった（一覧の更新は呼び出し側の後始末に頼っていた）        |

採点状態色と目隠しの設定は、どちらも `UserPreference`（KV）へ移した。設定画面と本体が
同じキャッシュを読むので、**変更を伝える自作イベントが要らなくなった**（`screenBlackout`
の3キーは新設。`scoringStatusColors` は元からあるキーで、読み方だけを直した）。

#### 決めたこと（食い違ったので書いておく）

- **共有計算の置き場所は `src/lib/shared/`。** 移したのは6モジュール（`examPaperSize` /
  `numericStats` / `itemAnalysis` / `spAnalysis` / `gradeDataSourceMaxScore` ＋
  それが値で引く `subtotalAssignments`）
- **`individual-report/types.ts` だけは `src/types/individualReport.types.ts` へ。**
  373行のうち定数は3つで、残りは両側が使う型。型は `src/types/` という規約が先にあり、
  `src/types/scoringStatus.types.ts`（main が `toScoringStatus` を値で引いている）と
  同じ形になる
- **書き込みの取り直し先は宣言のときに決まる。** 対象の id が実行時にしか分からない
  ものは、(a) その id を state で持つ画面が `xxxMutation(id)` を組む（担当の受け渡し）か、
  (b) まとまり全体を指す（複数件へのタグ付け。`addTagToExamsMutation` と同じ形）

#### 検査

`npm run check-all` 通過。`npx vitest run` 146ファイル / 1401件すべて通過。
`npm run test:e2e` 9件すべて通過（解答用紙の新規作成・編集の往復・担当の切り替えは
この e2e が踏んでいる）。

`useImportWizard.test.ts` の 47件は Provider が要るようになったので、`renderHook` に
`createQueryWrapper()` を被せた（テストの中身は変えていない）。

**測っていないもの**: 解答用紙の自動保存が1打鍵ごとに定義を取り直す費用。書き込みが
`detail` を無効化するので、保存のたびに読み直しが1往復増える。編集中の内容は画面が
自分の状態として持っている（種を蒔くのは1度だけ）ので表示は揺れないが、**回数は増えた**。
定義を実体ごとに割る段階15〜17 で自然に消える見込み。

#### 段階12 で見つけた宿題（`ScreenBlackout`）

段階12 の検証で e2e を回したところ **9件中9件が落ちていた**。原因は採点でも出力でもなく、
離席時の目隠し（簡易スクリーンセイバー）が**無限レンダーでアプリごと固まっていた**こと
だった。`b6d9386b`（段階10 の設定移行）由来で、**このブランチでは数段階にわたり e2e が
赤のまま誰も回していなかった**。

連鎖はこう:

```
setFullScreen（useMutation の戻り値・毎レンダー別物）
  → enterFullScreenIfNeeded → startTimer → 設定監視 effect（毎レンダー走る）
    → setSettings(新しい入れ物) → 再レンダー → 振り出しへ
```

**直したこと（段階12 で対応済み）**: 暗転の本体を `useEffectEvent` へ切り出し、
無操作タイマーを effect が持つ形にして `startTimer` を無くした。あわせて
`mutate` の取り出しと、設定が同じなら書かない（＝再レンダーの燃料を断つ）を入れた。

**残した宿題は2つ**:

1. **この画面には自動テストが1件も無い。** e2e は暗転まで踏まず、unit も無い。
   偽タイマーで「N分でロックする／操作で延びる／パスコードが無ければ暗転だけ」を
   固定する。jsdom ＋ Query のラッパー ＋ 利用者一覧のモックが要る（100行前後）
2. ~~**設定が `localStorage` 直読みで、`src/queries/` の外にいる。**~~ **済**（段階14）。
   3キー（`screenBlackoutEnabled` / `screenBlackoutTimeoutMinutes` /
   `screenBlackoutAutoFullScreen`）を `UserPreference` へ移し、自作イベントを外した

> **検査の穴**: `useMutation` の戻り値を依存配列へ入れる誤りを、この移行で**3回**
> 踏んでいる（R1 #1・R4・本件）。`react-hooks/exhaustive-deps` は依存が列挙されて
> いれば通るので止まらない。**列挙された依存が毎レンダー別物**であることを見る検査を
> 置くのが本筋（`useMutation(...)` の戻り値そのものを依存に入れるのを禁じる）。

### 段階15 — ASB: main を実体ごとに分解し、バルクを差分適用にする（済）

[asb-ipc-split-plan.md](./asb-ipc-split-plan.md) の **段階1**。

**利用者から見える不具合は、着手時点で既に直っていた。** 同書 §3.1 のデータ消失
（保存のたびに全消し→作り直し）は `40e1241f` / `0e68a2f4` で差分適用へ、§6.8 の
「開くだけで保存が走る」は編集画面の `persisted` で、§8.2 のタグの delete → recreate は
`setAsbDefinitionTags` の差分化で、それぞれ先に片付いている。

**この段階で入れたのは分解だけ。** 1つの関数が7テーブル分の列を知っていた状態を解き、
実体ごとのモジュールへ移した（`asbHeaderField` / `asbQuestion` / `asbCellElement` /
`asbCharGuide` / `asbOmrConfig`）。木をまるごと置き換える経路は
`asbDefinitionReplace.ts` の `replaceAsbDefinition` になり、**名前で「状態を運ぶ経路」だと
言う**（`save` のままだと日常の編集が再びここへ流れ込む）。

> **§5.2 の関数群を全部は書いていない。** 各モジュールが持つのは「行の組み立て」
> 「upsert」「残す id 以外を消す」の3つで、これはバルクが実際に使うもの。IPC が呼ぶ
> `create` / `update` / `delete` / `reorder` は**同じ行の組み立てを使って段階17 で足す**。
> 呼ばれない関数を先に20本置くと、検査も通らないまま残る。

**検査**: 並び順が詰まること（先頭を消しても穴が空かない）を `saveDiffUpdate.test.ts` へ。
落ちることを確認済み。

### 段階16 — ASB: 型と action を id 基準にする（済）

分割計画の **段階2〜3**。

- action は対象を id で指す。並べ替えだけは `orderedIds`（新しい並びは画面にしかない）
- 新しい実体は reducer でなく呼び出し側が作る。**作った id を呼び出し側が知らないと、
  対応する書き込みを組み立てられない**（段階17 の前提）
- 型を「自身の属性」（`Asb*Attributes`）と「子」に割った。更新の指示が
  `Partial<Asb*Attributes>` になり、子のまとまりが混ざらない
- セルの中身（テキスト・画像・OMR設定・文字位置マーカー）に自分の action を持たせ、
  親の更新へ配列ごと乗せるのをやめた
- 編集操作は `AsbEditorActions` 1つにまとめてフォームへ配る。大問→小問→枝問→セルと
  4層あり、1つずつ配ると同じ関数が素通りするだけになる

**決めたこと（計画からの差）**:

| 何                               | どうしたか                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `SET_RENDER_MODE` の統合         | **action ごと消えた。** 下記「描き分けは解答用紙のものではなかった」                              |
| `AsbCellParent` の置き場所       | `src/types/answerSheetDefinition.types.ts`。main も renderer も同じ言葉で親を指す                 |
| 子の `reorder`                   | **足さない。** セルの中身を並べ替える導線が画面に無い。作るときに action と IPC を一緒に足す      |
| 生 `dispatch` の封じ込め（§6.3） | 前倒しで済んだ。フックは `dispatch` を返さず、プレビューのドラッグも意図（id と値）だけを受け取る |

**ジェスチャ**: つまみとプレビューのドラッグは「離したときに1つの意図」になる。ただし
**この画面は途中の値もプレビューへ映す**ので、動かすのは編集状態、待たせるのは保存、と
切り分けた（`AsbGestureContext`）。つまみは用紙設定・罫線・ヘッダー項目…と深いところに
散らばっていて、行き先はどれも同じ1つなので context で渡す。

**完了条件**: `UPDATE_SUB_QUESTION` の payload に子コレクションが現れない → 満たした
（`AsbSubQuestionUpdate`。原稿用紙だけは「列数だけ」を触るので一部指定を許し、文字位置
マーカーは別 action）。

**検査**: `__tests__/answer-sheet-builder/editorActions.test.ts`（8件）。同じ位置の別実体を
巻き添えにしない・並べ替えは id の並び・原稿用紙の列数を変えても文字位置マーカーが残る、
など。最後のものは素直な `{...sub, ...data}` に戻すと落ちることを確認済み。

#### 描き分け（解答用紙／模範解答）は、解答用紙のものではなかった

段階16 の直後に OWNER から指摘があり、続けて直した。

`renderMode` は `AsbDefinition` の列で、解答用紙1枚ごとに「どちらの姿で見るか」を
持っていた。**しかしそれは見る人の作業の状態**で、解答用紙が持つ性質ではない。同じ
解答用紙を開いた別の教員が、前の人の見方に引きずられる理由が無い。

読み手を数えたら、実際に列を見ていたのは**書き出しの1箇所だけ**だった（試験変換は
元から両方の姿を明示的に描いて渡している）。そこで:

| 何                  | どうしたか                                                                           |
| ------------------- | ------------------------------------------------------------------------------------ |
| 描き分けの置き場所  | `UserPreference.asbRenderMode`（アプリ全体・利用者ごと）。`AsbDefinition` の列は撤去 |
| 書き出し（PDF/PNG） | **常に解答用紙と模範解答の両方**を出す。1ファイルに綴じるか2つに分けるかを選べる     |
| 分割の選択          | `UserPreference.asbExportSeparateFiles`。前に選んだものに従う                        |
| 「印刷」ボタン      | 撤去。中身は `printToPDF` で一時PDFを作って OS のビューアで開くだけで、PDF出力と同じ |

スキーマが変わるので migration（列の DROP）と ASB アーカイブ 1.3.0 ＋ 変換器を足した。
変換器がするのは旧アーカイブから `renderMode` を落とすことだけで、失われるのは
「最後にどちらの姿で見ていたか」に過ぎない。

> `localStorage` ではなく `UserPreference` にしたのは、段階14 で目隠しの設定を移した
> ときと同じ基準による——**端末に付くのか、人に付くのか**。

→ **R6**（段階15 と合わせて）

### 段階17 — ASB: IPC を割り、書き込みの関所を置く（済）

分割計画の **段階4〜5**。30本のチャンネル、包んだ dispatch ＋ 網羅 switch、自動保存
effect の撤去、バルクの `asb:replace-definition` への改名と4経路への限定。

`src/queries/answerSheetBuilder.ts` は段階14 に書いた薄い版から書き直した。**関所は
そこに置いた** — 編集の意図を1レコードの書き込みへ写す網羅 `switch` は、IPC を呼ぶ場所と
同じところに在るのが自然で、`assertNever` が「action を足して書き込みを書き忘れる」を
型で止める（実際に落ちることを確認済み）。

**決めたこと（計画からの差）**:

| 何               | どうしたか                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| 更新が運ぶもの   | その実体の**属性ひとそろい**。列を絞らないのは、行ごとの LWW では絞る利得が無く、`undefined` の二義性だけが残るため |
| 担当者ガード     | main が認証ストアから操作者を決める。**renderer が渡す `userId` は落とした**                                        |
| 監査ログ         | 1件ずつの編集は残さない（作成・削除・譲渡・取り込み・書き出しだけ）                                                 |
| デバウンス       | 置かない。規約「1回の入力で値が確定するなら即時に書く」に従い、待たせるのはジェスチャの間だけ                       |
| ジェスチャの途中 | 関所が溜め、離したときに**同じ対象の最後の1つだけ**を書く（`useAsbWriteGate`）                                      |
| main のファイル  | 1テーブル1ファイルへ割り直した（`asbQuestion.ts` → 3つ、`asbCellElement.ts` → 2つ）                                 |

**書き込みの失敗**: DB から読み直して画面を合わせる。手元の断面へ戻さない（同期で他の
教員の変更が入っている）。

**検査**: `recordWrites.test.ts`（9件）・`sliderGesture.test.tsx`（6件）・
`editorActions.test.ts`（12件へ増やした。渡る意図が属性ひとそろいで子を含まないこと、
隣とぶつかる配置が2つの意図になること、undo が丸ごとの復元として渡ること）。

→ **R7**（実施済み。指摘は [branch-review-findings.md](./branch-review-findings.md)）

### 段階18 — 設定の JSON を行へ割る（済）

**DB に残っていた「設定を持つ JSON」を無くした。** 完了条件（設定を持つ JSON 列が
無くなる／残るのは名指しの2件）を満たしている — 残っているのは
`ReturnSnapshot.scoresJson` と `AuditLog.metadata` だけで、どちらも対象外に名指しした
ものである。

#### 18-a `UserPreference` の3キー

| 何                           | 割った先                                          |
| ---------------------------- | ------------------------------------------------- |
| `scoringStatusColors`        | `UserScoringStatusColor`（利用者 × 採点状態）     |
| `clickScoringConfig`         | `UserClickScoringAction`（利用者 × クリック回数） |
| `sidePanelCollapsedSections` | `UserSidePanelSection`（利用者 × 節）             |

書き込みは**1回につき1行**。画面が引く形（状態で引ける配色など）は `useQuery` の
`select` で作り、キャッシュには行を載せる。色を1つ変えるとプリセットの記憶が外れる
ことは、同じトランザクションで守る（別々に書くと、外れたはずのプリセットが選ばれた
まま見える）。

節は**行が無ければ開いている**とし、開き直した節は `collapsed = false` の行として残す
（行を消す形にすると、開け閉めのたびに作成と削除が同期の変更履歴へ流れる）。

#### 18-b `GradeExportSettings.settingsJson`

`GradeIndividualReportSettings`（成績算出ごとに1行・19列）へ割った。試験側の出力設定
（段階12）と同じ形。

**画面の型も行そのものにした。** 入れ子の手写し型（`GradeReportOptions`）を撤去し、
画面は行を受け取って**変えた列だけ**を書く。この行にはヌル許容の列が無いので、
`Partial` で「載せていない」と「空にする」が衝突しない。

> **既定値が2箇所にある。** `schema.prisma` の `@default`（行を作るとき）と
> `DEFAULT_GRADE_REPORT_SETTINGS`（行がまだ無いとき画面が描く姿）。食い違うと
> **触っていない項目が保存した瞬間に変わる**ので、実際に行を作って突き合わせる検査を
> 置いた（`__tests__/grade/gradeReportSettings.test.ts`。片方を変えると落ちることを確認済み）。

アーカイブは 1.15.0 ＋ 変換器 `V1_14_0_to_V1_15_0`。読めなかった項目は既定で埋める
（保存された時点に無かった項目は普通に欠ける）。セクション名が変わるので、extractor は
**読めた方だけを載せる**（両方載せると新版が旧版に見えてデータを捨てる。境界のときと
同じ罠）。

#### 移行

どちらも手書き `migration.sql`。JSON から行・列へ移すところは、一時DBへデータ相当
（くるまれた保存値・古い生の値・壊れた値・旧いキー）を入れて確かめた。

- 18-a の id は SQL で uuidv4 を作る。各端末が独立に走らせるので同じ設定に別々の id が
  振られるが、`@@unique` 違反は sqlite-nas-sync が LWW で1行へ収束させる（20260803110000
  と同じ扱い）。同時刻タイで分岐しないよう時刻はミリ秒まで書く
- 18-b は**旧行の id と日時をそのまま引き継ぐ**。どの端末でも同じ id になるので、収束を
  待つ必要がない

**検査**: `__tests__/settings/userSettingRows.test.ts`（7件）・
`__tests__/grade/gradeReportSettings.test.ts`（4件）・変換器チェーン（1.14.0→1.15.0 の
4件を追加）・成績アーカイブの往復。

→ **R8**（R7 と同時に実施。指摘は [branch-review-findings.md](./branch-review-findings.md)）

### 段階19 以降 — [remaining-work.md](./remaining-work.md) へ

**まだ手を付けていないぶんは本書から出した。** 段階19（DB 行の手写し型の是正）、
ASB 段階6（原稿用紙のテーブル化）、段階20（同期で負けた行の子の引き取り）、段階21
（採点行の作成時点）、段階22（FK）と、判断待ちの2件は
[remaining-work.md](./remaining-work.md) にある。

**済んだことは本書に、これからのことはあちらに置く。**

---

## 7. 検証

型検査だけでは塞がらない部分をスクリプトで担保する。

**数値はここに書かない。** 検査が現在値を持つ。文書に固定すると必ず腐るうえ、腐って
いるかを確かめるのに毎回測り直しが要り、その測り方を間違える（実際に2度間違えた）。

| 検査                 | 内容                                          | 置き場所                           |
| -------------------- | --------------------------------------------- | ---------------------------------- |
| チャンネル突き合わせ | 登録と `invoke` の差分。死んだ登録も検出      | `ipcBoundaryConventions.test.ts`   |
| 読み書きの置き場所   | `window.electronAPI` が `src/queries/` だけか | 同上（`NOT_YET_MIGRATED`）         |
| 値 import 走査       | `src/` から `electron-src/` への値 import     | 同上（`ALLOWED_VALUE_IMPORTS`）    |
| キーの形             | `setQueryData` が読む側と同じ形を書くか       | `queryKeyConventions.test.ts`      |
| Decimal 走査         | 推論戻り値型に `Decimal` が残るチャンネル     | **置かない**（§7.1。作れない状態） |

いずれも TypeScript コンパイラ API による AST 走査で書ける。grep では `import * as path` や
複数行 import を誤判定するため不可。

### 7.1 Decimal 4件が「漏れ」ではなかった理由（解消済み）

```ts
const result = await getQuestionScoresForExam(examId, userId)
if (!result.success) {
  return result // ← ここが union 全体を返している
}
const scores = result.scores?.map(serializeScore) || []
```

`success: true` が `boolean` へ広がるため判別可能 union にならず、`!result.success` で絞り込めない。
結果、失敗用の早期 return が成功枝（Decimal 入り）の型まで引きずる。実行時にその枝へ値は入らない。

**段階4でこの4チャンネルが payload / `throw` になり、この現象ごと消えた。**
いまは境界が一律に `serializePrisma` を掛け、`invoke` が型に `Serialized<>` を掛けるので、
ハンドラ側に掛ける／掛けないの選択肢が無い。だから走査を置いても常に0で、
**検査として意味を持たない**（規約の穴ではなく、穴の作れない構造になった）。

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
