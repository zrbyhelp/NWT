ALTER TABLE `LlmModel`
  ADD COLUMN `isGlobal` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `VectorModel`
  ADD COLUMN `isGlobal` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `ImageModel`
  ADD COLUMN `isGlobal` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `LlmModel_isGlobal_enabled_isDefault_idx` ON `LlmModel`(`isGlobal`, `enabled`, `isDefault`);
CREATE INDEX `VectorModel_isGlobal_enabled_isDefault_idx` ON `VectorModel`(`isGlobal`, `enabled`, `isDefault`);
CREATE INDEX `ImageModel_isGlobal_enabled_isDefault_idx` ON `ImageModel`(`isGlobal`, `enabled`, `isDefault`);
