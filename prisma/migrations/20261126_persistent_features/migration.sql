-- Persist extracted file text and associate it with an owned conversation.
ALTER TABLE "UploadedFile"
ADD COLUMN "conversationId" TEXT,
ADD COLUMN "extractedText" TEXT NOT NULL DEFAULT '';

ALTER TABLE "UploadedFile"
ALTER COLUMN "extractedText" DROP DEFAULT;

ALTER TABLE "UploadedFile"
ADD CONSTRAINT "UploadedFile_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "UploadedFile_conversationId_idx" ON "UploadedFile"("conversationId");

-- Shared fixed-window counters for distributed API rate limiting.
CREATE TABLE "ApiRateLimit" (
    "scope" TEXT NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ApiRateLimit_pkey" PRIMARY KEY ("scope", "subjectHash", "windowStart")
);

CREATE INDEX "ApiRateLimit_windowStart_idx" ON "ApiRateLimit"("windowStart");
