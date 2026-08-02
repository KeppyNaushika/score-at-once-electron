# 型アサーション（`as`）の全数調査と処方

## 1. 背景

`docs/coding-style.md` は「禁止事項」に次の2つを並べて挙げている。

> - **`any` の使用**: 原則禁止（ESLint で warn として検出）
> - **`as` の乱用**: 型ガードで解決できる場合は型ガードを使う

このうち `any` は `@typescript-eslint/no-explicit-any: "error"` で機械的に担保されているが（違反ゼロ）、
`as` を対象にするルールは1つも設定されていない。`consistent-type-assertions` も
`no-restricted-syntax` の `TSAsExpression` セレクタも無い。規約は文章としてのみ存在している。

その結果どうなっているかを全数で測ったのが本書である。

**`as` は 620 箇所ある。**

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

| 群    | 分類                                                                  |    件数 | 処方                            | 優先  |
| ----- | --------------------------------------------------------------------- | ------: | ------------------------------- | :---: |
| **A** | **Prisma include の食い違いを `as` が隠している**                     |   **9** | 型を include に追随させる       | **1** |
| **B** | **文字列 → literal union（境界コンバータの適用漏れ）**                | **143** | 既存 `defineStringUnion` を通す | **2** |
| C     | アーカイブ取り込み境界                                                |      75 | 実行時スキーマ検証（#1077）     |   3   |
| D     | DB の JSON 文字列列                                                   |       4 | C の仕組みを流用                |   4   |
| E     | ライブラリ拡張ポイントの未使用                                        |      14 | 宣言マージ                      |   5   |
| G     | DOM 絞り込み                                                          |      20 | 大半は据え置き                  |   –   |
| H     | ライブラリの原理的に広い型                                            |      20 | 据え置き（受け口を1箇所に）     |   –   |
| I     | その他・慣例（reduce 初期値、widening 制御、生 SQL 結果、`keyof` 等） |     104 | 個別精査                        |   –   |
| F     | テスト                                                                |     231 | 別枠（§9）                      |   –   |
|       | **計**                                                                | **620** |                                 |       |

---

## 5. A群: include の食い違いを隠している（9件）— 最優先

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

## 8. E群: ライブラリ拡張ポイントの未使用（14件）

`src/components/common/EditableTable.tsx` に集中。

```ts
const meta = table.options.meta as TableMeta | undefined
const meta = column.meta as { readOnly?: boolean } | undefined
const meta = column.columnDef.meta as { placeholder?: string; validate?: ... } | undefined
```

TanStack Table は `TableMeta` / `ColumnMeta` の**宣言マージを公式の拡張ポイントとして提供している**。

```ts
declare module "@tanstack/react-table" {
  interface TableMeta<TData> {
    updateData: (rowIndex: number, columnId: string, value: string) => void
  }
  interface ColumnMeta<TData, TValue> {
    readOnly?: boolean
    placeholder?: string
    validate?: (value: string) => boolean
  }
}
```

これを1箇所書けば14件すべてが消え、`meta` の形が使用箇所ごとにバラバラ（`{ readOnly }` と
`{ placeholder, validate }` が別々にアサートされている）な現状も1つに揃う。**型ガードは不要**。

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

## 11. 型が嘘をついている単発の箇所

分類ではなく個別の不具合。

```ts
// electron-src/ipc-handlers/answerSheetBuilderHandlers.ts:457-458
createdAt: undefined as unknown as string,
updatedAt: undefined as unknown as string,
```

`undefined` を `string` と名乗らせている。受け手が日付として扱えばそこで落ちる。
型を `string | undefined` にするか、値を埋めるかのどちらかで、A群の作業とは独立に直せる。

---

## 12. 恒久的な歯止め（ESLint）

`no-explicit-any` は「違反ゼロにしてから error」という手順で入った。`as` に同じ手は使えない
（620件ある）。段階を分ける。

**段階1（A群の完了後）**: 食い違い隠しが再混入しやすい形だけを禁止する。

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

## 13. 着手順序

| 順  | 対象                                           | 件数 | 性質                   | 見積もりの注意                                      |
| :-: | ---------------------------------------------- | ---: | ---------------------- | --------------------------------------------------- |
|  1  | A群（include 食い違い）                        |    9 | **実害あり・低コスト** | `as` を外すと出る型エラーが本体。波及範囲を先に見る |
|  2  | §11 の単発（`undefined as unknown as string`） |    2 | 実害あり・極小         | 単独で完結                                          |
|  3  | B群のうち `asbDefinitionConverters.ts`         |   34 | 予防・中コスト         | union の3点セット化が先。UI 側13件も同時に          |
|  4  | E群（TanStack Table 宣言マージ）               |   14 | 予防・低コスト         | 1箇所の宣言で14件消える                             |
|  5  | C群（#1077）                                   |   75 | 設計判断が先           | 検証位置の決定で C3 の60件が決まる                  |
|  6  | B群の残り                                      |  109 | 予防                   | 3 と同じ方式の横展開                                |
|  7  | D群                                            |    4 | 予防                   | C の仕組みを流用                                    |
|  –  | F/G/H/I群                                      |  375 | 据え置き               | §10 の基準で個別判断                                |

**1 と 2 だけが「今バグを隠している」ものである。** 3 以降は再発防止であり、`as` の件数ではなく
「境界が1箇所に集約されているか」で完了を判定する。

---

## 更新履歴

| 日付       | 内容                                                            |
| ---------- | --------------------------------------------------------------- |
| 2026-08-02 | 初版。AST による全数調査（620件）と判断軸・処方・着手順序を確定 |
