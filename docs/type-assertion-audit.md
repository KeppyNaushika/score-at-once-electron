# 型アサーション（`as`）の全数調査と処方

## 1. 背景

`docs/coding-style.md` は「禁止事項」に次の2つを並べて挙げている。

> - **`any` の使用**: 原則禁止（ESLint で warn として検出）
> - **`as` の乱用**: 型ガードで解決できる場合は型ガードを使う

このうち `any` は `@typescript-eslint/no-explicit-any: "error"` で機械的に担保されているが（違反ゼロ）、
`as` を対象にするルールは1つも設定されていない。`consistent-type-assertions` も
`no-restricted-syntax` の `TSAsExpression` セレクタも無い。規約は文章としてのみ存在している。

その結果どうなっているかを全数で測ったのが本書である。

**`as` は 620 箇所あった**（調査時。2026-08-03 現在は 608 箇所 ── §4）。

本書の目的は件数を減らすことではない。`as` には**残すべきもの**と**型の食い違いを隠しているもの**が
混在しており、後者だけが実害を生む。**両者を分ける基準**と、**それぞれをどう直すか（型ガードを足すのか、
変数の取り方を変えるのか）**を確定させることが目的である。

---

## 2. 調査方法

TypeScript コンパイラ API で `src` / `electron-src` / `__tests__` 配下の `.ts` / `.tsx` を走査し、
`TSAsExpression` ノードを全件収集した。

- `as const` は除外する（型アサーションではなく const アサーション）
- `x as unknown as T` は**外側の1件**として数える（内側の `as unknown` は重複計上しない）
- アサート先の型テキストに加え、**アサートされている式**（`JSON.parse(...)` なのか変数なのか）まで
  記録し、出所で分類した

grep では `import * as path` や `as const` と区別できず、二重アサーションも二重に数えてしまうため、
本書の数字はすべて AST 由来である。

---

## 3. 判断の軸（本書の中核）

`as` を消す作業でコストを溶かす典型は次の3つで、いずれも**処方の選択を間違えた**ことによる。

1. **食い違いを隠している `as` に型ガードを足す。** 検査は常に真を返し、実行時コストと「検査済み」という
   嘘の安心だけが残り、歪んだ型はそのまま残る。**最悪の投資**である。
2. **出所は1つなのに、使用箇所ごとに型ガードを足す。** コストが箇所数倍になり、しかも「どこかで
   通し忘れる」余地が増える。境界の検査は**入口1箇所**に集約されて初めて意味を持つ。
3. **ライブラリの型が原理的に広いだけの箇所に検査を足す。** `Recharts` の tooltip payload に
   スキーマ検証を書いても、守っているのは自分のコードの中だけで、何も増えない。

処方を選ぶには、**その値がどこで型を失ったか**を見る。以下の3問で決まる。

### Q1. その値はプロセスの外から来たか

外（アーカイブのファイル、DB の列、外部フォーマット、ユーザー入力）から来た値は、**型を名乗る権利を
持っていない**。ここには実行時の検査が要る。ただし検査は**境界1箇所**に置く。

外から来ていない（自分のコードが作った値）なら、検査は不要である。型が失われているなら、それは
**上流の型付けの問題**であって、下流で検査しても直らない。

### Q2. `as` は「絞り込み」か「食い違い隠し」か

|        | 絞り込み                                      | 食い違い隠し                                                       |
| ------ | --------------------------------------------- | ------------------------------------------------------------------ |
| 形     | 実際にありうる値の集合を、型の上でも狭める    | 実体と型が別物なのを黙らせる                                       |
| 例     | `row.status as ScoringStatus`（DB は String） | `serializePrisma(row) as DrawingAnnotation`（実体は include 付き） |
| 外れ値 | **実行時に起こりうる**（DB 直書き・旧データ） | 起こりえない。ただの記述の誤り                                     |
| 処方   | **型ガード／境界コンバータ**                  | **型を実体に合わせる。型ガードは無意味**                           |

見分け方は「アサートを外したら型エラーの内容は何か」。
_余分なプロパティがある / 足りない_ なら食い違い隠し、_string を union に狭めている_ なら絞り込み。

### Q3. 直すべきは値の側か、型の側か

- **値の側**（＝変数の取り方を変える）: 上流で正しい型のまま受け取れるなら、そうする。
  `Prisma.XGetPayload<{ include: typeof fullInclude }>` を使う、ライブラリの宣言マージを使う、
  既存の境界コンバータを通す──いずれも `as` が**書けなくなる**方向であり、最も安い。
- **型の側**（＝型ガードを新設する）: 値の出所が本当に外部で、既存の検査が無いときだけ。

### 決定表

| 出所                            | 例                                       | 処方                                                      | 該当群 |
| ------------------------------- | ---------------------------------------- | --------------------------------------------------------- | ------ |
| 外部ファイル（アーカイブ JSON） | `JSON.parse(...) as T`                   | 実行時スキーマ検証を入口に1箇所                           | C      |
| DB の String 列（enum 代用）    | `row.paperSize as PaperSize`             | **既存の** `defineStringUnion` の `to` を境界で1回        | B      |
| DB の JSON 文字列列             | `JSON.parse(row.metadata) as Meta`       | C と同じ検証を流用                                        | D      |
| Prisma の include 付き行        | `result as DrawingAnnotation`            | **型を include に追随させる**（`GetPayload`）。検査は不要 | A      |
| ライブラリの拡張ポイント        | TanStack Table の `meta`                 | 宣言マージで型を入れる。検査は不要                        | E      |
| ライブラリの原理的に広い型      | Recharts payload, dnd-kit の id          | `as` を残す。受け口を1箇所に閉じる                        | H      |
| DOM API                         | `querySelector(...) as HTMLInputElement` | 外れうるなら `instanceof`、そうでなければ残す             | G      |

---

## 4. 分類と件数

「調査時」は 2026-08-02 の初回計測、「現況」は同じ AST スクリプトによる再計測。

| 群    | 分類                                                                  |  調査時 |    現況 | 処方                            |
| ----- | --------------------------------------------------------------------- | ------: | ------: | ------------------------------- |
| **A** | **Prisma include の食い違いを `as` が隠している**                     |       9 |   **0** | 型を include に追随させる       |
| **B** | **文字列 → literal union（境界コンバータの適用漏れ）**                |     143 | **141** | 既存 `defineStringUnion` を通す |
| C     | アーカイブ取り込み境界                                                |      75 |      77 | 実行時スキーマ検証（#1077）     |
| D     | DB の JSON 文字列列                                                   |       4 |       4 | C の仕組みを流用                |
| E     | ライブラリ拡張ポイントの未使用                                        |       6 |   **0** | 宣言マージ                      |
| G     | DOM 絞り込み                                                          |      22 |      22 | 大半は据え置き                  |
| H     | ライブラリの原理的に広い型                                            |      20 |      19 | 据え置き（受け口を1箇所に）     |
| I     | その他・慣例（reduce 初期値、widening 制御、生 SQL 結果、`keyof` 等） |     110 |     106 | 個別精査                        |
| F     | テスト                                                                |     231 |     233 | 別枠（§9）                      |
|       | **計**                                                                | **620** | **602** |                                 |

**A群と E群は解消した**（§5・§8）。C群と F群が増えているのは、同時期に入った採点マークの
持ち主の付け替え（#1135）で変換器とテストが増えたためで、悪化ではない。

E群の件数は初版から訂正してある。初版は 14 件としていたが、これは `EditableTable.tsx` の
`as` を丸ごと数えた値で、拡張ポイント（`meta`）由来は 6 件だった。残る 8 件は同じファイルにある
別群 ── DOM 絞り込み 2 件（G群）と、`reduce` の初期値・実装内部の境界 6 件（I群）である。
**ファイル単位で群を割り当てると処方を取り違える。** `as` は式ごとに出所が違う。

---

## 5. A群: include の食い違いを隠している（9件）— **解消済み（PR #1145）**

> **状態**: 9件すべて解消。以下は当時の記録として残す。処方どおり、型ガードは1つも足していない
> （`as` を外したら Prisma の推論がそのまま出口まで通った）。`as` を外して出た型エラーはゼロで、
> renderer 側は自前の `as` で埋め戻していたことが確認できた。

### 何が起きているか

`electron-src/lib/prisma/drawingAnnotation.ts` は、同一ファイルの中で**2つの流儀が混在**している。

```ts
// 4箇所: 境界コンバータを通す（正しい）
return serializePrisma(result).map(narrowAnnotationUnions)

// 7箇所: as で潰す
return serializePrisma(result) as DrawingAnnotation[]
```

後者の関数は、いずれも `include` を付けて取得している。

| 行  | include                        | 宣言している戻り値型        |
| --- | ------------------------------ | --------------------------- |
| 202 | `annotationWithAuthorInclude`  | `DrawingAnnotation[]`       |
| 367 | `annotationWithAuthorInclude`  | `DrawingAnnotation`         |
| 556 | `annotationWithAuthorInclude`  | `DrawingAnnotation \| null` |
| 580 | `annotationWithContextInclude` | `DrawingAnnotation`         |

`DrawingAnnotation` は include 抜きの1行型である。実体には `user`（および `questionScore` の文脈）が
乗っているのに、型からは消えている。`as` はその差を黙らせている。

`src/types/drawingAnnotation.types.ts` には `AnnotationWithAuthor` / `AnnotationWithContext` という
**include に追随する型が既に定義されている**。使われていないだけである。

さらに、`serializePrisma` の実装は `<T>(data: T): T` で**型を保存する**。つまり `as` を書かなければ
Prisma の推論がそのまま出口まで通る。`as` は「型を補っている」のではなく、**通っていた型を捨てている**。

### 同じ罠は一度踏んでいる

同ファイル 35-39 行のコメント:

> 以前は経路ごとに `select` の中身が違い、どこかで `examStudentId` を落としても
> `as` で潰した型が通ってしまい、注釈が実行時に消えていた。行をそのまま持つ。

include を SSOT に統一する対処は済んでいるが、**`as` で潰す側は残っている**。include を変えたときに
型検査が効かない状態が続いている。

### 同型の残り2件

```ts
// electron-src/lib/prisma/asbDefinition.ts:175
return dbToDefinition(row as DbDefinitionFull)
```

`row` は `include: fullInclude` の結果。`DbDefinitionFull`（同ファイル 34-64 行）は
**その include の形を 30 行かけて手書きで複製した型**である。規約の
「形の SSOT は取得側の include」「Prisma 拡張型（`GetPayload`）を使う」に正面から反しており、
`as` がその食い違いを検査不能にしている。`fullInclude` に列を足しても型は追随しない。

```ts
// electron-src/lib/prisma/pdfExport.ts:324
cropRegions as CropRegion[]
```

include 付きの行を Prisma 基本型へ縮小して渡している。余分を落とす方向なので実害は出にくいが、
呼び先が include 由来のフィールドを必要とするようになったときに気付けない。

### 処方（型ガードは使わない）

値は外から来ていない。**Prisma が返した型をそのまま出口まで通す**だけでよい。

1. `drawingAnnotation.ts` の7箇所: 戻り値型を `AnnotationWithAuthor` / `AnnotationWithContext` に直し、
   `as` を削除して `.map(narrowAnnotationUnions)` に揃える（union 列の絞り込みは B群の問題として別途必要）
2. `asbDefinition.ts`: `DbDefinitionFull` を
   `Prisma.AsbDefinitionGetPayload<{ include: typeof fullInclude }>` に置き換え、`as` を削除
3. `pdfExport.ts`: 呼び先の引数型を include 由来の型に合わせる

**この作業で型エラーが出たら、それが `as` の隠していた食い違いである。** エラーを消すために
`as` を戻してはならない。IPC 越しの利用箇所まで波及する可能性があるので、A群は
**「9箇所の書き換え」ではなく「9箇所が隠していた差の解消」として見積もる**。

---

## 6. B群: 文字列 → literal union（143件）

### 何が起きているか

SQLite に enum が無いため、値の集合が固定の列はすべて `String` である。規約はこれに答えを出している
（`docs/coding-style.md` §型管理の方針）:

> **string → literal union**: SSOT を 1 ファイルに。`const XS = [...] as const` → `type X` ＋
> 型ガード `isX` ＋境界コンバータ `toX(s): X`（想定外は安全な既定へ）。実行時は境界で `toX(row.status)`。
> **union をあちこち手書きしない。**

その土台は `src/types/stringUnion.ts` の `defineStringUnion` として実装済みで、
`ScoringStatus` / `ExamStudentStatus` / `DrawingType` / `CropRegionAreaType` / `grade.types` は移行済み。

**残る143件は、この仕組みが用意されているのに通していない箇所である。** 型は59種あり、ほぼ全部が
literal union（`AnchorDirection` 7、`BorderLineStyle` 13、`AbsentMethod` 4、`PaperSize`、
`HeaderFieldType`、`*MatchingStrategy` 群 …）。

最大の集積は `electron-src/lib/prisma/asbDefinitionConverters.ts`（34件）で、
DB のフラット列から `GlobalSettings` などを復元する際にすべて `as` で絞っている。

```ts
paperSize: row.paperSize as GlobalSettings["paperSize"],
orientation: row.orientation as GlobalSettings["orientation"],
```

同ファイルには、手書きの型ガードで同じことをしている箇所もある。

```ts
const VALID_STYLES = new Set<BorderLineStyle>(["solid", "dashed", "dotted"])
const boundary =
  row.boundary !== null && VALID_STYLES.has(row.boundary as BorderLineStyle)
    ? (row.boundary as BorderLineStyle)
    : undefined
```

`Set<T>.has` が `T` しか受けないため、**型ガードを書くために `as` が要る**という転倒が起きている。
`defineStringUnion` の `is` を使えば両方消える。

### 処方（型ガード＝境界コンバータ。ただし新設ではなく適用）

1. ASB 系の union（`BorderLineStyle` / `PaperSize` / `Orientation` / `AnchorDirection` /
   `HeaderFieldType` / `ImageObjectFit` …）を `defineStringUnion` の3点セット化する
2. `asbDefinitionConverters.ts` の復元関数（＝境界）で `to*` を通す。UI 側は union を受け取るだけになる
3. UI コールバック由来（`onValueChange={(value) => ... value as PaperSize}`, 13件）は、
   **UI で `as` するのをやめて `to*` を通す**。shadcn/Radix が `string` を返すのは仕様なので、
   ここも境界である

**注意**: B群は件数が最多だが、A群と違って**実害は出ていない**（値が集合内であるうちは `as` も `to` も
同じ結果になる）。守っているのは「DB 直書き・旧データ・アーカイブ取り込みで外れ値が入ったとき、
既定値へ倒れるか未定義動作になるか」の差である。したがって**A群の後**でよい。

---

## 7. C群: アーカイブ取り込み境界（75件）→ #1077

#1077「アーカイブ取り込みの JSON に実行時スキーマ検証を入れる」の射程。3層に分かれる。

**C1. #1077 が本文で名指ししている箇所（2件）**

```
electron-src/lib/import/exam-archive/archiveExtractor.ts:194
electron-src/lib/import/coursework-archive/archiveExtractor.ts:38
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
```

**C2. extractor が検証なしに型を名乗る箇所（13件）** — #1077 の射程だが本文に列挙されていない。
スキーマ検証を通せば戻り値が検証済み型になり自然に消える。

| ファイル                                 | 件数 | 例                                    |
| ---------------------------------------- | ---: | ------------------------------------- |
| `grade-archive/gradeArchiveExtractor.ts` |    4 | `gradeJson as LegacyArchiveGradeData` |
| `student-archive/index.ts`               |    4 | `compatData as ExtractedArchiveData`  |
| `import/shared/legacyClassroomKeys.ts`   |    3 | `result as T`                         |
| `exam-archive/manifestValidator.ts`      |    2 | `manifest as ArchiveManifest`         |

**C3. 変換器チェーンの旧版形状掘り（60件）** — `import/transformers/` のほぼ全ファイル。定型は:

```ts
const examDataRecord = data.examData as unknown as Record<string, unknown>
```

これは **#1077 の未決事項「どこで検証するか（変換チェーンの前か後か）」の答えでそのまま増減する**。

- **前で検証**（版ごとにスキーマを持つ）→ 各 transformer の入力が旧版の実型になり、60件は消える
- **後で検証**（現行の形だけ検証）→ 1件も減らない。壊れたデータが変換器を通る

`coursework-transformers/legacyShape.ts` は既に「版ごとの旧形状を型で宣言する」方式を採っており、
前者の前例になっている。

### 注意: `as` の数で #1077 の規模は測れない

#1077 は「JSON.parse 19箇所」を数えているが、C群75件とは**重ならない**。

```ts
// as に現れない（型注釈で名乗っている）
const boundariesData: ArchiveBoundariesData = JSON.parse(
  files["boundaries.json"] ?? "..."
)
```

型注釈による名乗りは `TSAsExpression` ではないため本調査には出ない。両方を対象にすること。

---

## 8. E群: ライブラリ拡張ポイントの未使用（6件）— **解消済み**

> **状態**: 6件すべて解消。`src/types/tanstackTable.d.ts` を1つ足し、`EditableTable.tsx` から
> `as` を6件削除した。型ガードは足していない。

### 何が起きていたか

`src/components/common/EditableTable.tsx` が、TanStack Table の `meta` を使用箇所ごとに
別々の形へアサートしていた。

```ts
const meta = table.options.meta as TableMeta | undefined
const meta = column.meta as { readOnly?: boolean } | undefined
const meta = column.columnDef.meta as { placeholder?: string; validate?: ... } | undefined
```

TanStack Table は `TableMeta` / `ColumnMeta` の**宣言マージを公式の拡張ポイントとして提供している**。
1箇所書けば6件すべてが消え、`{ readOnly }` と `{ placeholder, validate }` が別々に名乗られていた
形も1つに揃う。渡している側（`StudentImportTable` / `ClassroomStudentImportTable` /
`CourseworkScoresContainer`）が使うキーは `readOnly` / `placeholder` / `validate` の3つだけだった。

### 書き方に2つの罠がある（どちらも型検査が黙って消える）

**この作業は「型エラーが出ないこと」で成功を判定できない。** 失敗する形もエラーを出さないためである。
`meta` に存在しないキー（`column.meta?.bogusProp`）を書いて**エラーになること**まで確かめる。

1. **`.d.ts` の末尾に `export {}` が要る。** 無いとこのファイルはモジュールとみなされず、
   `declare module` が module augmentation ではなく**ambient module 宣言**として扱われる。
   拡張したはずの `@tanstack/react-table` は宣言ごと差し替えられ、そこから import する型が
   すべて暗黙の any に落ちる。`as` を消したうえで型検査も消える、最悪の結果になる
2. **型パラメータ名を元の宣言と揃える（`TData` / `TValue`）。** 本文では使わないので
   `_TData` と書きたくなるが、改名するとマージが成立しない。TypeScript は
   `TS2428`（identical type parameters）を出さず、やはり any に落ちる。
   このため未使用警告を消せず、`eslint.config.mjs` でこのファイルを名指しして
   `@typescript-eslint/no-unused-vars` を切ってある

なお `@tanstack/react-table` は `export * from "@tanstack/table-core"` で型を素通しするだけだが、
拡張先は **react-table 側でよい**（table-core から直接 import している型にも効くことを確認した）。

HEAD 基準の再計測で 609 → 603。

---

## 9. F群: テスト（231件）

半数近く（88件）が `__tests__/screenshots/helpers/generate-images.ts` の1ファイルに集中しており、
`Record<string, unknown>` 経由でテンプレートを組み立てている。残りは主に **better-sqlite3 の生 SQL 結果**
（`as { count: number }`, `as { name: string }[]`）で、これはドライバの `.get()` / `.all()` が
`unknown` を返す以上避けられない。

テストの `as` は**本番の型安全性を損なわない**（型が間違っていればテストが落ちる）。
ただし `generate-images.ts` の88件は、テストヘルパが本番の型を使わずに独自の形を組んでいる兆候なので、
本番側（A/B群）の整理が済んだあとで見直す。**優先度は最低**。

---

## 10. `as` を残してよい場所

以下は「乱用」ではない。消そうとするとコストだけがかかる。

| 場所                       | 例                                                                                | 理由                                                               |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ライブラリの原理的に広い型 | Recharts の tooltip `payload`、dnd-kit の `active.id`、Next.js の `params.examId` | ライブラリが `unknown` 相当を返す仕様。受け口を1箇所に閉じれば十分 |
| `reduce` の初期値          | `reduce((acc, x) => ..., {} as Record<string, string[]>)`                         | 型引数で書ける場合は書く。書けない場合は慣例                       |
| リテラルの widening 制御   | `default: null as string \| null`                                                 | `satisfies` で書ける場合もあるが実害なし                           |
| 実装内部の境界             | `serializePrisma` の `convert(data) as T`                                         | 関数の外に漏れない。契約は関数シグネチャが持つ                     |
| タプル化                   | `[a, b] as [number, number]`                                                      | 配列リテラルからタプルへの絞り込み                                 |

---

## 11. 型が嘘をついている単発の箇所 — **解消済み**

分類ではなく個別の不具合。

```ts
// electron-src/ipc-handlers/answerSheetBuilderHandlers.ts:457-458
createdAt: undefined as unknown as string,
updatedAt: undefined as unknown as string,
```

複製ハンドラが `{ ...definition }` で引き継いだ複製元の日時を、複製先で落とすための記述だった。

調査の結果、**`AnswerSheetDefinition.createdAt` / `updatedAt` は初版から `?: string`**（`ab5e75c6`）で、
`undefined` はそのまま代入できる。`exactOptionalPropertyTypes` も無効。つまりこの2件は
「`undefined` を `string` と名乗らせて型検査を通していた」のではなく、**何も黙らせていない純粋な記述の誤り**
だった（当初「受け手が日付として扱えば落ちる」と記したが、`duplicated` の型は
`AnswerSheetDefinition` であり、外へ出るのは `string | undefined` のまま。実行時の実害は無い）。

保存経路も確認した。`saveAsbDefinition` は `definition.createdAt` / `updatedAt` を**一切読まない**
（DB の既定値と `@updatedAt` が採番し、読み出し時に `dbToDefinition` が
`row.createdAt.toISOString()` を載せ直す）。したがって値を埋めるのは別の嘘になる。

**処方**: `as unknown as` を外して `undefined` のまま置き、日時が DB 側の持ち物であることを注記した。

---

## 12. 恒久的な歯止め（ESLint）

`no-explicit-any` は「違反ゼロにしてから error」という手順で入った。`as` に同じ手は使えない
（600件超ある）。段階を分ける。

**段階1（C群の完了後）**: 食い違い隠しが再混入しやすい形だけを禁止する。
A群の完了だけでは足りない ── 二重アサーションの大半は C群にある（§14 末尾）。

```js
"no-restricted-syntax": [
  "error",
  {
    // `x as unknown as T` — 型検査を完全に切る形。C群の解消後に有効化
    selector: 'TSAsExpression > TSAsExpression > TSUnknownKeyword',
    message: "二重アサーションは型検査を切ります。型ガードか、上流の型付けの修正で解決してください。",
  },
],
```

**段階2（B群の完了後）**: オブジェクトリテラルへの `as` を禁止する。
`@typescript-eslint/consistent-type-assertions` の `objectLiteralTypeAssertions: "never"`。
「満たしていない型を名乗る」最も危険な形を狙い撃ちできる。

**段階3**: `electron-src/lib/prisma/**` に限って `TSAsExpression` を warn にする。
A群の再発（include と型の乖離）はここでしか起きない。全体に掛けるのは D〜I群を巻き込むので行わない。

---

## 13. 済んだこと（PR #1145）

A群の解消と併せて、レビューで出た派生の指摘を片付けた。いずれも `as` の件数のためではなく、
**型と実体の食い違い**を潰す作業である。

| 対象                           | 内容                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| A群 9件                        | `GetPayload` 導出へ。`DbDefinitionFull` の手書き複製（30行）も導出へ                                           |
| 到達不能な IPC 4経路           | `getById` / `getByExam` / `batchUpdate` / `getStats` を main・ハンドラ・preload・契約・モックまで削除          |
| preload の二重定義             | 引数型が `Partial<DrawingAnnotation>` と契約の `DrawingCreateData` で別物だったのを契約側へ統一                |
| PDF 出力の採点マーク           | 実体で渡す形へ。renderer の組み立て直し・`as` 3件・偽の既定値（`textBoxWidth: 0` / `new Date()`）を除去        |
| 未知の描画種別                 | 既定の `"line"` へ倒さず読み取り境界で除外（倒すと終点を持たない行が答案の原点へ線を引く）                     |
| 文字サイズ・線幅の既定値       | px 時代の `16` / `3` を schema の mm 値 `4.0` / `0.5` へ                                                       |
| `serializePrisma` の Date 変換 | 撤去。structured clone は `Date` をそのまま通すので不要で、「型は `Date` / 実体は string」を全経路へ広げていた |
| `ExamPage` の並び 12箇所       | `pageNumber` は一意でないため id をタイブレークに追加。06 の自動配置が配列順で割り当てるため配置先が揺れていた |

**採らなかった処方も記録しておく。**

- **`Omit` で「書き込み禁止列」を除く** — 規約が許す `Omit` は「上書き（型注入）」と「機密除去」の
  2用途のみ。3つ目を「機密除去に近いから」と当てはめるのは、
  `feedback_convention_exceptions_whitelist` が禁じている判断基準の拡大にあたる
- **`pageNumber` の重複を検知して警告する** — 序数で動作を分ける発想そのものが誤り。
  同定は id で行う以上、重複は表示上の問題であって正しさは崩れない
- **`@@unique([examId, pageNumber])` で重複を防ぐ** — sync 構成では各端末がローカル DB へ書き、
  マージは行レベルなので、制約は各端末で満たされ衝突はマージ時に現れる。防げないうえ同期違反

---

## 14. 次にすべきこと

### 進行中

| #     | 内容                                            | 状態                                                                     |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| #1138 | `serializePrisma` の Decimal 変換を型に反映     | **着手済み**。署名を `Serialized<T>` へ。型エラー91件の解消が本体        |
| #1139 | DB 由来の日時をくるむ冗長な `new Date()` の撤去 | 着手済み。24箇所のうち DB 由来13件。アーカイブ由来11件は**残す**         |
| #1143 | Canvas の独自型 `DrawingElement` の撤去         | 着手済み。入力型2つ（`DrawingCreateData` / `DrawingUpdateData`）も消える |

#1138 と #1139 は `useBatchScoring.ts` で交差する（同じ箇所に Decimal の `as unknown as` と
日時の `new Date()` が並ぶ）。同じファイルを二度触らないよう、まとめて片付けるのが安い。

### 未着手（優先順）

| 順  | 対象                                   | 件数 | 性質           | 次の一手                                                           |
| :-: | -------------------------------------- | ---: | -------------- | ------------------------------------------------------------------ |
|  1  | B群のうち `asbDefinitionConverters.ts` |   34 | 予防・中コスト | ASB 系 union を `defineStringUnion` の3点セットへ。UI 側13件も同時 |
|  2  | C群（#1077）                           |   77 | 設計判断が先   | 「変換チェーンの前で検証するか後か」を決める。前なら60件が消える   |
|  3  | B群の残り                              |  107 | 予防           | 1 と同じ方式の横展開                                               |
|  4  | D群                                    |    4 | 予防           | C の仕組みを流用                                                   |
|  –  | F/G/H/I群                              |  380 | 据え置き       | §10 の基準で個別判断                                               |

§11 の単発2件と E群は解消した。**残りはすべて再発防止であり、「今バグを隠している」ものは無い。**
完了は `as` の件数ではなく**境界が1箇所に集約されているか**で判定する。

### 歯止めを入れられる条件

§12 の段階1（二重アサーションの禁止）は、**C群の解消が前提**である。現在 `as unknown as` は
65件あり、その大半が C群（アーカイブ変換器の `data.examData as unknown as Record<string, unknown>`）
なので、#1077 が片付くまで有効化できない。段階2（オブジェクトリテラルへの `as` 禁止）は
B群の完了が前提。**どちらも先に群を潰す必要があり、ルールを先に入れることはできない。**

---

## 15. 独自型の撤去で出た指摘（#1138 / #1139 / #1143）

行を写した独自型をやめて Prisma の行をそのまま持ち回る形にしたところ、
**「行をどこまで書き戻すか」を決めていなかった箇所**が表に出た。コードレビューで
9件の指摘が出て、すべて解消した。多くは掃討の取りこぼしだが、1件は実バグである。

| 対象                                    | 内容                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `updateDrawingAnnotation`（**実バグ**） | 行まるごとを書き戻すため、別経路（`toggleAnnotationFavorite`）が立てた `isFavorite` を次のドラッグで巻き戻していた |
| 描画ツールの無言化                      | `questionScoreId` が null のとき全ツールが無反応になり、通知も console 出力も無かった                              |
| renderer の重複判定                     | main 側だけ構造的にし、renderer に20列の手書き列挙が残っていた                                                     |
| `AnchorDirection`                       | `defineStringUnion` の SSOT の隣に、同じ9要素の手書き宣言が生き残っていた                                          |
| `positionOverride` の `as` 6件          | 組み立てを1つにまとめたら、個別読み取りごと消えた                                                                  |
| 縮小構造型                              | `handleTextElementReClick` だけ「表示のために小さくした型」が残っていた                                            |
| 到達不能なテキスト分岐                  | `drawSingleElement` のテキスト経路は両方の呼び出し元が skip しており、一度も実行されない                           |
| 死んだ `=== undefined` ガード           | 非 nullable な `Float @default(0.0)` に対する判定が2箇所残存                                                       |
| `TableMeta.updateData`                  | 宣言マージが全テーブルに効くため、必須にすると別の `meta` を持つテーブルが書けなくなる                             |

**行をそのまま持つ設計は正しいが、それだけでは足りない。** 行には「この経路が書く列」と
「別の経路が書く列」が混在しており、まるごと書き戻すと後者を巻き戻す。作成側にあった
「見た目を決める列」の切り出し（`toAppearance`）を更新にも通し、書く列と書かない列を
1箇所で決める形にした。列を足すと自動的に対象へ入り、独自の書き込み経路を持つ列を
足すときだけ除外を足す。

`isFavorite` の巻き戻しには回帰テストを足し、修正を戻すと落ちることを実測して確認した。

---

## 更新履歴

| 日付       | 内容                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| 2026-08-02 | 初版。AST による全数調査（620件）と判断軸・処方・着手順序を確定                  |
| 2026-08-03 | A群の解消と派生指摘の対応を記録（PR #1145）。再計測 608件。§13・§14 を現況へ更新 |
| 2026-08-03 | §11 の単発2件を解消。実害の見立ての誤り（型は元から optional）も訂正             |
| 2026-08-03 | E群を解消（宣言マージ）。件数を 14→6 へ訂正し、残る8件を G/I 群へ再分類          |
| 2026-08-03 | 上2件を PR #1147（issue #1146）としてマージ。eslint 除外1件の可否は PR で確認中  |
| 2026-08-03 | #1138 / #1139 / #1143 とそのレビュー指摘9件を解消（§15）                         |
