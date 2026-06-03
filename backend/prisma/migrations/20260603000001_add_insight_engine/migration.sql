-- CreateTable
CREATE TABLE "WeakSignal" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL DEFAULT 'ENTITY',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "novelty_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "growth_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cross_source_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frequency_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "explanation" TEXT,
    "source_count" INTEGER NOT NULL DEFAULT 0,
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeakSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendPoint" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL DEFAULT 'TOPIC',
    "date" TIMESTAMP(3) NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "source_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeakSignal_project_id_idx" ON "WeakSignal"("project_id");
CREATE INDEX "WeakSignal_project_id_score_idx" ON "WeakSignal"("project_id", "score");

-- CreateIndex
CREATE INDEX "TrendPoint_project_id_entity_name_idx" ON "TrendPoint"("project_id", "entity_name");
CREATE INDEX "TrendPoint_project_id_date_idx" ON "TrendPoint"("project_id", "date");
CREATE UNIQUE INDEX "TrendPoint_project_id_entity_name_date_key" ON "TrendPoint"("project_id", "entity_name", "date");

-- CreateIndex
CREATE INDEX "Insight_project_id_type_idx" ON "Insight"("project_id", "type");
CREATE INDEX "Insight_project_id_created_at_idx" ON "Insight"("project_id", "created_at");
