-- Normalise les emails existants : suppression des espaces superflus + minuscules.
--
-- Objectif : un email est insensible à la casse. Sans cette normalisation,
-- un compte créé avec "User@Mail.com" ne pouvait plus se connecter en saisissant
-- "user@mail.com" (PostgreSQL compare les chaînes de manière sensible à la casse),
-- et deux comptes ne différant que par la casse pouvaient être créés.
--
-- ⚠️ Si deux comptes ne diffèrent QUE par la casse (ex. "A@x.com" et "a@x.com"),
-- l'UPDATE échouera sur la contrainte d'unicité "User_email_key". Il faut alors
-- fusionner ou supprimer le doublon avant de relancer la migration.

UPDATE "User"
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));

UPDATE "InvitationOrganisation"
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));
