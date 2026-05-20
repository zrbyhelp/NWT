CREATE TABLE `AppUser` (
  `id` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AppUser_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `AppUser` (`id`, `slug`, `displayName`, `createdAt`, `updatedAt`)
VALUES ('default-local', 'default-local', '本地默认用户', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

ALTER TABLE `Conversation` ADD COLUMN `userId` VARCHAR(191) NULL;

UPDATE `Conversation`
SET `userId` = 'default-local'
WHERE `userId` IS NULL;

ALTER TABLE `Conversation` MODIFY `userId` VARCHAR(191) NOT NULL;

CREATE TABLE `StoryScriptLibraryEntry` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `scriptId` VARCHAR(191) NOT NULL,
  `source` ENUM('SELF_CREATED', 'COMMUNITY_ADDED') NOT NULL DEFAULT 'COMMUNITY_ADDED',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `StoryScriptLibraryEntry_userId_scriptId_key`(`userId`, `scriptId`),
  INDEX `StoryScriptLibraryEntry_scriptId_idx`(`scriptId`),
  INDEX `StoryScriptLibraryEntry_userId_createdAt_idx`(`userId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `StoryScriptLibraryEntry` (`id`, `userId`, `scriptId`, `source`, `createdAt`, `updatedAt`)
SELECT CONCAT('default-local-', `id`), 'default-local', `id`, 'COMMUNITY_ADDED', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `StoryScript`
WHERE `slug` = 'base-ai-script';

CREATE INDEX `Conversation_userId_updatedAt_idx` ON `Conversation`(`userId`, `updatedAt`);

ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `AppUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `StoryScriptLibraryEntry` ADD CONSTRAINT `StoryScriptLibraryEntry_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StoryScriptLibraryEntry` ADD CONSTRAINT `StoryScriptLibraryEntry_scriptId_fkey`
  FOREIGN KEY (`scriptId`) REFERENCES `StoryScript`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
