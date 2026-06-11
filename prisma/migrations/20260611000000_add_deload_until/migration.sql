-- Additive migration (issue #112): one-tap planned deload week. One nullable
-- column on User, no change to any other table or row. Null (every existing
-- user) means "no planned deload", which is the current behavior.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "deloadUntil" TIMESTAMP(3);
