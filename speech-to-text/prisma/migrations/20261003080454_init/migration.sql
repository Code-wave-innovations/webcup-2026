-- CreateEnum
CREATE TYPE "TranscriptionJobStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "TranscriptionMode" AS ENUM ('FAST', 'BALANCED', 'ACCURATE');

-- CreateTable
CREATE TABLE "transcription_jobs" (
    "id" UUID NOT NULL,
    "status" "TranscriptionJobStatus" NOT NULL,
    "mode" "TranscriptionMode" NOT NULL,
    "language_hints" JSONB NOT NULL,
    "context" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "audio_path" TEXT,
    "text" TEXT,
    "languages" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "speakers" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "transcription_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_segments" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "start_ms" INTEGER NOT NULL,
    "end_ms" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "speaker_id" TEXT,
    "language" TEXT,
    "ord" INTEGER NOT NULL,

    CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_calls" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cost_usd_estimate" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_logs" (
    "id" UUID NOT NULL,
    "job_id" UUID,
    "api_key_hash" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transcript_segments_job_id_idx" ON "transcript_segments"("job_id");

-- CreateIndex
CREATE INDEX "provider_calls_job_id_idx" ON "provider_calls"("job_id");

-- CreateIndex
CREATE INDEX "access_logs_job_id_idx" ON "access_logs"("job_id");

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "transcription_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_calls" ADD CONSTRAINT "provider_calls_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "transcription_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "transcription_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
