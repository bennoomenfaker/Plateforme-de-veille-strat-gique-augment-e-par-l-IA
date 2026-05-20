-- AlterTable User: photo
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;

-- AlterTable Organisation: unique name + join codes
ALTER TABLE "Organisation" ADD COLUMN IF NOT EXISTS "join_code_equipe" TEXT;
ALTER TABLE "Organisation" ADD COLUMN IF NOT EXISTS "join_code_lecteur" TEXT;

-- CollectionPlanSource: optional URL + metadata
ALTER TABLE "CollectionPlanSource" ALTER COLUMN "source_url" DROP NOT NULL;
ALTER TABLE "CollectionPlanSource" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Unique organisation name (may fail if duplicates exist — merge duplicates manually first)
CREATE UNIQUE INDEX IF NOT EXISTS "Organisation_nom_key" ON "Organisation"("nom");
