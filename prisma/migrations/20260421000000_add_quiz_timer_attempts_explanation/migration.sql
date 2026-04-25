-- AlterEnum
ALTER TYPE "AssessmentType" ADD VALUE 'TRUE_FALSE';

-- AlterTable
ALTER TABLE "CourseLesson" ADD COLUMN "maxAttempts" INTEGER,
ADD COLUMN "timeLimitMin" INTEGER;

-- AlterTable
ALTER TABLE "LessonAssessment" ADD COLUMN "explanation" TEXT;
