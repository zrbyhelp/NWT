CREATE TABLE `StoryMaterial` (
  `id` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `category` ENUM('MASK', 'MAP', 'ITEM', 'CREATURE') NOT NULL,
  `titleZh` VARCHAR(191) NOT NULL,
  `titleEn` VARCHAR(191) NOT NULL,
  `descriptionZh` TEXT NOT NULL,
  `descriptionEn` TEXT NOT NULL,
  `previewUrl` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `StoryMaterial_slug_key`(`slug`),
  INDEX `StoryMaterial_category_createdAt_idx`(`category`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StoryMaterialLibraryEntry` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `materialId` VARCHAR(191) NOT NULL,
  `source` ENUM('SELF_CREATED', 'COMMUNITY_ADDED') NOT NULL DEFAULT 'COMMUNITY_ADDED',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `StoryMaterialLibraryEntry_userId_materialId_key`(`userId`, `materialId`),
  INDEX `StoryMaterialLibraryEntry_materialId_idx`(`materialId`),
  INDEX `StoryMaterialLibraryEntry_userId_createdAt_idx`(`userId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `StoryMaterialLibraryEntry`
  ADD CONSTRAINT `StoryMaterialLibraryEntry_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StoryMaterialLibraryEntry`
  ADD CONSTRAINT `StoryMaterialLibraryEntry_materialId_fkey`
  FOREIGN KEY (`materialId`) REFERENCES `StoryMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
