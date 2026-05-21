ALTER TABLE `StoryMaterial`
  ADD COLUMN `style` ENUM('REALISTIC', 'FANTASY', 'SCI_FI', 'MYSTERY', 'CYBERPUNK', 'CLASSICAL', 'APOCALYPTIC') NOT NULL DEFAULT 'REALISTIC';

UPDATE `StoryMaterial` SET `style` = 'REALISTIC' WHERE `slug` = 'echo-mask';
UPDATE `StoryMaterial` SET `style` = 'MYSTERY' WHERE `slug` = 'mirror-mourning-mask';
UPDATE `StoryMaterial` SET `style` = 'SCI_FI' WHERE `slug` = 'floating-city-map';
UPDATE `StoryMaterial` SET `style` = 'FANTASY' WHERE `slug` = 'tidal-route-chart';
UPDATE `StoryMaterial` SET `style` = 'CLASSICAL' WHERE `slug` = 'echo-compass';
UPDATE `StoryMaterial` SET `style` = 'MYSTERY' WHERE `slug` = 'night-ink-vial';
UPDATE `StoryMaterial` SET `style` = 'APOCALYPTIC' WHERE `slug` = 'mistguard-beast';
UPDATE `StoryMaterial` SET `style` = 'FANTASY' WHERE `slug` = 'lantern-wisp';

CREATE INDEX `StoryMaterial_style_createdAt_idx` ON `StoryMaterial`(`style`, `createdAt`);
