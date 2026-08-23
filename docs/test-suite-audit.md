# テストの全数調査 ── どれが本番を守っていないか

調査日: 2026-08-23。テストは**実行していない**（全て通っている状態からの静的調査）。

---

## 1. 背景と目的

`__tests__` には vitest 対象（`__tests__/**/*.test.ts` / `*.test.tsx`）が **196 ファイル・
1,837 本・62,860 行**ある。加えて Playwright の `*.spec.ts` が 3 本ある。

全部が緑である。本書が問うのは緑かどうかではなく、**その緑が本番コードの正しさを
言っているか**である。テストは次のどれかに落ちると、緑でありながら何も守らない。

- 本番コードを1行も通らない（テストヘルパーや言語仕様を検証している）
- 本番の実装をテスト側に**書き写して**、その写しを検証している
- 呼ぶだけで表明が無い（例外が出ないことしか見ていない）

3 つ目は無害だが、1・2 つ目は**緑が嘘をつく**ので有害である。実際に 1 件、写しが本番から
乖離したまま緑になっている箇所があった。

---

## 2. 調査方法

`__tests__` 配下の全ファイルに対して機械的な走査を掛け、引っ掛かったものを個別に読んだ。

| 走査                                                                             | 目的                                         | 結果                                         |
| -------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| `it.skip` / `it.todo` / `it.only` / `xit`                                        | 無効化されたテスト                           | **0 件**                                     |
| `vi.mock` の対象 = 自身の import 元                                              | 被テストモジュールを自分でモックしていないか | **0 件**                                     |
| `from "…/src/…"` / `…/electron-src/…"` を1つも持たないファイル                   | 本番コードに触れていないテスト               | 13 件（うち 9 件は正当）                     |
| 上記から型 import のみを除外                                                     | 実装を1つも呼んでいないテスト                | 13 件（同上）                                |
| `it`/`test` ブロック内に `expect(` が無い                                        | 表明の無いテスト                             | 4 件（ヘルパー内 `expect` の誤検出を除く）   |
| 表明が `toBeDefined` / `toBeTruthy` / `not.toBeNull` / `toBeGreaterThan(0)` だけ | 弱い表明のみのテスト                         | 13 件                                        |
| `readFileSync` / `readdirSync` を使うファイル                                    | ソース本文を検証する規約テスト               | 31 件（うち走査の空振り防止が無いもの 0 件） |

本番コードに触れていないファイルのうち、以下 9 件は**正当**である。`migration/*` は
`migration.sql` を空 DB へ実際に適用して検証しており、`renderer/*Conventions` は
TypeScript の AST でソースを走査しており、`sync/*` は本物の `sqlite-nas-sync` と本物の
`schema.prisma` を繋いでいる。`deployPendingMigrations` と `omrArchiveRoundTrip` は
`await import()` で本番を読んでいる。

---

## 3. 有害 ── 緑が本番の正しさを保証していない

### 3.1 `__tests__/omr/integration/cropRegionOmrConfig.test.ts`（313 行 / 6 本）

**本番の `upsertOmrConfig` をテストファイル内に丸ごと書き写し、その写しを検証している。**
本番コード（`electron-src/lib/prisma/cropRegionOmrConfig.ts`）は1行も通らない。

写しは `:89` の「ヘルパー: upsertをPrisma直接操作で実装」から始まる。**この写しは既に本番から
乖離している。**

| 本番が書く列                                                                                     | 写しが書く列 |
| ------------------------------------------------------------------------------------------------ | ------------ |
| `type` / `numChoices` / `choiceLayout`                                                           | 同じ         |
| `colorThreshold` / `areaThreshold`                                                               | **無い**     |
| `shape` / `normalizedCx` / `normalizedCy` / `normalizedWidth` / `normalizedHeight`（バブル位置） | **無い**     |

つまり本番のしきい値とバブル位置の書き込みを壊しても、このテストは緑のままである。
6 本のうち「CropRegion を削除するとカスケードする」2 本は Prisma のスキーマを見ているので
写しとは無関係に意味があるが、残る 4 本（upsert 2 本・取得 2 本）は写しを見ている。

写経が選ばれた理由は、本番 `upsertOmrConfig` が `../client` の既定 Prisma を直に使うため
テスト DB へ向けられないことだと思われる。**その手立ては既にある** ── 他の 64 ファイルが
`vi.mock("…/electron-src/lib/prisma/client")` でテスト用クライアントへ差し替えている。

### 3.2 `__tests__/omr/integration/omrArchiveRoundTrip.test.ts`（332 行 / 3 本）のうち 2 本

- **「全OMR設定をchoiceOptions付きで取得できる」** ── `prisma.cropRegionOmrConfig.findMany({ include })`
  を直接叩いて結果を見るだけ。本番のクエリ関数を通らない。Prisma のテストである。
- **「アーカイブデータ形式にシリアライズ → DBにリストアできる」**（`:161`）── `dataCollector.ts` も
  `idIntegrationImporter.ts` も通さず、**export 相当の `map` と import 相当の `create` を
  テスト内で手書き**し、その自作往復を検証している。ファイル名が言う「アーカイブ往復」は
  起きていない。本番の収集・投入が壊れてもこのテストは緑である。
- 3 本目のトランスフォーマー検証（`:296`、`V1_6_0_to_V1_7_0`）だけが本物を通している。

---

## 4. 無意味 ── 本番を1つも触っていない

### 4.1 `__tests__/import-export/unit/dataCollector.test.ts`（237 行 / 16 本）

冒頭に「テスト対象: `electron-src/lib/export/exam-archive/dataCollector.ts` の出力形式」と
書いてあるが、import しているのは `__tests__/helpers/testDataFactory.ts` の
`createArchiveStudentsData` などのファクトリだけである。**16 本すべてが、テストデータ
ファクトリが自分の引数を返すことを確認している。**

ファイル自身が「collectExamData 自体は Prisma 依存のため統合テストで扱う」と認めており、
実際 `import-export/integration/collectExamData.test.ts` が本物を見ている。

### 4.2 `__tests__/import-export/unit/idMappings.test.ts`（167 行 / 9 本）

本番からの import は `merge/types.ts` の `createEmptyCounts` 1 つだけ。それを使う 1 本
（「全カウンタがゼロで初期化される」）以外の **8 本は JavaScript の言語仕様のテスト**である。

```ts
mappings.student[importId] = existingId
expect(mappings.student[importId]).toBe(existingId) // オブジェクトへの代入

importCounts.skipped.scores += 5
expect(importCounts.skipped.scores).toBe(5) // += 演算子

Object.entries(mappings.student).find(([, id]) => id === existingId)?.[0]
// Object.entries と find
```

`createEmptyIdMappings` / `createEmptyImportCounts` は本番に存在せず、`testDataFactory.ts`
だけが持つテストヘルパーである（`grep` で確認済み）。

---

## 5. 表明が無い ── 名前が約束を果たしていない

いずれも本番関数を `await` するだけで終わり、**例外が出ないこと以外何も見ていない**。

| 箇所                                                          | テスト名                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `import-export/integration/idIntegrationImporter.test.ts:743` | II-8: by_student_number戦略で学籍番号マッチした生徒が**マッピングされる** |
| `import-export/integration/idIntegrationImporter.test.ts:811` | II-9: by_name戦略で氏名マッチした生徒が**マッピングされる**               |
| `import-export/scenarios/edgeCases.test.ts:587`               | EC-7: マニフェストの互換バージョンが**正しく処理される**                  |

EC-7 は自身のコメントで「バージョン変換は archiveExtractor の後、importer の前で行われる」と
書いている。つまり `executeIdIntegrationImport` を呼ぶこの経路では、互換性を**原理的に**
検証できない。マニフェストの `version` を `1.0.0` に書き換えても何も起きないのが正しい挙動で、
テストはそれを確認していない。

---

## 6. 意味はあるが弱い ── 名前が中身より大きい

削除するほどではないが、名前が保証しているものと表明の間に開きがある。

- **`idIntegrationImporter.test.ts:190/242/287`（II-1〜3）** ── 同一の 30 行のセットアップを
  3 回書き、それぞれ `exam` が `not.toBeNull()`、`created.scores > 0`、`summary` が
  `toBeDefined()` を見るだけ。II-1 の「**全**エンティティが作成される」は確認していない。
- **`exportImportRoundTrip.test.ts:316`（E2E-5）** ── 「v1.4.0 の**全**新規フィールドが
  保持される」だが、表明はすべて `length > 0`。値の一致は見ず、`tagSubtotalGroups` は
  インポート後の確認すら無い（値の忠実さは `roundTripFieldFidelity.test.ts` が別に見ている）。
- **`renderer/hooks/useImportWizard.test.ts:60`（IW-1）** ──
  `expect(result.current.state).toEqual(initialState)`。フックが `useState(initialState)` を
  返すことの確認である。続く IW-2〜4 はその部分集合を個別に見ている。
- **`examMergeOrSeparate.test.ts:610-635`** ── `importExamCore.ts` を**文字列として読み**、
  `applyExamColumns` の `data: {` ブロックに列名が現れるかを正規表現で確認する。守りたい事故
  （Exam に列を足して LWW の対象から漏らす）は実在するので意図は正しいが、
  `description: exam.description` の左右を取り違えても通る。同じ検査は「全列を変えた
  アーカイブを取り込んで全列が上書きされたか」で振る舞いとして書ける。
- **`renderer/components/entityOverviewPageAdoption.test.ts`** ──
  `expect(source).toContain("const handleCreate = useCallback(async () => {")` は整形 1 回で
  落ちる。`expect(source).not.toContain("setup")` は `?setup=1` を狙った検査だが語が広すぎ、
  無関係な `setup` にも当たる。

---

## 7. 良質だと確認した仕組み

対処対象と取り違えないよう記録しておく。

- **`renderer/ipcBoundaryConventions.test.ts`** ── TypeScript の AST で走査し、
  「登録したが preload から呼ばれないチャンネル」「preload にあるが renderer が触らない
  メソッド」「`src` → `electron-src` の値 import」を検出する。**型検査が見ない向きだけ**を
  狙っており、例外は判断基準でなく名指しの一覧（`UNCALLED_PRELOAD_METHODS`）で管理されている。
  「走査そのものが機能している」という自己検査（`registered.size > 200`）も持つ。
- **`sync/twoClientSync.test.ts` / `sync/studentAnswerPlacementSync.test.ts`** ── 本物の
  `sqlite-nas-sync` と本物の `schema.prisma` で 2 端末を再現する。作り物を挟んでいない。
- **`migration/*`** ── `migration.sql` を空 DB へ実際に適用し、`sqlite_master` や
  `foreign_key_check` まで見る。
- **`calculations/*`・`renderer/utils/dragDropUtils.test.ts`・
  `answer-sheet-builder/verticalTransform.test.ts`** ── 期待値が定数で、コメントに
  「これが壊れたとき何が起きるか」が書かれている。

規約走査系 31 ファイルは全て、走査が空振りしたときに気付ける形（件数の下限か、
ファイルパスの名指し）になっており、**空振りで緑になるものは無かった**。

---

## 8. 副次的な発見（テストの意味とは別件）

- **ルートの `playwright.config.ts` は `testDir: "./tests"` を指しているが、そのディレクトリは
  存在しない。** 実体は `__tests__/tests/electron/` で、`__tests__/playwrightElectron.config.ts`
  が `--config` 経由で拾っている（`npm run test:e2e`）。素で `npx playwright test` を叩くと
  0 件で緑になる。
- **`__tests__/screenshots/take-screenshots.spec.ts`（942 行 / 29 本）は `expect` が 0 件**だが、
  これは `npm run screenshot:test` から呼ぶ画像生成スクリプトであり想定どおり。ただし
  `test()` で書かれているぶん、レポート上はテストとして数えられる。

---

## 9. 対処の順

1. **`cropRegionOmrConfig.test.ts` を本番 `upsertOmrConfig` へ繋ぎ直す** ──
   乖離が既に起きているため最優先。`vi.mock("…/electron-src/lib/prisma/client")` で
   テスト DB へ向ける（既存 64 ファイルと同じ手口）。写しは消す。
2. **`omrArchiveRoundTrip.test.ts` の往復 2 本** ── 本番の `collectExamData` /
   `executeIdIntegrationImport` を通す。通せないなら、往復を騙る名前を捨てる。
3. **表明の無い 3 本（II-8 / II-9 / EC-7）** ── II-8・II-9 は `idMappings.student` の
   写り先を見る。EC-7 は経路そのものが検証できないので、`archiveExtractor` を通す形に
   書き換えるか消す。
4. **`dataCollector.test.ts` と `idMappings.test.ts` を消す** ── 前者は
   `collectExamData.test.ts` が、後者は `idChangeExecutor.test.ts` が本物を見ている。
