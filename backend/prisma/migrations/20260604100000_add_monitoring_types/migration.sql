-- Créer le nouveau type enum
CREATE TYPE "MonitoringType_new" AS ENUM (
  'STRATEGIC', 'COMPETITIVE', 'SECTORAL', 'COMMERCIAL', 'CUSTOMER', 'PRODUCT',
  'TECHNOLOGICAL', 'INNOVATION', 'SCIENTIFIC', 'REGULATORY_LEGAL', 'STANDARDIZATION',
  'ENVIRONMENTAL', 'ECONOMIC', 'SOCIETAL', 'POLITICAL', 'GEOPOLITICAL',
  'REPUTATION', 'MEDIA_PRESS', 'SOCIAL_MEDIA', 'ORGANIZATIONAL', 'SUPPLY_CHAIN',
  'CYBERSECURITY'
);

ALTER TABLE "Project" ALTER COLUMN "monitoring_type" DROP DEFAULT;

ALTER TABLE "Project" ALTER COLUMN "monitoring_type" TYPE "MonitoringType_new"
  USING (CASE WHEN "monitoring_type"::text = 'REGULATORY' THEN 'REGULATORY_LEGAL'::"MonitoringType_new"
              ELSE "monitoring_type"::text::"MonitoringType_new"
         END);

DROP TYPE "MonitoringType" CASCADE;

ALTER TYPE "MonitoringType_new" RENAME TO "MonitoringType";

ALTER TABLE "Project" ALTER COLUMN "monitoring_type" SET DEFAULT 'STRATEGIC';
