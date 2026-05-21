ALTER TABLE `StoryMaterial` ADD COLUMN `communityVisible` BOOLEAN NOT NULL DEFAULT true;

UPDATE `StoryMaterial`
SET `communityVisible` = false
WHERE `id` IN (
  SELECT `materialId`
  FROM `StoryMaterialLibraryEntry`
  WHERE `source` = 'SELF_CREATED'
);
