-- AlterTable
ALTER TABLE `Alert` ADD COLUMN `notified_at` DATETIME(3) NULL,
    ADD COLUMN `notify` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `recipients` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Alert_notify_notified_at_idx` ON `Alert`(`notify`, `notified_at`);

