ALTER TABLE `AppUser`
  ADD COLUMN `externalUserId` VARCHAR(191) NULL,
  ADD COLUMN `email` VARCHAR(191) NULL,
  ADD COLUMN `username` VARCHAR(191) NULL,
  ADD COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';

CREATE UNIQUE INDEX `AppUser_externalUserId_key` ON `AppUser`(`externalUserId`);
CREATE INDEX `AppUser_email_idx` ON `AppUser`(`email`);
CREATE INDEX `AppUser_username_idx` ON `AppUser`(`username`);
CREATE INDEX `AppUser_status_idx` ON `AppUser`(`status`);
