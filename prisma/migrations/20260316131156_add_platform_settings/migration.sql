-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultThemeId" TEXT NOT NULL DEFAULT 'medieval',
    "aiMentorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "peerReviewEnabled" BOOLEAN NOT NULL DEFAULT true,
    "selfAssessmentEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
