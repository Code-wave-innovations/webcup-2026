-- AlterTable
ALTER TABLE `User` ADD COLUMN `reset_code_by_id` INTEGER NULL,
    ADD COLUMN `reset_code_expires_at` DATETIME(3) NULL,
    ADD COLUMN `reset_code_hash` VARCHAR(191) NULL;

