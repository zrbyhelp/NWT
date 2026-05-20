CREATE TABLE `StoryScript` (
  `id` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `titleZh` VARCHAR(191) NOT NULL,
  `titleEn` VARCHAR(191) NOT NULL,
  `descriptionZh` TEXT NOT NULL,
  `descriptionEn` TEXT NOT NULL,
  `welcomeZh` TEXT NOT NULL,
  `welcomeEn` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `StoryScript_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Conversation` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `scriptId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `Conversation_scriptId_idx`(`scriptId`),
  INDEX `Conversation_updatedAt_idx`(`updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatMessage` (
  `id` VARCHAR(191) NOT NULL,
  `conversationId` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ChatMessage_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_scriptId_fkey`
  FOREIGN KEY (`scriptId`) REFERENCES `StoryScript`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_conversationId_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
