# アーカイブ（インポート／エクスポート）アーキテクチャ

**アーカイブは5種類ある。** どれも ZIP で、中身は JSON（＋画像）で、版と変換チェーンを
持つ。だが**取り込みの規則は種ごとに違う。** 本書はその5つを同じ形で並べる。

> **数字はコードが正しい。** 現行版の出どころは `src/types/*Archive.types.ts` の
> `*_CURRENT_VERSION` の1箇所だけで、変換器の本数は `import/*transformers/` の
> ファイル数がすべてである。本書と食い違ったらコードを信じること。
>
> 統合の計画は [remaining-work.md](./remaining-work.md) の段階60。

## 目次

1. [5種の一覧](#5種の一覧)
2. [共通の骨格](#共通の骨格)
3. [取り込みの3択](#取り込みの3択)
4. [版と変換チェーン](#版と変換チェーン)
5. [試験（`.score`）](#試験score)
6. [試験外成績資料（`.coursework`）](#試験外成績資料coursework)
7. [成績（`.grade`）](#成績grade)
8. [解答用紙（`.asb`）](#解答用紙asb)
9. [生徒（`.students`）](#生徒students)
10. [外部形式からの取り込み](#外部形式からの取り込み)
11. [種ごとに違うところ（統合の材料）](#種ごとに違うところ統合の材料)
12. [スキーマを変えたときにやること](#スキーマを変えたときにやること)

---

## 5種の一覧

| 種             | 拡張子        | 書き出し                     | 取り込み                                  | 変換器 |
| -------------- | ------------- | ---------------------------- | ----------------------------------------- | ------ |
| 試験           | `.score`      | `export/exam-archive/`       | `import/exam-archive/` ＋ `import/merge/` | 27本   |
| 試験外成績資料 | `.coursework` | `export/coursework-archive/` | `import/coursework-archive/`              | 2本    |
| 成績           | `.grade`      | `export/grade-archive/`      | `import/grade-archive/`                   | 9本    |
| 解答用紙       | `.asb`        | `export/asb-archive/`        | `import/asb-archive/`                     | 5本    |
| 生徒           | `.students`   | `export/student-archive/`    | `import/student-archive/`                 | 0本    |

**画像を持つのは試験（模範解答・答案）と解答用紙だけ。** 残る3種は JSON のみ。

---

## 共通の骨格

どの種も同じ3層でできている。

```
書き出し   dataCollector（Prisma から集める） → archiveCreator（ZIP を作る） → index（ダイアログと入口）
取り込み   archiveExtractor（ZIP を開き、版を判定し、変換チェーンを通す） → 照合 → 投入
```

- **ZIP** — 作るのは `archiver`（zlib level 9）、開くのは `adm-zip`
- **`manifest.json`** — 必ず入る。版・作成日時・件数などを持つ。検証は各種の
  `manifestValidator.ts`
- **収集は射影しない** — `include` の出力をそのまま JSON にする。表示のための縮小や
  `_count` は入れない（renderer が数える）

---

## 取り込みの3択

**人は取り込みの最初に1回だけ選ぶ。** 選んだ操作は取り込む全レコードの全ての値に、
例外なく同じように効く（項目ごとの選択も、実体ごとの特別扱いも作らない）。

| 選択        | 既存と一致した行                             | 新しく作る行                             |
| ----------- | -------------------------------------------- | ---------------------------------------- |
| `overwrite` | 無条件に置き換え。`updatedAt` = 取り込み時刻 | `createdAt`/`updatedAt` = 取り込み時刻   |
| `merge`     | LWW（新しい方が勝つ）。`updatedAt` はその値  | `createdAt`/`updatedAt` = アーカイブの値 |
| `separate`  | （id を振り直すので一致が起きない）          | `createdAt`/`updatedAt` = アーカイブの値 |

型は `src/types/importAction.types.ts`、**適用は
`import/merge/importValuePolicy.ts` の1箇所**に寄せてある。

---

## 版と変換チェーン

**旧い版のアーカイブは、投入の前に必ず現行版まで引き上げる。**

- 基盤は `import/shared/transformChain.ts`（`detectVersionInRange` と
  `runTransformChain`）で、**5種すべてがこれを共有する**
- 種ごとの鎖は `import/transformers/`（試験）・`coursework-transformers/`・
  `grade-transformers/`・`asb-transformers/`・`student-transformers/` の `index.ts` が持つ
- 1段の変換器は `V<FROM>_to_V<TO>.ts` で、**入力の版から出力の版へ1段だけ上げる**。
  新規フィールドには既定値（`[]` / `null` / `""`）を入れ、何を補ったかを `warnings` に積む

### 版の判定

`manifest.version` は**信用しきらない**。過去に固定値を書き続けて嘘をついていた版が
あったので、**形状を見て下方へ補正する**（manifest が名乗る版に無いはずのセクションが
あれば、実際はもっと古い／新しいと判定する）。

**版でセクション名が変わるとき、extractor は「読めた方だけ」を載せること。**
両方載せると、新しい版のアーカイブが旧版に見えてデータを捨てる。

### 既定値はチェーンの「あと」で埋める

試験は `archiveExtractor` の1か所（`withDefaultedSections`）へ寄せてある。
チェーンの途中で埋めると、後続の変換器が「無い」と「既定値」を区別できなくなる。

---

## 試験（`.score`）

**5種でいちばん大きく、唯一 `merge/` という別モジュールを持つ。**

### 中身

```
manifest.json      版・メタ情報
exam.json          Exam 根・ExamPage・CropRegion・出力設定・OMR 設定 ほか
students.json      Student
classes.json       Classroom・StudentClassroomMembership
users.json         User（パスワードは除外）
subtotals.json     SubtotalGroup・Subtotal・CropSubtotal
scores.json        QuestionScore・ScoreDecision・DrawingAnnotation ほか
tags.json          Tag・ExamTag
master-images/     模範解答画像
answer-sheets/     答案画像
```

### ファイル

|                                               |                                                    |
| --------------------------------------------- | -------------------------------------------------- |
| `export/exam-archive/index.ts`                | 入口。ダイアログ・収集・生成・**欠けた画像の報告** |
| `export/exam-archive/dataCollector.ts`        | Prisma から集める                                  |
| `export/exam-archive/archiveCreator.ts`       | ZIP を作る                                         |
| `import/exam-archive/archiveExtractor.ts`     | ZIP 展開・版判定・**変換チェーン適用**・既定値埋め |
| `import/exam-archive/manifestValidator.ts`    | manifest の検証                                    |
| `import/exam-archive/uniqueNameGenerators.ts` | 名前の重複を避ける連番付け                         |

### 照合と投入（`import/merge/`）

|                                    |                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `matcher.ts`                       | 事前照合の統合（`performPreMatching`）                                                       |
| `matchers/studentMatcher.ts`       | 生徒（uuid → 学籍番号 → 氏名）                                                               |
| `matchers/classroomMatcher.ts`     | 学級（uuid → 名前 → `classroomCode`）                                                        |
| `matchers/subtotalGroupMatcher.ts` | 小計点グループ（uuid → 名前）                                                                |
| `matchers/userMatcher.ts`          | 利用者（uuid → `username`）                                                                  |
| `idIntegrationImporter.ts`         | **Stage 1**。単一トランザクションで全部入れる。`executeIdIntegrationImport` が唯一の投入経路 |
| `processors/`                      | 生徒・学級・小計点グループの id 統合（新規作成／既存紐づけ／ID 変更予約）                    |
| `idChangeExecutor.ts`              | **Stage 2**。ID 変更（複製 → FK 更新 → 旧レコード削除）                                      |
| `importExamCore.ts`                | 試験骨格（Exam 根・ExamPage・CropRegion・UserExam・ExamSubtotalGroup・ExamStudent）          |
| `importExamAttachments.ts`         | 付随データ（採点マーク・出力設定・OMR・複合解答・タグ・ExamClassroom）                       |
| `importSubtotals.ts`               | 小計・CropSubtotal                                                                           |
| `importScoring.ts`                 | 採点層（QuestionScore・ScoreDecision・CompoundAnswerScore・CropRegionAssignment）            |
| `importSyncRecords.ts`             | DrawingAnnotation・StudentClassroomMembership（追加とマージのみ。削除は推論しない）          |
| `imageImporter.ts`                 | 画像のコピーと行の作成                                                                       |
| `importValuePolicy.ts`             | **3択の適用**（値・`createdAt`/`updatedAt` をどう倒すか）                                    |
| `separateExamRewriter.ts`          | `separate` のとき、試験まわりの id を振り直す                                                |
| `reorderAfterImport.ts`            | 取り込み後の並び順の焼き直し                                                                 |
| `scoringConflictDetector.ts`       | 採点の食い違いの検出（`examStudentId` + `cropRegionId`）                                     |
| `decisionMergePolicy.ts`           | 確定層（ScoreDecision / CompoundAnswerScore）の解決を LWW に一本化                           |
| `types.ts`                         | `IdMappings` / `IdChangeTarget` / `ImportCounts`                                             |

### IPC

`archiveHandlers.ts` — `archive:exportExam` / `bulkExportExams` / `selectImportFile` /
`analyzeArchive` / `preMatch` / `detectScoringConflicts` / `idIntegrationImport`、
および外部形式の変換（`convertHszToScore` / `convertDatToScore`）。

### Stage 2 の罠

`idChangeExecutor` の生徒 ID 変更は**delete ＋ 再作成**である。`Student` に
カスケードの子を足したら、**必ずここへ `updateMany` を足すこと。** 足し忘れると
取り込みで黙って消える。

---

## 試験外成績資料（`.coursework`）

**試験アーカイブと同型の独立アーカイブ。** id を一次の照合に使い、名前マッチングを
付加として持ち、点数は LWW で解決する。

```
manifest.json
courseworks.json              coursework-classrooms.json
coursework-tags.json          coursework-students.json
coursework-items.json         coursework-letter-scales.json
coursework-scores.json
students.json  classes.json  memberships.json  tags.json
```

**1.1.0 でテーブルごとの平坦なセクションになった**（それ以前は資料1件を入れ子ツリーへ
射影していた）。Prisma の行をそのまま持ち、点数は `courseworkStudentId` を持つ。

**版ごとの「アーカイブ全体の型」と旧版の形は
`import/coursework-transformers/types.ts` と `legacyShape.ts` が持つ。**
`src/types/courseworkArchive.types.ts` は**現行の形だけ**を宣言する。

|                                            |                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `import/coursework-archive/idRemapper.ts`  | 生徒・学級の解決。`allowCreate` で「作る／lookup のみ」が切り替わる |
| `import/coursework-archive/dataCreator.ts` | 投入                                                                |
| `import/coursework-archive/index.ts`       | `previewCourseworkImport` と `importCourseworkArchive`              |

IPC は `courseworkHandlers.ts` の `coursework:exportArchive` /
`selectImportFile` / `importArchive`。

---

## 成績（`.grade`）

**外部参照が名前ベースなのが、この種だけの性質。** 試験・小計点グループ・採点領域は
アーカイブに**含めず**、取り込み先に既にあるものを lookup する。

```
manifest.json
grade-exam.json     成績本体（評価項目・境界・観点間制約・上書き・確定値 ほか）
courseworks.json    内包する試験外成績資料（coursework-archive 形式）
```

### 内包する資料は coursework-archive へ委譲する

二重実装を解消してあり、収集も生成も coursework-archive のモジュールを呼ぶ。

| 版     | 変わったこと                                                                |
| ------ | --------------------------------------------------------------------------- |
| 1.4.0  | Coursework を**名前ベース**で `courseworks.json` に埋め込み（読込互換のみ） |
| 1.5.0  | `courseworks.json` を coursework-archive 形式（UUID ベース）へ              |
| 1.12.0 | 内包資料を coursework 1.1.0（平坦なセクション）へ。旧入れ子形式は読込互換   |

### 生徒・学級は「作る」

**かつて lookup のみだったが、いまは作る**（`gradeArchiveImporter.ts` が
`allowCreate: true` を渡す）。理由は、内包資料をここだけ lookup のみにすると、
**同じ資料が単体の `.coursework` では点数まで復元されるのに `.grade` 経由だと空になる**
から。生徒は uuid 一次 → 学籍番号、学級は uuid 一次 → 学級名で探し、
どちらにも当たらなければ作る。

**試験・小計点グループ・採点領域の名前ベース lookup は仕様として残す。**

IPC は `gradeHandlers.ts` の `grade:exportArchive` / `importArchive` / `executeImport`。

---

## 解答用紙（`.asb`）

```
manifest.json
definition.json    AsbDefinition と全子テーブル（大問・小問・枝問・原稿用紙・
                   文字位置マーカー・OMR・テキスト・画像・ヘッダー欄）
tags.json          タグ本体と定義への参照（1.2.0 以降）
images/            貼り込んだ画像
```

**取り込みは常に新規作成**（`importAsbDefinition`）で、照合の段は無い。
`idRemapper.ts` が全ての id を振り直す。**原稿用紙と文字位置マーカーの id を
振り直し忘れると、マーカーを置いた解答用紙が一切複製できない**（主キー衝突）。

IPC は `answerSheetBuilderHandlers.ts` の `asb:export-definition` /
`asb:select-import-file` / `asb:import-definition`。

---

## 生徒（`.students`）

```
manifest.json
students.json   Student
classes.json    Classroom・StudentClassroomMembership
```

**いちばん小さく、変換器を1本も持たない**（初版のまま）。事前照合
（`performStudentPreMatching`）と投入（`executeStudentImport`）に分かれ、
生徒ごとに「統合する／別で追加する」を選ばせる。

IPC は `studentArchiveHandlers.ts` の `studentArchive:exportStudents` /
`selectImportFile` / `analyzeArchive` / `preMatch` / `import`。

---

## 外部形式からの取り込み

`import/external-formats/` に2つある。どちらも `.score` へ変換してから、
通常の取り込み経路へ流す。

|                |                                      |
| -------------- | ------------------------------------ |
| `hsz/`         | 旧版（tkinter 版）の `.hsz` / `.dat` |
| `reattendant/` | 再受験者のデータ                     |

---

## 種ごとに違うところ（統合の材料）

**同じことを5回別々に書いている。** ここが段階60（アーカイブの統合）の対象である。

|                                       | 試験                         | 資料                               | 成績                                              | 解答用紙         | 生徒                 |
| ------------------------------------- | ---------------------------- | ---------------------------------- | ------------------------------------------------- | ---------------- | -------------------- |
| 3択（`overwrite`/`merge`/`separate`） | ある                         | ある                               | ある                                              | 無い（常に新規） | 無い（行ごとに選ぶ） |
| 生徒・学級の照合                      | `merge/matchers/`            | `coursework-archive/idRemapper.ts` | 同左を呼ぶ                                        | —                | `student-archive/`   |
| 既定値の埋め方                        | `archiveExtractor` の1か所   | 各所                               | `for...of` が14か所                               | 各所             | —                    |
| 版の判定                              | manifest ＋ 形状フロア       | 同左                               | **形状のみ**                                      | manifest ＋ 形状 | —                    |
| 利用者                                | 参照される利用者を全員入れる | 入れない                           | **入れない**（`frozenByUserId` が null へ倒れる） | 入れない         | —                    |

### 残っている食い違い

- **`createdAt` / `updatedAt`** — 3択で決まるようになったが、種によって適用の徹底度が違う
- **`.grade` に利用者のセクションが無い** — `GradeFrozenScore.frozenByUserId` を行のまま
  書き出すのに、取り込み側は同じ id の利用者が偶然居なければ **null（操作者不明）へ倒す**。
  試験側は「参照される利用者を全員入れる」へ直してあるので、**統合するときはその形へ寄せる**
- **人が統合先を選ぶ導線**が種ごとに別

### やらないと決めていること

- **`.grade` の名前ベース外部参照は仕様。** 統合してもこの非対称は残す
- **資料の評語（`CourseworkLetterScale`）と成績の評定は別概念。** 前者は配点表で、
  同じ `S` が項目ごとに 6/12/18/30 点になる。同じ語彙へ寄せない

---

## スキーマを変えたときにやること

**テーブル・フィールド・リレーションを足したり消したり改名したら、必ず対応する。**
手順は種によらず同じ。

1. **版を上げる** — `src/types/<種>Archive.types.ts` の `*_CURRENT_VERSION` を更新し、
   `*ArchiveVersion` と `*_SUPPORTED_VERSIONS` に新しい版を足す（semver）
2. **変換器を作る** — `import/<種>-transformers/V<FROM>_to_V<TO>.ts` を足し、
   `index.ts` の配列へ登録する。新規フィールドには既定値を入れ、補ったことを
   `warnings` に積む
3. **アーカイブ型を更新する** — セクションの型にフィールドを足す
4. **書き出しを更新する** — `dataCollector.ts` で集め、`archiveCreator.ts` で入れる
5. **取り込みを更新する** — extractor で取り出し、投入経路（試験なら
   `merge/idIntegrationImporter.ts` と `merge/processors/`）で入れる
6. **検査を足す** — 変換チェーンのテストに**旧い形のフィクスチャ**を足す
   （`__tests__/import-export/unit/*TransformerChain.test.ts`）。往復で値が落ちないことは
   `__tests__/import-export/scenarios/roundTripFieldFidelity.test.ts`

### 変換器の形

```typescript
export class V1_9_0_to_V1_10_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.9.0"
  readonly toVersion: ExamArchiveVersion = "1.10.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        newData: data.newData ?? { items: [] },
      },
      warnings: ["1.9.0→1.10.0: 新機能Xのデータは既定値で補いました"],
    }
  }
}
```

### テストで版を偽らないこと

フィクスチャを作るとき、`manifest.version` に現行版を書いて中身は旧い形、という
組み合わせを作らない。**形状ベースの判定が効いて、検証したいはずの経路を通らなくなる。**
