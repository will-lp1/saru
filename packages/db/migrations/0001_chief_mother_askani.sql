DO $$ BEGIN
 CREATE TYPE "public"."document_visibility" AS ENUM('public', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentVersion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"diff_content" text,
	"previous_version_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
); -- close DocumentVersion definition
--> statement-breakpoint
ALTER TABLE "Document" DROP CONSTRAINT "Document_id_createdAt_pk";
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'private' NOT NULL;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "document_version_id" uuid;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "style" jsonb;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "author" text;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "slug" text;
-- Ensure each Document.id is unique by moving older rows to DocumentVersion and deleting duplicates
-- ------------------------------------------------------------------------------
-- 1. Back-fill non-current (historical) Document rows into DocumentVersion
INSERT INTO "DocumentVersion" ("documentId", "version", "content", "diff_content", "previous_version_id", "created_at", "updated_at")
SELECT d."id",
       COALESCE((SELECT MAX(v."version") + 1 FROM "DocumentVersion" v WHERE v."documentId" = d."id"), 1) AS "version",
       d."content",
       NULL,
       NULL,
       d."createdAt",
       d."updatedAt"
FROM "Document" d
WHERE d."is_current" = false
ON CONFLICT DO NOTHING;

-- 2. Back-fill a version-1 record for any current document that still lacks history
INSERT INTO "DocumentVersion" ("documentId", "version", "content", "diff_content", "previous_version_id", "created_at", "updated_at")
SELECT d."id", 1, COALESCE(d."content", '') AS "content", NULL, NULL, d."createdAt", d."updatedAt"
FROM "Document" d
LEFT JOIN "DocumentVersion" v ON v."documentId" = d."id" AND v."version" = 1
WHERE d."is_current" = true AND v."id" IS NULL
ON CONFLICT DO NOTHING;

-- 3. Link current Document rows to their version-1 ids if not already linked
UPDATE "Document" d
SET "document_version_id" = (
  SELECT v."id" FROM "DocumentVersion" v
  WHERE v."documentId" = d."id" AND v."version" = 1
  LIMIT 1
)
WHERE d."document_version_id" IS NULL;

-- 4. Delete duplicate Document rows, keeping the latest/current one per id
WITH dup AS (
  SELECT ctid,
         ROW_NUMBER() OVER (PARTITION BY id ORDER BY is_current DESC, "createdAt" DESC) AS rn
  FROM "Document"
)
DELETE FROM "Document" d USING dup
WHERE d.ctid = dup.ctid AND dup.rn > 1;
-- ------------------------------------------------------------------------------
--> statement-breakpoint
ALTER TABLE "Document" ADD PRIMARY KEY ("id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_previous_version_id_DocumentVersion_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."DocumentVersion"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription" ADD CONSTRAINT "subscription_reference_id_user_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Document" ADD CONSTRAINT "Document_document_version_id_DocumentVersion_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."DocumentVersion"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
