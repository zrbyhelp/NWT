CREATE TABLE `ImageModel` (
  `id` VARCHAR(191) NOT NULL,
  `providerId` VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `modelId` VARCHAR(191) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ImageModel_providerId_modelId_key`(`providerId`, `modelId`),
  INDEX `ImageModel_providerId_idx`(`providerId`),
  INDEX `ImageModel_enabled_isDefault_idx`(`enabled`, `isDefault`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ImageModel`
  ADD CONSTRAINT `ImageModel_providerId_fkey`
  FOREIGN KEY (`providerId`) REFERENCES `AiProvider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
