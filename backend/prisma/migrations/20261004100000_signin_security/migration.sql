-- AlterTable
ALTER TABLE `User` ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `two_factor_enabled_at` DATETIME(3) NULL,
    ADD COLUMN `two_factor_secret` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `UserDevice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `device_hash` VARCHAR(64) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `first_seen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_ip` VARCHAR(64) NULL,

    INDEX `UserDevice_first_seen_idx`(`first_seen`),
    UNIQUE INDEX `UserDevice_user_id_device_hash_key`(`user_id`, `device_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TwoFactorRecoveryCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `code_hash` VARCHAR(191) NOT NULL,
    `used_at` DATETIME(3) NULL,

    INDEX `TwoFactorRecoveryCode_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Passkey` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `credential_id` VARCHAR(255) NOT NULL,
    `public_key` LONGBLOB NOT NULL,
    `counter` INTEGER NOT NULL DEFAULT 0,
    `transports` VARCHAR(191) NULL,
    `label` VARCHAR(120) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_used_at` DATETIME(3) NULL,

    UNIQUE INDEX `Passkey_credential_id_key`(`credential_id`),
    INDEX `Passkey_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserDevice` ADD CONSTRAINT `UserDevice_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TwoFactorRecoveryCode` ADD CONSTRAINT `TwoFactorRecoveryCode_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Passkey` ADD CONSTRAINT `Passkey_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

