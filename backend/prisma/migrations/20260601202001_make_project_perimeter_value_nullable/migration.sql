/*
  Warnings:

  - Changed the type of `type` on the `ProjectPerimeter` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "HypothesisImpact" AS ENUM ('OPEN', 'PARTIALLY_SUPPORTED', 'SUPPORTED', 'CONTRADICTED', 'NEEDS_MORE_RESEARCH');

-- AlterTable
ALTER TABLE "ProjectPerimeter" ALTER COLUMN "name" DROP NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "PerimeterType" NOT NULL,
ALTER COLUMN "value" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "type" "SourceType" NOT NULL DEFAULT 'WEB',
ALTER COLUMN "url" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CollectionJob" (
    "id" TEXT NOT NULL,
    "collection_plan_id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "trigger_type" "TriggerType" NOT NULL DEFAULT 'MANUAL',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "logs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawItem" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "collection_plan_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_name" TEXT,
    "source_url" TEXT,
    "article_url" TEXT,
    "file_path" TEXT,
    "title" TEXT,
    "content_raw" TEXT,
    "published_at" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedItem" (
    "id" TEXT NOT NULL,
    "raw_item_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "collection_plan_id" TEXT,
    "title" TEXT,
    "content_clean" TEXT,
    "content_excerpt" TEXT,
    "language" TEXT,
    "word_count" INTEGER,
    "char_count" INTEGER,
    "source_type" TEXT,
    "source_name" TEXT,
    "source_url" TEXT,
    "article_url" TEXT,
    "published_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'DONE',
    "error_message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ProcessedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "plan_id" TEXT,
    "raw_item_id" TEXT,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "trigger_type" TEXT NOT NULL DEFAULT 'MANUAL',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error" TEXT,
    "logs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichedItem" (
    "id" TEXT NOT NULL,
    "processed_item_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "collection_plan_id" TEXT,
    "hypothesis_id" TEXT,
    "answer" TEXT,
    "summary" TEXT,
    "entities" JSONB,
    "topics" JSONB,
    "sentiment" TEXT,
    "relevance_score" DOUBLE PRECISION,
    "hypothesis_impact" "HypothesisImpact" NOT NULL DEFAULT 'OPEN',
    "confidence_score" DOUBLE PRECISION,
    "raw_response" JSONB,
    "model_used" TEXT,
    "prompt_version" TEXT,
    "enriched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrichedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEnrichmentJob" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "plan_id" TEXT,
    "hypothesis_id" TEXT,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "trigger_type" TEXT NOT NULL DEFAULT 'MANUAL',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "model_used" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error" TEXT,
    "logs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiEnrichmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HypothesisEvaluation" (
    "id" TEXT NOT NULL,
    "hypothesis_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "HypothesisImpact" NOT NULL DEFAULT 'OPEN',
    "confidence" DOUBLE PRECISION,
    "summary" TEXT,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "support_count" INTEGER NOT NULL DEFAULT 0,
    "against_count" INTEGER NOT NULL DEFAULT 0,
    "neutral_count" INTEGER NOT NULL DEFAULT 0,
    "last_evaluated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HypothesisEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RawItem_hash_key" ON "RawItem"("hash");

-- CreateIndex
CREATE INDEX "RawItem_project_id_idx" ON "RawItem"("project_id");

-- CreateIndex
CREATE INDEX "RawItem_collection_plan_id_idx" ON "RawItem"("collection_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedItem_raw_item_id_key" ON "ProcessedItem"("raw_item_id");

-- CreateIndex
CREATE INDEX "ProcessedItem_project_id_idx" ON "ProcessedItem"("project_id");

-- CreateIndex
CREATE INDEX "ProcessedItem_collection_plan_id_idx" ON "ProcessedItem"("collection_plan_id");

-- CreateIndex
CREATE INDEX "ProcessedItem_language_idx" ON "ProcessedItem"("language");

-- CreateIndex
CREATE INDEX "ProcessedItem_processed_at_idx" ON "ProcessedItem"("processed_at");

-- CreateIndex
CREATE INDEX "ProcessingJob_project_id_idx" ON "ProcessingJob"("project_id");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_idx" ON "ProcessingJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EnrichedItem_processed_item_id_key" ON "EnrichedItem"("processed_item_id");

-- CreateIndex
CREATE INDEX "EnrichedItem_project_id_idx" ON "EnrichedItem"("project_id");

-- CreateIndex
CREATE INDEX "EnrichedItem_hypothesis_id_idx" ON "EnrichedItem"("hypothesis_id");

-- CreateIndex
CREATE INDEX "EnrichedItem_collection_plan_id_idx" ON "EnrichedItem"("collection_plan_id");

-- CreateIndex
CREATE INDEX "AiEnrichmentJob_project_id_idx" ON "AiEnrichmentJob"("project_id");

-- CreateIndex
CREATE INDEX "AiEnrichmentJob_status_idx" ON "AiEnrichmentJob"("status");

-- CreateIndex
CREATE INDEX "HypothesisEvaluation_project_id_idx" ON "HypothesisEvaluation"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "HypothesisEvaluation_hypothesis_id_key" ON "HypothesisEvaluation"("hypothesis_id");

-- AddForeignKey
ALTER TABLE "CollectionJob" ADD CONSTRAINT "CollectionJob_collection_plan_id_fkey" FOREIGN KEY ("collection_plan_id") REFERENCES "CollectionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedItem" ADD CONSTRAINT "ProcessedItem_raw_item_id_fkey" FOREIGN KEY ("raw_item_id") REFERENCES "RawItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedItem" ADD CONSTRAINT "ProcessedItem_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
