ALTER TABLE `AiProvider` ADD COLUMN `userId` VARCHAR(191) NULL;

SET @ai_config_owner_id = (
  SELECT `id`
  FROM `AppUser`
  WHERE `account` = 'q19946502'
  LIMIT 1
);

INSERT INTO `AppUser` (`id`, `slug`, `account`, `role`, `displayName`, `createdAt`, `updatedAt`)
SELECT 'ai-config-owner-q19946502', 'ai-config-owner-q19946502', 'q19946502', 'USER', 'q19946502', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE @ai_config_owner_id IS NULL;

SET @ai_config_owner_id = (
  SELECT `id`
  FROM `AppUser`
  WHERE `account` = 'q19946502'
  LIMIT 1
);

UPDATE `AiProvider`
SET `userId` = @ai_config_owner_id
WHERE `userId` IS NULL;

ALTER TABLE `AiProvider` MODIFY `userId` VARCHAR(191) NOT NULL;

DROP INDEX `AiProvider_slug_key` ON `AiProvider`;
DROP INDEX `AiProvider_enabled_idx` ON `AiProvider`;

CREATE UNIQUE INDEX `AiProvider_userId_slug_key` ON `AiProvider`(`userId`, `slug`);
CREATE INDEX `AiProvider_userId_enabled_idx` ON `AiProvider`(`userId`, `enabled`);

ALTER TABLE `AiProvider` ADD CONSTRAINT `AiProvider_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
