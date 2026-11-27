-- Rencontres à plusieurs activités, et points payés par activité.
--
-- 1. Event.activities : liste des activités de la rencontre. `type` reste l'activité principale
--    (affichage, tri) et figure toujours dans la liste. Chaque rencontre existante garde son
--    activité actuelle, comme principale et seule activité : aucune perte.
-- 2. PointTransaction.grantSeq : l'anti-doublon devient « une règle, une fois par rang, par
--    membre et par source ». Plusieurs règles peuvent payer une même présence (une par activité),
--    et une nouvelle attribution après une correction garde sa règle (rang + 1) au lieu d'être
--    écrite sans règle.
--
-- Tout ou rien : Prisma n'enveloppe pas une migration dans une transaction.

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Activités des rencontres
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "Event" ADD COLUMN "activities" "EventType"[];
UPDATE "Event" SET "activities" = ARRAY["type"];

-- Liste sans NULL ni doublon (une contrainte CHECK ne peut pas contenir de sous-requête).
CREATE FUNCTION "event_activities_valid"(a "EventType"[]) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT array_position(a, NULL) IS NULL
     AND cardinality(a) = (SELECT count(DISTINCT x) FROM unnest(a) AS x)
$$;

-- NOT NULL porté par la contrainte : Prisma déclare les listes sans NOT NULL, ce qui évite un
-- écart entre ce fichier et le schéma.
ALTER TABLE "Event" ADD CONSTRAINT "Event_activities_check" CHECK (
  "activities" IS NOT NULL
  AND cardinality("activities") BETWEEN 1 AND 7
  AND "type" = ANY ("activities")
  AND "event_activities_valid"("activities")
);

CREATE INDEX "Event_activities_idx" ON "Event" USING GIN ("activities");

-- ---------------------------------------------------------------------------------------------
-- 2. Grand livre des points
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "PointTransaction" ADD COLUMN "grantSeq" INTEGER NOT NULL DEFAULT 0;

-- L'ancienne contrainte (sans rang) empêcherait de rendre sa règle à une réattribution : elle
-- est retirée d'abord, la nouvelle est créée une fois les rangs calculés.
DROP INDEX "PointTransaction_userId_ruleId_sourceType_sourceId_key";

-- Les nouvelles attributions après correction étaient écrites sans règle. On leur rend la leur :
-- (a) d'après le journal d'audit (« points.awarded », métadonnée « rule »), sans ambiguïté ;
UPDATE "PointTransaction" pt SET "ruleId" = r."id"
FROM "AuditLog" a
JOIN "PointRule" r ON r."code" = a."metadata"->>'rule'
WHERE pt."ruleId" IS NULL
  AND pt."sourceType" NOT IN ('MANUAL', 'CORRECTION')
  AND a."action" = 'points.awarded'
  AND a."entityType" = 'PointTransaction'
  AND a."entityId" = pt."id";

-- (b) à défaut, la seule règle déjà liée à la même source (jusqu'ici, une règle par source).
UPDATE "PointTransaction" pt SET "ruleId" = o."ruleId"
FROM (
  SELECT "userId", "sourceType", "sourceId", min("ruleId") AS "ruleId"
  FROM "PointTransaction"
  WHERE "ruleId" IS NOT NULL
  GROUP BY 1, 2, 3
  HAVING count(DISTINCT "ruleId") = 1
) o
WHERE pt."ruleId" IS NULL
  AND pt."sourceType" NOT IN ('MANUAL', 'CORRECTION')
  AND pt."userId" = o."userId"
  AND pt."sourceType" = o."sourceType"
  AND pt."sourceId" = o."sourceId";

-- Rangs : 0 pour la première attribution d'une règle à une source, puis 1, 2…
UPDATE "PointTransaction" pt SET "grantSeq" = s.n
FROM (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "userId", "ruleId", "sourceType", "sourceId"
           ORDER BY "createdAt", "id"
         ) - 1 AS n
  FROM "PointTransaction"
  WHERE "ruleId" IS NOT NULL
) s
WHERE pt."id" = s."id" AND s.n > 0;

CREATE UNIQUE INDEX "PointTransaction_userId_ruleId_sourceType_sourceId_grantSeq_key"
  ON "PointTransaction"("userId", "ruleId", "sourceType", "sourceId", "grantSeq");

-- Garde-fou : une ligne sans règle est un ajustement manuel ou une correction, rien d'autre.
-- La migration échoue si une ligne n'a pas pu être rattachée à sa règle.
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_rule_link_check"
  CHECK (("ruleId" IS NULL) = ("sourceType" IN ('MANUAL', 'CORRECTION')));

COMMIT;
