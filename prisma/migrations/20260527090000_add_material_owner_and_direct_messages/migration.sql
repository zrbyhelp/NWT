INSERT INTO `AppUser` (`id`, `slug`, `displayName`, `createdAt`, `updatedAt`)
VALUES ('default-local', 'default-local', '本地默认用户', NOW(), NOW())
ON DUPLICATE KEY UPDATE `displayName` = `displayName`;

ALTER TABLE `StoryMaterial` ADD COLUMN `ownerUserId` VARCHAR(191) NULL;

UPDATE `StoryMaterial` AS material
LEFT JOIN (
  SELECT `materialId`, MIN(`userId`) AS `userId`
  FROM `StoryMaterialLibraryEntry`
  WHERE `source` = 'SELF_CREATED'
  GROUP BY `materialId`
) AS ownerEntry ON ownerEntry.`materialId` = material.`id`
SET material.`ownerUserId` = COALESCE(ownerEntry.`userId`, 'default-local');

DELETE FROM `StoryMaterial`
WHERE `slug` IN (
  'echo-mask',
  'mirror-mourning-mask',
  'floating-city-map',
  'tidal-route-chart',
  'echo-compass',
  'neon-access-chip',
  'night-ink-vial',
  'mistguard-beast',
  'lantern-wisp'
);

ALTER TABLE `StoryMaterial` MODIFY `ownerUserId` VARCHAR(191) NOT NULL;

CREATE INDEX `StoryMaterial_ownerUserId_createdAt_idx` ON `StoryMaterial`(`ownerUserId`, `createdAt`);

ALTER TABLE `StoryMaterial`
  ADD CONSTRAINT `StoryMaterial_ownerUserId_fkey`
  FOREIGN KEY (`ownerUserId`) REFERENCES `AppUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `DirectMessageThread` (
  `id` VARCHAR(191) NOT NULL,
  `participantAId` VARCHAR(191) NOT NULL,
  `participantBId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `DirectMessageThread_participantAId_participantBId_key`(`participantAId`, `participantBId`),
  INDEX `DirectMessageThread_participantAId_updatedAt_idx`(`participantAId`, `updatedAt`),
  INDEX `DirectMessageThread_participantBId_updatedAt_idx`(`participantBId`, `updatedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DirectMessage` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NOT NULL,
  `senderId` VARCHAR(191) NOT NULL,
  `recipientId` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `DirectMessage_threadId_createdAt_idx`(`threadId`, `createdAt`),
  INDEX `DirectMessage_recipientId_readAt_createdAt_idx`(`recipientId`, `readAt`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DirectMessageThread`
  ADD CONSTRAINT `DirectMessageThread_participantAId_fkey`
  FOREIGN KEY (`participantAId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DirectMessageThread`
  ADD CONSTRAINT `DirectMessageThread_participantBId_fkey`
  FOREIGN KEY (`participantBId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DirectMessage`
  ADD CONSTRAINT `DirectMessage_threadId_fkey`
  FOREIGN KEY (`threadId`) REFERENCES `DirectMessageThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DirectMessage`
  ADD CONSTRAINT `DirectMessage_senderId_fkey`
  FOREIGN KEY (`senderId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DirectMessage`
  ADD CONSTRAINT `DirectMessage_recipientId_fkey`
  FOREIGN KEY (`recipientId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
