# メンバーシップ経由への配線変更 実装計画（#962）

## 1. 背景

グリッドのセルは概念的に「その試験の受験者 × 設問」であり、DB もそう表現すべきである。しかし現在は
`QuestionScore.studentId` のように **Student へ直結**しており、`ExamStudent` を経由しない。

調査の結果、これは #962 が指摘した `StudentAnswerImage` 単独の問題ではなく、**3 つのサブシステムに共通する
同一パターン**であることが判明した。

> 「メンバーシップテーブルが存在するのに、その子データが Student 直結」

| 親（メンバーシップ）                                       | Student 直結の子テーブル                                                                            | 数  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --- |
| `ExamStudent`（`@@unique[examId, studentId]`）             | `StudentAnswerImage` / `QuestionScore` / `ScoreDecision` / `CompoundAnswerScore` / `ReturnSnapshot` | 5   |
| `CourseworkStudent`（`@@unique[courseworkId, studentId]`） | `CourseworkScore`                                                                                   | 1   |
| `GradeStudent`（`@@unique[gradeId, studentId]`）           | `GradeOverride` / `GradeFrozenScore` / `GradeItemExclusion`                                         | 3   |

**対象は計 9 テーブル。**

なお `StudentClassroomMembership` は「人の学級所属」そのものであり対象外。`Student` を主語とする
`/students`・`/classrooms`・student-import 系も対象外。

## 2. 現状の実害

### 2.1 削除経路が子データを取りこぼす

親を消す唯一の経路が手書きで子を削除しており、いずれも網羅できていない。

| 削除関数                                         | 消しているもの                  | 取りこぼし                                                                                   |
| ------------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------- |
| `examStudent.ts:150 removeStudentsFromExam`      | ExamStudent, StudentAnswerImage | **QuestionScore / ScoreDecision / CompoundAnswerScore / ReturnSnapshot / DrawingAnnotation** |
| `coursework.ts:808 removeStudentsFromCoursework` | CourseworkStudent のみ          | **CourseworkScore（全部）**                                                                  |
| `gradeStudent.ts:235 removeClassroomAndStudents` | GradeStudent, GradeClassroom    | **GradeOverride / GradeFrozenScore / GradeItemExclusion（全部）**                            |

`ExamStudent` を参照する子テーブルが 1 つも無いため、DB の `onDelete: Cascade` では何も消せない。
Student 軸・Exam 軸の cascade は正しく張られているが、**メンバーシップ軸だけ cascade が構造的に存在しない**。

対して「答案 1 枚を削除する」経路（`studentAnswer/crud.ts:596-629`）は QuestionScore・ScoreDecision・
CompoundAnswerScore・DrawingAnnotation まで正しく消している。同じ意味の削除に 2 実装があり、片方だけが
不完全という状態になっている。

さらに `gradingData.ts:93 deleteAllGradingDataForStudent`（「生徒の採点データを完全に削除」）が実装されて
いるが、**コードベースのどこからも呼ばれていない**。仕様は書かれ、実装も用意され、配線だけが落ちている。
（この関数自体も ScoreDecision 等を消さないので、配線しても不十分。DB の cascade に委ねるのが正解。）

### 2.2 破棄は既存仕様である（仕様変更ではない）

`StudentRemovalConfirmModal.tsx:90-100` は、採点データがある生徒を試験から外すとき既にこう表示している。

> 生徒を削除すると、以下のデータも連動して削除されます：
> ・答案シート情報 ・採点結果・コメント ・設問別得点記録 ・最終成績情報
> ※ この操作は取り消すことができません

ユーザーはこれに同意して削除している。本計画は仕様変更ではなく **仕様への適合** である。

### 2.3 表示は隠すのに成績算出だけが孤児を算入する

試験側は全経路が ExamStudent 起点のため、孤児は画面にも出力にも現れない。

- Excel: `excel/dataFetcher.ts:8` が `getStudentsForExam`（ExamStudent 軸）を起点とする。学級平均
  （`averageRows.ts:102-106`）の母集団にも入らない
- 05/07/08 の画面: ExamStudent 行で描画される

一方、成績算出は孤児を拾う。

- `gradeCalculator.ts:144`: `where: { cropRegion: { examPage: { examId } } }` のみ。**ExamStudent の
  絞り込みが無い**。ScoreDecision（`:155`）も同様
- 本体ループは GradeStudent 軸（`:83`。変数名は `examStudents` だが中身は `gradeStudent.findMany`）。
  `examScoreCalculator.ts:22` が `questionScore.studentId === studentId` で引くため、ExamStudent に居ない
  生徒でも GradeStudent に居ればヒットする
- `:196-204` で ExamStudent の status を読むが用途は「見込→欠測」だけ。**存在しない生徒は
  `statusMap.get()` が `undefined` を返して特別扱いを受けず、孤児の素点がそのまま採用される**（`:253`）

Coursework も同型。`rawScoreCalculator.ts:116` の
`item.scores.find((score) => score.studentId === studentId)` は CourseworkStudent を経由しない。

**帰結**: 試験・資料のどこにも姿を見せない孤児が、成績算出でだけ「点が増える」方向に効く。

Grade の 3 テーブルはループが GradeStudent 軸のため孤児が直接算入されることはないが、**生徒を外して
再度追加すると過去の上書き値・確定値・除外設定が復活する**。特に `GradeFrozenScore` は確定（凍結）した
成績値であり、これが蘇るのは実害が大きい。

## 3. 設計方針

### 3.1 3 層モデル

```
Student            ← 人。試験横断で同一人物を追う主語（成績算出のループ軸はここ）
  ↓ × examId / courseworkId / gradeId
ExamStudent / CourseworkStudent / GradeStudent   ← その試験・資料・成績における対象者
  ↓
採点・点数・上書き・確定・除外などの子データ
```

成績算出の **軸は Student のまま**とする。メンバーシップの id は親ごとに別物であり、複数試験をまたぐと
繋がらないため。変わるのは「各親のデータを引く瞬間」で、そこで `Student × parentId → メンバーシップ` の
解決が 1 回入る。Coursework 昇格で採用した 3 層モデルと同じ構造。

### 3.2 これが再発を型で防ぐ

メンバーシップ経由を強制すると:

- **その試験の受験者でない生徒は構造的にスコアを引けなくなる。** 解決に失敗した＝受験していない＝欠測
- **`status` が必ず経路上に現れる**ため、`gradeCalculator.ts:196-204` の `statusMap` プリロードが不要になる。
  あれは ExamStudent を別途引いておきながら「存在しない」を見逃していた箇所であり、経路に組み込まれれば
  見逃しようがなくなる
- 列名が変わること自体が型の安全網になる。`where: { studentId }` と書いた瞬間に Prisma の型がエラーにする

### 3.3 Map は症状であって原因ではない

`Map<studentId, Map<dataSourceId, number|null>>` が必要になったのは、DB に「その生徒のその試験での成績」を
表す実体が無く、2 つの id を突き合わせるしかなかったためである。実体ができれば Prisma の include が
そのまま構造を表すので Map は不要になる。

**Map の解消は本計画の成果物であり、別途の棚卸し作業ではない。** 対象:

| 箇所                                                | 現状                                                  | 変更後                         |
| --------------------------------------------------- | ----------------------------------------------------- | ------------------------------ |
| `gradeCalculator.ts:194` `examExamStudentStatusMap` | `Map<examId, Map<studentId, string>>`                 | 経路上に status があるため消滅 |
| `gradeCalculator.ts:200` `statusMap`                | `Map<studentId, string>`                              | 同上                           |
| `gradeCalculator.ts:234` `rawScoreMap`              | `Map<studentId, Map<dataSourceId, number\|null>>`     | セルが実体を持つ形へ           |
| `absentEstimation.ts`（9 箇所が引数で受ける）       | 同上                                                  | 同上                           |
| `scoringInitializer.ts:48` `existingSet`            | `` `${studentId}#${cropRegionId}` `` の文字列連結キー | 実体で判定                     |
| `returnSnapshot.ts:130,132,158,192`                 | `Map<studentId, ...>`                                 | 要棚卸し                       |
| `statisticsCalculator.ts:311` `scoreByStudentId`    | `Map<studentId, number\|null>`                        | 要棚卸し                       |

branded type は導入しない。Prisma 拡張型を使う既存の型規約がその役割を果たしており、Map で裸の `string` に
射影した時点で守りが外れていたのが問題だった。規約は既に正しい。

### 3.4 renderer へ渡す主語

判断基準は `prismaExtensions.ts:69-78` に既に明文化されている（`ExamStudentWithMemberships`）。
**`examId` / `courseworkId` / `gradeId` が文脈にあるならメンバーシップが主語、無ければ Student が主語。**

| 主語              | 対象                                                          |
| ----------------- | ------------------------------------------------------------- |
| ExamStudent       | 05 受験生徒 / 06 答案 / 07 採点 / 08 出力、および採点データ行 |
| CourseworkStudent | coursework の名簿・点数                                       |
| GradeStudent      | grades の行                                                   |
| Student           | `/students` 生徒マスタ、`/classrooms` 学級、student-import    |

射影しない規約はそのまま。スコア行の include が 1 段深くなるだけである。

```ts
// 現在: questionScore.ts:175
include: { student: true, cropRegion: {...}, user: true }
// 変更後
include: { examStudent: { include: { student: true } }, cropRegion: {...}, user: true }
```

renderer は `questionScore.student.lastName` → `questionScore.examStudent.student.lastName` になる。
「氏名は表示時に計算」も変わらない。

**規約違反として同時に是正するもの**: `excel/dataFetcher.ts:43,224` の
`(Student & { examStudent?: ExamStudent })[]` は Student 主語に ExamStudent を optional で後付けした
合成型で主従が逆。`examStudent` が optional なため「受験者かどうか不明な生徒」を型が許してしまっている。
`ExamStudentWithMemberships` に寄せる。

## 4. 影響範囲（実測）

- **影響ファイル: 321 / 全 1,104（29%）** — `studentId` に触れるファイルと 9 テーブルに触れるファイルの和集合
- `studentId` 参照 1,949 行 / 256 ファイル（`examStudentId` は現状 13 行）
- テスト: 44 ファイルが 9 テーブルのいずれかに触れる（全 100 テストファイル）

比較参考: Class→Classroom 全面リネームは本体コミット `e904914f` が 145 ファイル、期間合計 588 ファイル /
+15,716 行（10 日・51 コミット）。本計画の影響範囲はその 2 倍以上に及ぶ。

**さらにあれとは質が違う。** Class→Classroom は機械的置換で、名前が変わるだけで値は不変・型も同じ・
置換漏れはコンパイルエラーで出た。本計画は値が変わり、`studentId` と `examStudentId` はどちらも `string`
であるため、**取り違えてもコンパイルが通り、実行時に別人の答案・別人の点数になる**。段階を分けて各段階で
実データ検証を行う理由はここにある。

## 5. Phase 分割

依存が下流（grade）← 上流（exam / coursework）であるため、上流から着手する。

| Phase | 対象                                                  | 併せて直す集計経路                                      | アーカイブ                                      |
| ----- | ----------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| **A** | ExamStudent 系 5 テーブル                             | `gradeCalculator.ts:144` の exam 経路、`statusMap` 撤去 | exam 1.20.0 → 1.21.0                            |
| **B** | CourseworkScore                                       | `rawScoreCalculator.ts:116` の coursework 経路          | coursework 1.0.0 → 1.1.0、grade 1.11.0 → 1.12.0 |
| **C** | GradeOverride / GradeFrozenScore / GradeItemExclusion | grade 内部の参照、セル実体化                            | grade 1.12.0 → 1.13.0                           |

Phase B で grade アーカイブも上がるのは、`.grade` が Coursework を内包し、収集・生成を coursework-archive
モジュールへ委譲しているため（v1.5.0 の設計）。

### 5.1 再編集を最小化する取り決め（重要）

Phase A で exam の列名が変われば `gradeCalculator` はコンパイルエラーになるため、grade を触らない選択肢は
ない。したがって **Phase A / B では grade に対して「機械的な型追随のみ」を行い、設計判断を伴う変更
（Map の解消・セル実体化）は Phase C で一度に行う**。

この線引きを守らないと、Phase A で grade の Map を中途半端に直し、Phase C で再び考え直すことになる。

| ファイル                | Phase A                   | Phase B                 | Phase C                             |
| ----------------------- | ------------------------- | ----------------------- | ----------------------------------- |
| `gradeCalculator.ts`    | exam 経路・statusMap 撤去 | coursework 経路         | override/frozen/exclusion、Map 解消 |
| `rawScoreCalculator.ts` | exam 呼び出しの追随       | `getCourseworkRawScore` | —                                   |
| grade の renderer       | 型追随のみ                | 型追随のみ              | セル実体化                          |

## 6. マイグレーション設計

### 6.1 共通手順（各テーブル）

Prisma 7 は datasource に url を持たず `migrate dev` を実行できないため、`migration.sql` は手書きし、
起動時に `migrationDeployer` が適用する。SQLite のため列の入れ替えは RedefineTables（テーブル再作成）
となる。`20260725000000_restore_asb_manuscript_divider_columns/migration.sql` を雛形とする。

1. `PRAGMA defer_foreign_keys=ON; PRAGMA foreign_keys=OFF;`
2. `CREATE TABLE "new_X"`（`studentId` を `examStudentId` に置換、FK を ExamStudent へ）
3. `INSERT INTO "new_X" SELECT ... JOIN ExamStudent`（バックフィル。孤児は JOIN で落ちる）
4. **孤児件数を AuditLog へ記録**（後述）
5. `DROP TABLE "X"; ALTER TABLE "new_X" RENAME TO "X";`
6. インデックス・UNIQUE を再作成
7. `PRAGMA foreign_keys=ON;`

**注意**: `RENAME TO` は `PRAGMA foreign_keys=ON` で囲まないと子テーブルの FK 参照が旧名のまま残る
（deployer は FK 既定 OFF・非トランザクション）。検証は空 DB の `foreign_key_check` では不十分で、
`sqlite_master` の定義文を目視すること。

### 6.2 親 id への到達経路（バックフィル JOIN）

| テーブル               | 経路                               |
| ---------------------- | ---------------------------------- |
| `StudentAnswerImage`   | `ExamPage.examId`                  |
| `QuestionScore`        | `CropRegion → ExamPage.examId`     |
| `ScoreDecision`        | `CropRegion → ExamPage.examId`     |
| `CompoundAnswerScore`  | `CompoundAnswer → ExamPage.examId` |
| `ReturnSnapshot`       | `examId` を直接保持                |
| `CourseworkScore`      | `CourseworkItem.courseworkId`      |
| `GradeOverride` ほか 2 | `gradeId` を直接保持               |

### 6.3 孤児の扱い

**破棄する。** 削除確認モーダルが既に破棄を約束しており（§2.2）、孤児は「本来存在しないはずだったもの」
であるため。救済すると不具合の産物を正当化することになる。

### 6.4 起動時に通知しない — 監査ログに残す

実運用は data フォルダの手動コピーであり、起動時のマイグレーションに通知を割り込ませても
「最初にそのコピーを開いた人にだけ出る」ため機能しない。起動シーケンス中のモーダルは単純に邪魔でもある。

代わりに **migration SQL の中から直接 `AuditLog` へ INSERT する**（`AuditLog.userId` は FK を張らない
設計のため素の SQL で書ける）。0 件なら行を作らない。

```sql
INSERT INTO AuditLog (id, createdAt, updatedAt, userId, action, category,
                      entityType, entityId, summary, metadata)
SELECT ..., NULL, 'system.migration.cleanup_orphaned_scores', 'system', ...
WHERE (孤児が 1 件以上ある場合のみ)
```

- 起動フローに割り込まない
- `AuditLog` は同期対象（`deleteProtected: true`）のため、共有 DB でもコピー運用でも記録が残る
- 必要になった人が監査ログ画面で後から取りに行ける

### 6.5 fresh-install replay との整合

新規 DB は init baseline（`migrationSql.ts`）＋ post-init の全 migration replay で構築される。
**新しい migration を `MIGRATION_CHECKSUMS` に足してはならない**（足すと replay されず DB に反映されない）。
検証は空 DB へ全 SQL を昇順適用し、`freshInstallChain.test.ts` のドリフト検知を通すこと。

## 7. アーカイブ設計

`idRemapper` は既に `examStudent: Record<string, string>` のマッピングを持ち（`merge/types.ts:19`、
`exam-archive/idRemapper.ts:28`）、アーカイブは `examStudents` を同梱している（`examArchive.types.ts`）。
したがって transformer はアーカイブ内で `examStudents` を引いて `studentId → examStudentId` を解決できる。

ただしこれは **これまでのデフォルト値埋め型ではなく「解決型」transformer** であり、当該アーカイブ初の形式になる。

### 7.1 各 Phase の対応

- **型定義**: `ArchiveScoresData.questionScores[].studentId` → `examStudentId`。`scoreDecisions` /
  `returnSnapshots` / `compoundAnswerScores` / `studentAnswerImages` も同様
- **Export**: `exam-archive/dataCollector.ts`（`:108-113` の studentIds 収集、`:254-370` の各行生成）
- **Import**: `exam-archive/dataCreator.ts`（`:511-620` の remap + create）、`idRemapper.ts`、`archiveExtractor.ts`
- **merge**: `scoringConflictDetector.ts` / `importScoring.ts` / `idChangeExecutor.ts` / `imageImporter.ts` /
  `idIntegrationImporter.ts` / `decisionMergePolicy.ts`
- **transformer**: `V1_20_0_to_V1_21_0.ts` を新設し `transformers/index.ts` の `EXAM_TRANSFORMERS` に登録

### 7.2 旧アーカイブ内の孤児

アーカイブ内にも `examStudents` に載っていない生徒の採点行が存在しうる。**DB 側と同じく破棄**し、
transformer の `warnings` に件数を載せる（2026-07-28 確定）。

アーカイブには「正本・存在について忠実復元」という裁定があるが、孤児は「本来存在しないはずだったもの」で
あり忠実復元の対象外とする。復元すべき正本の姿は、削除確認モーダルが約束したとおりの状態である。

### 7.3 idChangeExecutor のカスケード

`changeStudentId` は delete + 再作成方式のため、Student に cascade 子を足すと道連れになる罠がある。
配線変更後は子が ExamStudent 側へ移るため、`STUDENT_CASCADE_MOVERS` の内容が変わる。
`cascadeCoverage.test.ts` が schema.prisma 駆動で網羅を強制しているため、登録漏れは自動検出される。

## 8. テスト戦略

### 8.1 新規に必要なもの

- **削除経路の網羅テスト**: 試験・資料・成績から生徒を外したとき、子データが全て消えること（現状の
  取りこぼしを再現→是正を確認）
- **孤児バックフィルテスト**: 孤児を含む DB に migration を適用し、孤児が破棄され AuditLog に記録されること
- **成績算出の結果一致テスト**: 移行前後で、孤児を含まない生徒の算出結果が完全に一致すること
- **`cascadeCoverage.test.ts` の拡張**: ターゲットに ExamStudent / CourseworkStudent / GradeStudent を追加

### 8.2 既存で更新が必要なもの

44 ファイル。特に `helpers/testDataFactory.ts`・`helpers/testExamBuilder.ts`・
`screenshots/helpers/seed-in-test.ts` はファクトリのため全テストに波及する。

### 8.3 migration 検証

- 空 DB へ全 migration を昇順適用（`freshInstallChain.test.ts`）
- 実 DB のコピーへ適用してのリハーサル
- `normalizeDatetime.test.ts` の `POST_MIGRATION_TABLES` 更新（新テーブルではないが列構成が変わるため確認）
- `sqlite_master` の定義文で FK 参照名を目視

## 9. 周知

仕様変更ではなく **不具合修正**として告知する（§2.2）。ただし実質的に変わる点が 2 つある。

> **修正**: 試験・資料・成績から生徒を削除したとき、採点結果や点数が削除されずに残る不具合を修正しました。
> 削除確認画面の説明どおりに削除されるようになります。
>
> **ご注意 1**: これまで、削除した生徒を再度追加すると以前の採点結果・成績が残っている場合がありましたが、
> 今後は復元されません。
>
> **ご注意 2**: 該当する生徒がいる場合、**修正後は成績算出の結果が変わります**（これまでは、削除したはずの
> 得点が算入されていました）。試験の受験者として登録されていない生徒は「データなし」として扱われます。

## 10. 確定事項と残る変動要因

本計画は 2026-07-28 に確定した。設計上の未決事項は残っていない。

**確定した判断**:

1. **スコープは 9 テーブル・3 サブシステム**を一括で対象とし、Phase A → B → C の順に実施する（§5）
2. **Phase A / B では grade に機械的な型追随のみを行う。** 設計判断を伴う変更（Map の解消・セル実体化）は
   Phase C に集約する（§5.1）
3. **孤児は DB・アーカイブとも破棄する**（§6.3、§7.2）
4. **移行時に起動時通知を出さず、AuditLog に記録する**（§6.4）
5. **branded type は導入しない。** Prisma 拡張型の既存規約で足りる（§3.3）
6. **#1071（採点範囲と権限）は本計画の完了後に着手する。** Phase A 期間中に `ScoringMainView` や採点画面の
   フックが衝突するため

**残る変動要因**: 321 ファイルのうち、`Map<string, ...>` のキーとして `studentId` が流れているだけで
変数名に現れない箇所は、着手するまで正確に数えられない。Phase A を実際に通してから Phase B / C の
作業量を見積もり直す。

## 11. Phase A の実施結果（2026-07-28）

**完了。** ExamStudent 系 5 テーブル（`StudentAnswerImage` / `QuestionScore` / `ScoreDecision` /
`CompoundAnswerScore` / `ReturnSnapshot`）を `examStudentId` へ配線変更した。実変更は
**159 ファイル / +2,108 −1,708 行**（見立ての 321 は Phase B / C を含む和集合）。

計画から外れた点・追加で判明した点:

- **`ReturnSnapshot.examId` 列を削除した**（計画では言及なし）。`ExamStudent` が `examId` を持つため
  両方を残すと `examId ≠ examStudent.examId` が起こりうる。`@@unique([examId, studentId])` は
  `examStudentId @unique` になった
- **`gradeCalculator` の試験データ取得を ExamStudent 起点へ組み替えた。** `ExamDataCache` が
  `examStudents: ExamStudentScores[]`（受験者ごとに解決済みスコアと `status` を持つ）になり、
  §3.2 のとおり `examExamStudentStatusMap` / `statusMap` は不要になって消えた
- **`scoringInitializer.ts` の `${studentId}#${cropRegionId}` 文字列連結キーが消えた。** 受験者ごとに
  子の採点行を include して引くようにしたため、既存判定が受験者の内側で閉じる
- **`resolveEffectiveScores` の `studentId: string | null` が `string` になった。** 列が NOT NULL に
  なったので null ガードと `as string` が両方落ちた
- **`ScoringData`（Excel/PDF 出力の DTO）は `examStudentId` と `studentId` を両方持つ。** 学級所属は
  Student キーなので、学級平均の突き合わせには人としての id が要る。出力用 DTO であり DB へは書き戻さない
- **`STUDENT_CASCADE_MOVERS` から 5 件が消えた。** 採点層が Student の cascade 子ではなくなり、
  `ExamStudent` の移し替えだけで追従する。`cascadeCoverage.test.ts` が schema 駆動で検証している
- **落とし穴**: IPC ハンドラで DTO を組み立てる箇所（`export:getExcelPreviewData`）は、返り値に
  文脈型が付かず余剰プロパティ検査が効かないため、`studentId:` のまま残しても **typecheck が通る**。
  実行時にだけ S-P 表・プレビューが壊れる。同型の箇所（preload の型・`upload-answer-sheets` の引数型）を
  併せて洗い出して是正した

追加したテスト:

- `__tests__/exam/integration/examStudentRemoval.test.ts` — 試験から生徒を外すと 5 テーブルとも消え、
  他生徒は巻き添えにならず、再追加しても復元されない
- `__tests__/migration/rewireScoringToExamStudent.test.ts` — 本マイグレーションの1つ手前まで適用して
  旧形状データを投入し、付け替え・孤児破棄・AuditLog 記録・`RENAME TO` 後の FK 参照名を検証
- `__tests__/grade/integration/gradeExamStudentScope.test.ts` — 試験から外した生徒の得点が成績算出に
  算入されないこと（#962 の非対称の解消）と、見込→欠測が従来どおり効くこと
- `examTransformerChain.test.ts` に 1.20.0 → 1.21.0 の解決・孤児破棄の2本を追加

**Phase B / C の見積もり**: Phase A の実績（159 ファイル）に対し、Coursework は 1 テーブル・
経路も `rawScoreCalculator.ts:116` の1本なので小さい（20 ファイル前後）。Phase C は grade 3 テーブルに
加えて §3.3 の Map 解消（`absentEstimation.ts` の 9 引数を含む）とセル実体化が乗るため、
Phase A と同等かそれ以上になる。

## 12. Phase B の実施結果（2026-07-29）

**完了。** `CourseworkScore` を `courseworkStudentId` へ配線変更した。見立てどおり小さく収まった。

計画から外れた点・追加で判明した点:

- **`.coursework` を入れ子の射影ツリーから、テーブルごとの平坦なセクションへ作り直した**
  （coursework 1.1.0 / grade 1.12.0）。当初は「名簿に id が無いので点数の参照だけ変えると
  変換器が id を作る羽目になる」として形状据え置きを提案したが、OWNER 裁定により
  **exam-archive と揃え、Prisma のクエリが返した行をそのまま JSON に持つ**方針とした。
  - 収集は射影しない。JSON に載らない型だけを `JSON.stringify` と同じ規則で文字列にする
    （DateTime → ISO 文字列、Decimal → 文字列。exam-archive の `partialScore` と同じ）
  - 旧 1.0.0 の結合行（学級・タグ・名簿・点数・変換表）は id を持たないが、いずれも
    `@@unique` を持つ中間テーブルなので **自然キーから id を組み立てる**
    （`deterministicId.ts` と同じ規則。同じアーカイブを何度読んでも同じ id ＝冪等）。
    組み立てた id はアーカイブ内の結合キーとしてのみ使い、DB へは書き込まない
  - 旧形式に無い `createdAt`/`updatedAt` は復元できないため下限値を入れ、warning で伝える
- **旧版の形の知識は変換器ディレクトリへ閉じ込めた。** `src/types/courseworkArchive.types.ts`
  は現行の形だけを宣言し、`coursework-transformers/types.ts` が版ごとの
  「アーカイブ全体の型」（`CourseworkArchiveDataV1_0_0`）と変換器・チェーンの型を持つ。
  変換器は `V1_0_0 → V1_1_0` として型付けされ、`unknown` もキャストも使っていない
  （版が変わらない外部参照セクションは共有し、実際に変わった部分だけ版ごとに書く）
- **旧アーカイブ内の孤児は破棄し、資料ごとに1本の警告へまとめた。** 従来は点数1件ごとに
  警告を積んでいたため、孤児が多いアーカイブでは警告が溢れていた
- **`idChangeExecutor` の `CourseworkStudent` mover が data-loss 経路になっていた。**
  `CourseworkScore` mover は Student 直結ではなくなったので消えるが、`CourseworkStudent` の
  重複行を `delete` する既存分岐が cascade で点数を道連れにする。移行先に同じ評価項目の
  点数が無いものを先に付け替えてから delete するようにして、旧来の
  「移行先の点数を残し、衝突した元の点数を捨てる」挙動を保った（`project_idchange_cascade_hazard`）
- **IPC の点数 upsert 入力が 4 層（renderer / preload / handler / DB 層）で同じ形を
  重複定義していた。** Phase A で踏んだ「余剰プロパティ検査が効かず 1 層直し忘れても
  typecheck が通る」型の罠なので、`CourseworkScoreUpsertInput` として 1 箇所に集約した
- **`prisma.updateMany` の `where` は余剰プロパティ検査が効かない。**
  `gradeFrozenScore.test.ts` の `where: { studentId }` は typecheck を通り、実行時にだけ
  `PrismaClientValidationError` で落ちた。`findMany`/`create` は捕まえるので油断しやすい

追加したテスト:

- `__tests__/coursework/courseworkCrud.test.ts` — 資料から生徒を外すと点数も消え、
  他生徒は巻き添えにならず、再追加しても復元されない
- `__tests__/migration/rewireCourseworkScoreToCourseworkStudent.test.ts` — 付け替え・
  孤児破棄・AuditLog 記録・`RENAME TO` 後の FK 参照名
- `__tests__/grade/integration/gradeCourseworkStudentScope.test.ts` — 資料から外した生徒の
  点数が成績算出に算入されないこと
- `cascadeCoverage.test.ts` に「`CourseworkScore` の親は `CourseworkStudent`・Student 直結ではない」
- `__tests__/import-export/unit/courseworkTransformerChain.test.ts` — 1.0.0 → 1.1.0 の展開・
  点数の付け替え・孤児破棄・冪等性・version 偽装時の形状ベース下方補正
- `gradeTransformerChain.test.ts` に 1.11.0 → 1.12.0（内包資料の平坦化）の3本

- **採点対象と受験者・対象者が同じ親に属することを、書き込みの入口で検査するようにした。**
  FK は「それぞれが実在すること」しか保証せず、両者が同じ Exam / Coursework に属することは
  強制されない。id はどちらも string なので取り違えてもコンパイルが通り、書けてしまうと
  「その試験の受験者一覧に居ない生徒の得点」が成績算出に算入される — §2.3 の非対称が
  別の入口から復活する。`examScopeGuard.ts` に集約し、Phase A で残していた試験側
  （`QuestionScore` / `ScoreDecision` / `CompoundAnswerScore` / `StudentAnswerImage`）も
  併せて塞いだ。`initializeScoringRecords` だけは採点領域も受験者も同じ `examId` から
  引くため構造的に安全で、検査を足していない（その旨を doc コメントに明記）
  - **守れるのはアプリのコードが書く経路だけ。** NAS 同期はライブラリから DB へ直接書く。
    ただし同期は行単位で運ぶため食い違ったペアを新たに作ることは無い（`cropRegionId` と
    `examStudentId` は同じ 1 行にあり、列ごとのマージはしていない）。同期で起こりうるのは
    参照先が消えた行が残ること

**未着手のまま残した項目**:

- **資料・成績の名簿からの生徒削除には確認ダイアログが無い。** 試験（05）は
  `StudentRemovalConfirmModal` で破棄を明示しているが、`RosterTable` の `enableRemove` は
  無確認で削除する（`slots.onBeforeRemove` は用意されているだけで利用者ゼロ）。
  Phase B で削除が破壊的になったため、確認の必要性が上がった。ただし grade の名簿も
  同じ形なので、Phase C でまとめて入れる方が一貫する
