CREATE TABLE `AiProvider` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `baseUrl` VARCHAR(191) NOT NULL,
  `encryptedApiKey` TEXT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AiProvider_slug_key`(`slug`),
  INDEX `AiProvider_enabled_idx`(`enabled`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LlmModel` (
  `id` VARCHAR(191) NOT NULL,
  `providerId` VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `modelId` VARCHAR(191) NOT NULL,
  `contextWindow` INTEGER NOT NULL DEFAULT 128000,
  `temperature` DOUBLE NOT NULL DEFAULT 0.7,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `LlmModel_providerId_modelId_key`(`providerId`, `modelId`),
  INDEX `LlmModel_providerId_idx`(`providerId`),
  INDEX `LlmModel_enabled_isDefault_idx`(`enabled`, `isDefault`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VectorModel` (
  `id` VARCHAR(191) NOT NULL,
  `providerId` VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `modelId` VARCHAR(191) NOT NULL,
  `dimensions` INTEGER NOT NULL,
  `maxInputTokens` INTEGER NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `VectorModel_providerId_modelId_key`(`providerId`, `modelId`),
  INDEX `VectorModel_providerId_idx`(`providerId`),
  INDEX `VectorModel_enabled_isDefault_idx`(`enabled`, `isDefault`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LlmModel` ADD CONSTRAINT `LlmModel_providerId_fkey`
  FOREIGN KEY (`providerId`) REFERENCES `AiProvider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `VectorModel` ADD CONSTRAINT `VectorModel_providerId_fkey`
  FOREIGN KEY (`providerId`) REFERENCES `AiProvider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
