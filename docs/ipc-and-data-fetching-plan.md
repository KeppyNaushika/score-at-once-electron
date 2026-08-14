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

**値 import の許可一覧はテストの中にある**（`ALLOWED_VALUE_IMPORTS`）。「純粋計算なら
良い」という判断基準は書かない。増やすには OWNER の判断が要る。

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

### 段階9 — 3回目のレビューと、そこで変わった前提

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

### 段階10 — 読み書きを `src/queries/` へ集める（進行中）

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
5. **フックが空になったら消す。** 残るなら、データを引数で受け取る形にする
6. `ipcBoundaryConventions.test.ts` の `NOT_YET_MIGRATED` から**その分を削る**
7. `npm run check-all` → `npx vitest run` → 必要なら `npm run test:e2e`

**完了条件**: `NOT_YET_MIGRATED` が空になり、`window.electronAPI` が `src/queries/`
にしか無い状態。

#### 残量（2026-08-14 時点で138ファイル）

一覧の実体は `__tests__/renderer/ipcBoundaryConventions.test.ts` の `NOT_YET_MIGRATED`。
**これが減っていくのが進捗**である。

| 場所                                  | 数  |
| ------------------------------------- | --- |
| `src/components/exams`                | 54  |
| `src/app/(app)`                       | 19  |
| `src/components/grades`               | 12  |
| `src/components/answer-sheet-builder` | 10  |
| `src/hooks`（+ `hooks/grades` 4）     | 13  |
| `src/components/coursework`           | 7   |
| その他                                | 23  |

**勧める順**: `grade`（`src/queries/grade.ts` が既にある）→ `coursework` → `student` /
`classroom` / `tag`（横断で使われるもの）→ `exam` 系（いちばん大きい）→
`answer-sheet-builder`（IPC 分割と一緒にやる）。

#### この移行で一緒に片付くもの

| 課題                               | どう片付くか                                       |
| ---------------------------------- | -------------------------------------------------- |
| 段階9 #3（08-export のデバウンス） | 設定を意図へ割ると、デバウンスごと不要になる       |
| 段階9 #5（タグの担当者ガード漏れ） | 書き込みが `src/queries/` に集まるとガードも1箇所  |
| `.tsx` からの直接 IPC 呼び出し 197 | 定義上ゼロになる                                   |
| 業務データの `$transaction` 39     | 意図へ割ると要らなくなる（並べ替えとバルクを除く） |
| 複数 IPC を束ねた読み 12           | main に「画面の木を返す1本」を足して吸収する       |

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

##### 4. 値 import の二重管理 — 例外ゼロにする

`eslint.config.mjs`（読む側7ファイル）と `ALLOWED_VALUE_IMPORTS`（モジュール＋名前6件）
が別の単位で同じことを許可している。**6モジュールを `src/lib/shared/` へ移す。**
main は既に `src/types/` から型を引いているので前例があり、移せば
「src → electron-src は型のみ、例外なし」になり両方の一覧が消える。

#### 進捗（2026-08-14 時点）

| ドメイン                                 | 状態                                                              |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `grade`                                  | **完了**（フック4つを削除・境界を行ごとに・デバウンス撤去）       |
| `coursework`                             | **完了**（刻みを行ごとに・点数の束ね取りを解体・フック1つを削除） |
| `student` / `classroom` / `tag` / `user` | **完了**（薄いフック4つと `useClassroomManagement` を削除）       |
| `export` / `settings`                    | `src/queries/` を用意（消費側は移行中）                           |
| `exam` 系                                | 未着手（いちばん大きい）                                          |
| `answer-sheet-builder`                   | 未着手（[IPC 分割](./asb-ipc-split-plan.md)と一緒に）             |

**残量 100ファイル**（`NOT_YET_MIGRATED`）。

| 場所                              | 数  |
| --------------------------------- | --- |
| `components/exams`                | 54  |
| `app`                             | 19  |
| `components/answer-sheet-builder` | 10  |
| `hooks`                           | 6   |
| その他                            | 18  |

#### この間に決まったこと（実装済み）

- **`meta` は DB を書くかどうかで形が違う**（判別ユニオン）。書くなら `invalidates`
  必須、書かないなら `writesDatabase: false`。行き先は1つ以上のリスト。型テスト6件で固定
- **取得は境界の返り値をそのまま返す。** 束ねた入れ物・`Set`・並べ替えた配列を返さない。
  検査は `queryKeyConventions.test.ts`。既存の型規約をキャッシュの入口で見ているだけ
- **`passcode` の流出を止めた。** `fetchUsers` が bcrypt ハッシュごと返しており、6箇所の
  手書き `interface User` がそれを隠していた

#### 次に手を付けるもの

1. **`exam` 系の各段（01〜08）**。`src/queries/exam.ts` / `cropRegion.ts` / `scoring.ts` /
   `drawing.ts` / `examClassroom.ts` / `subtotal.ts` / `userExam.ts` へ割る。
   段階9 #3（08-export のデバウンス）と #5（タグの担当者ガード漏れ）はこの中で片付く
2. **`app` 配下 19ファイル**（各段のページ）
3. **`answer-sheet-builder` 10ファイル**。[asb-ipc-split-plan.md](./asb-ipc-split-plan.md)
   の段階1〜5と同時に行う。ここだけは main 側の分割が前提なので、単独では終わらない

#### まだ数え直していないもの

**独自宣言の行型の一覧（19件）は下限である。** 判定が `id: string` を持つものしか見て
いないため、**平坦化して名前を変えた射影**（`CourseworkStudentRow` の
`courseworkStudentId` のような形）を1件も拾えていない。射影は普通その形を取るので、
実数はもっと多い。数え直しは「取得は境界の返り値をそのまま返す」の検査が効くように
なった後で行う（そちらが根を止めるので、残るのは props で運ばれる射影だけになる）。

---

## 7. 検証

型検査だけでは塞がらない部分をスクリプトで担保する。いずれも現時点で 0 件なのでグリーンのまま導入できる。

| 検査                 | 内容                                      | 現在値              | 置き場所                           |
| -------------------- | ----------------------------------------- | ------------------- | ---------------------------------- |
| チャンネル突き合わせ | 登録と `invoke` の差分                    | 277 / 277・死 0     | `ipcBoundaryConventions.test.ts`   |
| 値 import 走査       | `src/` から `electron-src/` への値 import | 7（すべて許可済み） | 同上（`ALLOWED_VALUE_IMPORTS`）    |
| キーの形             | `setQueryData` が読む側と同じ形を書くか   | 違反 0              | `queryKeyConventions.test.ts`      |
| Decimal 走査         | 推論戻り値型に `Decimal` が残るチャンネル | 0（§7.1）           | **置かない**（作れない状態のため） |
| エンベロープ残存     | 契約 `.d.ts` の `success` 出現            | 契約ごと廃止        | —                                  |
| effect からの取得    | `useEffect` の本体に `window.electronAPI` | 112 → 7（§段階7）   | —                                  |

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
