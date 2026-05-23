CREATE TABLE `InstantMeshConfig` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `baseUrl` VARCHAR(191) NOT NULL,
  `encryptedApiKey` TEXT NULL,
  `submitPath` VARCHAR(191) NOT NULL DEFAULT '/api/instantmesh/tasks',
  `statusPathTemplate` VARCHAR(191) NOT NULL DEFAULT '/api/instantmesh/tasks/{taskId}',
  `pollIntervalMs` INTEGER NOT NULL DEFAULT 1500,
  `timeoutSeconds` INTEGER NOT NULL DEFAULT 900,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `InstantMeshConfig_userId_enabled_isDefault_idx`(`userId`, `enabled`, `isDefault`),
  INDEX `InstantMeshConfig_userId_createdAt_idx`(`userId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InstantMeshConfig`
  ADD CONSTRAINT `InstantMeshConfig_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
