# 型・命名クリーンアップ 残タスク

05-students / 06 / 08-export まわりの型・命名整理の作業メモ。
「Prisma のデータ構造をそのまま持つ」規約への整合と、濁った命名・不要型の排除が目的。

## 完了済み（参考）

- `GradingDataInfo` / `ExamStudentData` / `ScoringDataWithRank` — いずれも不要と判明し**削除**（型注釈を外して TS 推論に委譲、`GradingDataInfo` は `hasData` が `totalItems>0` と冗長のため件数1スカラーへ簡素化）
- `Student`（05）= `StudentWithMemberships & { 計算フィールド }` へ Prisma 拡張型化。`StudentMembership` / `ClassGroup` / 死フィールド `isInExam` を除去
- `StudentStatus` → **`ExamStudentStatus`** に改名（SSOT `src/types/examStudentStatus.types.ts`）。`ScoringStatus` と対の構造（const + union + `isX` + `toX`）
- **#5 DB 小文字統一**: `ExamStudent.status` を `participating|expected|absent` に統一（migration `20260705000000_lowercase_examstudent_status`）。`toUpperCase`/`toLowerCase` の往復を全廃し、`toExamStudentStatus` は `toScoringStatus` と同型の純粋な絞り込みに。アーカイブは v1.17.0 + `V1_16_0_to_V1_17_0` 変換器で旧大文字を正規化

---

## 残タスク

### b. データ表現の設計（局所的）

#### b-1. RosterTable 関連のデータの持ち様は適切か
- `src/components/common/roster-table/` と、それを使う 05-students / grades / coursework の各 Container のデータ受け渡しを点検
- `RosterClassOption` 等の共有型の持ち方、`extras` バッグ（`row.extras?.status as ...` のような型無しアクセス）の妥当性を確認
- 論点: 汎用テーブルに渡すデータが型安全か、`as` キャストや `unknown` バッグに逃げていないか

#### b-2. `Set<string>` を props/state に直接持つのは妥当か
- 例: `useExamStudentsData` の `selectedStudentsForRemoval: Set<string>`、`ReturnDiffPanel` の `selectedStudents: Set<string>`、`usePendingChanges` の `affectedCells: Set<string>`
- 論点: `Set` を prop 境界で渡すことの是非（React の再レンダリング判定・シリアライズ・イミュータビリティ）。配列 + ヘルパー、あるいは専用フックに閉じ込めるべきか検討

#### b-3. `ReturnDiffPanelProps` は適切か
- `src/components/exams/08-export/components/ReturnDiffPanel.tsx` の Props（`students: Student[]` / `selectedStudents: Set<string>` / `setSelectedStudents`）
- 論点: 表示名解決のためだけに全生徒を渡す設計、`Set` の受け渡し（b-2 と関連）、`setSelectedStudents` を生で渡す形の妥当性

### c. 大物リファクタ（中核 IPC 契約の変更）

#### c-1. `getStudentsForExam` の戻り値を Prisma ネイティブへ + `examClassInfo` の分離

**背景（この作業で確定した設計）**
今 `Student`（05）と呼んでいる object の正体は **Student ではなく ExamStudent**（Exam×Student×Classroom を3つの中間テーブルで結合し生徒1人に畳んだビュー）。現状は取得境界で平坦化した手書き合成型。

**方針**
- 実体の基底を `ExamStudent` の Prisma GetPayload にする:
  ```ts
  type ExamStudentWithDetails = Prisma.ExamStudentGetPayload<{
    include: {
      student: {
        include: {
          memberships: { include: { classroom: true } }
          _count: { select: { studentAnswerImages: true } }
        }
      }
    }
  }>
  ```
  → `status` / `customOrder`（ExamStudent 実列）、identity・memberships、答案枚数（`_count`）がすべてスキーマ追従の Prisma 型に。手書き graft ゼロ
- 還元不能な `examClassInfo` だけを分離:
  - 型名は **`ExamClassroomPlacement`**（`StudentClassInfo` の `Info` 濁りを排除）
  - 形は概ね Prisma 派生: `Prisma.ExamClassroomGetPayload<{ include: { classroom: true } }> & { attendanceNumber: number | null }`（`attendanceNumber` のみ membership 由来の付加）
  - `Student` にマージせず `Record<studentId, ExamClassroomPlacement>` の side data として保持し、使用箇所で `placementByStudent[examStudent.studentId]` 参照
- 命名: 変数は `examStudent`（`entry` 等の濁り禁止）、ネストが煩い箇所は `const student = examStudent.student` で実体名エイリアス
- 平坦アクセス（`student.lastName`）→ ネスト（`examStudent.student.lastName`）の冗長さは**受け入れる**（規約優先）

**影響範囲（`getStudentsForExam` 消費者 6ファイル）**
- `src/components/exams/05-students/.../useExamStudentsData.ts`
- `src/components/exams/05-students/.../ExamStudentAddModalContainer.tsx`
- `src/app/exams/[examId]/06-student-answers/hooks/index.tsx`
- `src/components/exams/08-export/hooks/useExportPage.ts`
- `src/hooks/useExamDetail.ts`
- `electron-src/lib/prisma/pdfExport.ts` / `electron-src/lib/export/excel/dataFetcher.ts`

**進め方**: 型定義 → `getStudentsForExam` の戻り値形状 → 各消費者を順に、途中で `typecheck` を通しながら段階的に。並行セッション所有ファイルに注意。

**補足**: 06 hooks/index.tsx の sort に `memberships?.[0]?.attendanceNumber` の `[0]` 索引アンチパターンが残存（本 reframe or 別途で `examClassInfo`/placement へ寄せる）。

---

## 進め方の推奨
1. まず現状の緑（改名 + #5）を `/git-workflow` でコミットしてチェックポイント化
2. b（局所的・3件）を片付ける
3. 最後に c-1 の reframe（最大の山）
