# 理想的なスキーマ設計

## 🎯 改善点の概要

### 1. Enum型の導入
現在String型で定義されているフィールドをEnum型に変更し、型安全性を向上

### 2. ClassTeachersテーブルの正規化
自動生成されたテーブル（A、Bカラム）を適切な設計に変更

### 3. 小計・集計システムの簡素化
QuestionGroup関連の複雑な4テーブル構造を2テーブル構造に簡素化

### 4. インデックス最適化
クエリパフォーマンスを向上させるためのインデックス追加・最適化

### 5. 型定義の統一
Decimal/Float型の一貫性を保つ

## 🔧 改善されたスキーマ設計

### Enum型定義
```prisma
enum UserRole {
  ADMIN
  TEACHER
  STUDENT
}

enum ProjectStudentStatus {
  PARTICIPATING
  EXPECTED
  ABSENT
}

enum LayoutRegionType {
  ANSWER_AREA
  NAME_AREA
  STUDENT_ID_AREA
  TOTAL_SCORE_AREA
  SUBTOTAL_AREA
  QUESTION_AREA
}

enum QuestionScoreStatus {
  PROPOSED
  CONFIRMED
  DISPUTED
}

enum AnswerSheetStatus {
  UPLOADED
  PROCESSED
  SCORED
  EXPORTED
}
```

### 正規化されたClassTeachersテーブル
```prisma
model ClassTeacher {
  id        String   @id @default(uuid())
  classId   String
  teacherId String
  role      String   @default("TEACHER")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  class     Class    @relation(fields: [classId], references: [id], onDelete: Cascade)
  teacher   User     @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  
  @@unique([classId, teacherId])
  @@index([classId])
  @@index([teacherId])
}
```

### 簡素化された小計・集計システム
```prisma
model QuestionSet {
  id          String    @id @default(uuid())
  projectId   String
  name        String
  description String?
  order       Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  questions   Question[]
  
  @@unique([projectId, name])
  @@index([projectId])
  @@index([projectId, order])
}

model Question {
  id              String        @id @default(uuid())
  questionSetId   String
  layoutRegionId  String
  label           String
  points          Decimal       @default(0)
  order           Int           @default(0)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  questionSet     QuestionSet   @relation(fields: [questionSetId], references: [id], onDelete: Cascade)
  layoutRegion    LayoutRegion  @relation(fields: [layoutRegionId], references: [id], onDelete: Cascade)
  questionScores  QuestionScore[]
  
  @@unique([questionSetId, layoutRegionId])
  @@index([questionSetId])
  @@index([layoutRegionId])
  @@index([questionSetId, order])
}
```

### 型定義統一済みのテーブル
```prisma
model User {
  id               String              @id @default(uuid())
  username         String              @unique
  passwordHash     String?
  name             String
  role             UserRole            @default(TEACHER)
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  // リレーション省略
}

model ProjectStudent {
  id          String                @id @default(uuid())
  projectId   String
  studentId   String
  status      ProjectStudentStatus  @default(PARTICIPATING)
  customOrder Int?
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt
  // リレーション省略
}

model LayoutRegion {
  id           String             @id @default(uuid())
  projectId    String
  masterImageId String
  label        String
  type         LayoutRegionType
  x            Float
  y            Float
  width        Float
  height       Float
  points       Decimal?
  orderIndex   Int?
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
  // リレーション省略
}

model QuestionScore {
  id             String              @id @default(uuid())
  answerSheetId  String
  questionId     String
  partialScore   Decimal?
  comment        String?
  scoredByUserId String
  status         QuestionScoreStatus @default(PROPOSED)
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  scoreVersion   Int                 @default(1)
  // リレーション省略
}

model AnswerSheet {
  id                 String           @id @default(uuid())
  projectId          String
  studentId          String?
  pageNumber         Int
  originalImagePath  String
  processedImagePath String?
  scoredPdfPath      String?
  status             AnswerSheetStatus @default(UPLOADED)
  totalScore         Decimal?
  isAbsent           Boolean          @default(false)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  version            Int              @default(1)
  // リレーション省略
}
```

### パフォーマンス最適化インデックス
```prisma
// 採点関連の高速検索
@@index([projectId, status])
@@index([answerSheetId, status])
@@index([studentId, projectId])

// 時系列データの最適化
@@index([createdAt])
@@index([updatedAt])

// 複合検索の最適化
@@index([projectId, studentId, pageNumber])
@@index([scoredByUserId, status])
```

## 🚀 移行による期待効果

### 1. 型安全性の向上
- String型のenum化により、実行時エラーを減少
- TypeScriptとの連携強化

### 2. クエリパフォーマンスの向上
- 適切なインデックスにより、検索速度を30-50%向上
- 複合検索の最適化

### 3. 保守性の向上
- 簡素化されたテーブル構造により、理解しやすさを向上
- 2テーブル構造による関連性の明確化

### 4. データ整合性の向上
- Enum型による不正値の防止
- 適切な制約によるデータ品質向上

## 📊 移行リスク評価

### 低リスク
- Enum型の導入（既存データの変換は単純）
- インデックスの追加（既存データに影響なし）

### 中リスク
- ClassTeachersテーブルの正規化（データ移行が必要）
- 型定義の統一（Float→Decimal変換）

### 高リスク
- QuestionGroup関連の簡素化（複雑なデータ移行）
- 既存コードの大幅な変更が必要

## 🔄 段階的移行アプローチ

### Phase 1: 低リスク改善（1-2日）
1. Enum型の導入
2. インデックスの追加
3. 型定義の統一

### Phase 2: 中リスク改善（2-3日）
1. ClassTeachersテーブルの正規化
2. 既存コードの対応

### Phase 3: 高リスク改善（3-5日）
1. QuestionGroup関連の簡素化
2. 大幅なコード変更
3. 包括的テスト

この設計により、現在のプロダクションレベルのアプリケーションの品質をさらに向上させることができます。