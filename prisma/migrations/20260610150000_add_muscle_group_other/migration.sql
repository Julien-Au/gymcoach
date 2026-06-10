-- Additive migration (issue #100): an OTHER fallback muscle group for
-- imported exercises that cannot be auto-classified. Enum value only, no
-- table or data change.

-- AlterEnum
ALTER TYPE "MuscleGroup" ADD VALUE 'OTHER';
