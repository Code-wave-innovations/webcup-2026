-- F47 / F48: immutable audit journal (who did what, when, on which record)
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actor_id` INTEGER NULL,
    `actor_role` ENUM('CITIZEN', 'AGENT', 'ADMIN') NULL,
    `actor_name` VARCHAR(191) NULL,
    `action` VARCHAR(64) NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entity_id` INTEGER NULL,
    `entity_label` VARCHAR(191) NULL,
    `changes` JSON NULL,
    `metadata` JSON NULL,
    `ip` VARCHAR(64) NULL,

    INDEX `AuditLog_entity_entity_id_idx`(`entity`, `entity_id`),
    INDEX `AuditLog_actor_id_created_at_idx`(`actor_id`, `created_at`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
