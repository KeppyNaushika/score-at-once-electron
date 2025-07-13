-- AlterTable
ALTER TABLE "User" ADD COLUMN "passcode" TEXT;
ALTER TABLE "User" ADD COLUMN "passcodeType" TEXT DEFAULT 'none';
