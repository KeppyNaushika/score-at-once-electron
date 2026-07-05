# renderer 型リファクタ 残計画

型規約に沿った renderer 側データ構造の整理。**規約の全文はメモリ `feedback_type_conventions.md`（＋核心は `docs/coding-style.md` §型管理の方針）**。要点：

- renderer で DB 管理データは原則 **Prisma 拡張型**（`Prisma.XGetPayload<{ include }>`）で DB と構造一致。
- DB 由来データを計算した値 → 原則そのコンポーネント内で計算。長い→引数渡し or フック。複数箇所→共通フック。
- Decimal→number / string→literal union は**境界での型注入**（`Omit<Model,"f"> & { f: 補正型 }` ＋ `toX()`/`.toNumber()`）。`SerializedQuestionScore` / `ScoringStatus` が前例。
- ファイル書き出し（Excel/PDF）は DB 非反映の read-out ＝**型制限の対象外**。ただし「必要な型」を渡す（乱立禁止）。
- **独自型を制限する目的＝ DB への書き込み整合性の保護。**

---

## 現在のチェックポイント（実装済み・**未コミット**・typecheck/lint/テスト緑）

- b-1/b-2/b-3: RosterTable の無型 `extras` 撤去 / 選択を `useStudentSelection` フックへ集約（`useMemo` も除去）/ `ReturnDiffPanel` を `selectedStudentIds: string[]` + intent へ
- c: 重複3 `Student` 型を **`ExamStudentWithDetails`（nested Prisma 拡張）** に統合。`getStudentsForExam` / IPC もこの型。05/06/08・electron 出力を nested アクセスへ（`examStudent.studentId` / `examStudent.student.X`）
- `StudentClassInfo` → **`ExamClassroomPlacement`** 改名。placement は **Prisma `Classroom` を同梱**（フラット `className` 文字列を廃止）
- 06 並び替えを **customOrder のみ**に単純化（falsy-zero・比較器重複・`[0]` 索引を撤去）
- 06 の重複8生徒型を暫定 **`UnifiedStudent`（`Pick<Student> & {...}`）** へ集約し、採番学級バッジを placement 経由に
- **Task 1 完了**: placement を renderer 側解決へ。専用 IPC（`getStudentClassInfo` map / `getStudentClassInfoSingle` single）と main `getStudentClassInfo`（単一）・未使用 `ExamClassroomPlacementMap` を撤去。新設 `src/lib/examClassroomPlacement.ts` の `resolveExamClassroomPlacement(administeredClasses)` が既存 `getAdministered`（DB 構造 IPC）から採番を計算。05/06 を載せ替え。境界型 `ExamClassroomPlacement` は残置（main `getStudentClassInfoForExam`＝export 経路がまだ使用）。

---

## 残タスク（この設計で確定）

### 2. 06 を nested 化（フラット `UnifiedStudent` を廃止）

- 現状の Pick ベース `UnifiedStudent` を廃し、**`ExamStudentWithDetails`（nested）を持ち回る**。
- 影響 ~14 ファイル（`student-answer-management` / `student-answer-table` の grid/table/dnd/upload）: `student.lastName`→`examStudent.student.lastName`、`student.id`→`examStudent.studentId`、`student.status`→`examStudent.status`、`student.customOrder`→`examStudent.customOrder`。
- 採番学級は 1 のフック（placement 側データ）で参照。`StudentWithAnswers` 等は `ExamStudentWithDetails & { フラグ }` に。
- フックの返り値「全体」に名前は付けない（推論／`ReturnType`）。

### 3. export（Excel/PDF）を renderer 主導に

- 型制限の対象外。renderer が採番を含む**必要な**データを export IPC に渡し、`dataFetcher` の `getStudentClassInfoForExam` 呼び出し（main 側採番解決）を撤去。
- 「好きな型」ではなく必要な型（乱立防止）。
- 完了時: main `getStudentClassInfoForExam` を撤去 → 境界型 `ExamClassroomPlacement` は renderer 専用になるので `src/lib/examClassroomPlacement.ts` へ移す。併せて `resolveExamClassroomPlacement` の単体テストを追加（現状は main の `getStudentClassInfoForExam` テストがロジックを担保）。

### 4. coding-style.md へ規約差分を追記（並行セッション完了後）

- 追記内容: 目的＝DB書き込み保護 / 書き出しは対象外＋必要な型 / 計算はコンポーネント・フック / Decimal・union の型注入。
- **`docs/coding-style.md` は現在並行セッションが編集中**のため、そのセッション完了を待って反映。

---

## 進め方メモ

- 1 → 2 → 3 の順（placement フック確立 → 06 nested → export 付け替え）。各段で typecheck ゲート。
- 並行セッション所有ファイル（`coding-style.md` / `identifier-vs-entity-audit.md` / `type-convention-audit.md`）は触らない。
- 本セッションの全変更は未コミット。区切りでコミットするかは要判断。
