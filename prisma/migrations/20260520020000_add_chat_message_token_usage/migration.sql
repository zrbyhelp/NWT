ALTER TABLE `ChatMessage`
  ADD COLUMN `promptTokens` INTEGER NULL,
  ADD COLUMN `completionTokens` INTEGER NULL,
  ADD COLUMN `tokenUsageEstimated` BOOLEAN NOT NULL DEFAULT false;
