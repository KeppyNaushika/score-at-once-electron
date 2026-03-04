-- AlterTable: ヘッダーフィールドに type と fontSize を追加
ALTER TABLE "AsbHeaderField" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'field';
ALTER TABLE "AsbHeaderField" ADD COLUMN "fontSize" REAL;
