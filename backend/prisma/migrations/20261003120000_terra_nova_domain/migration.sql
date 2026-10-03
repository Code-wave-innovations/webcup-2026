-- DropIndex
DROP INDEX `User_last_name_key` ON `User`;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `district_id` INTEGER NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `is_vulnerable` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `last_login_at` DATETIME(3) NULL,
    ADD COLUMN `locale` VARCHAR(191) NOT NULL DEFAULT 'fr',
    ADD COLUMN `onboarding_completed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `password_hash` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `preferences` JSON NULL,
    ADD COLUMN `role` ENUM('CITIZEN', 'AGENT', 'ADMIN') NOT NULL DEFAULT 'CITIZEN',
    ADD COLUMN `updated_at` DATETIME(3) NULL;

-- Backfill users created before authentication existed: placeholder email and a
-- password hash that never matches, so these accounts cannot log in until reset.
UPDATE `User` SET
    `email` = CONCAT('legacy-user-', `id`, '@novaterra.local'),
    `password_hash` = '!disabled',
    `updated_at` = `created_at`;

ALTER TABLE `User` MODIFY `email` VARCHAR(191) NOT NULL,
    MODIFY `password_hash` VARCHAR(191) NOT NULL,
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `District` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,

    UNIQUE INDEX `District_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `icon` VARCHAR(191) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `ServiceCategory_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CityService` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `category_id` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `keywords` VARCHAR(500) NULL,
    `icon` VARCHAR(191) NULL,
    `contact_email` VARCHAR(191) NULL,
    `contact_phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `opening_hours` VARCHAR(191) NULL,
    `external_url` VARCHAR(191) NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `CityService_slug_key`(`slug`),
    INDEX `CityService_category_id_idx`(`category_id`),
    INDEX `CityService_is_featured_priority_idx`(`is_featured`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Procedure` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `service_id` INTEGER NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `required_documents` JSON NULL,
    `form_schema` JSON NULL,
    `estimated_days` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Procedure_slug_key`(`slug`),
    INDEX `Procedure_service_id_idx`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentTranslation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `field` VARCHAR(64) NOT NULL,
    `value` TEXT NOT NULL,

    INDEX `ContentTranslation_entity_locale_idx`(`entity`, `locale`),
    UNIQUE INDEX `ContentTranslation_entity_entity_id_locale_field_key`(`entity`, `entity_id`, `locale`, `field`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CitizenRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `type` ENUM('CONTACT', 'PROCEDURE', 'INCIDENT') NOT NULL,
    `status` ENUM('SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'WAITING_CITIZEN', 'RESOLVED', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'SUBMITTED',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `citizen_id` INTEGER NULL,
    `contact_name` VARCHAR(191) NULL,
    `contact_email` VARCHAR(191) NULL,
    `service_id` INTEGER NULL,
    `procedure_id` INTEGER NULL,
    `assigned_agent_id` INTEGER NULL,
    `category` VARCHAR(191) NULL,
    `district_id` INTEGER NULL,
    `location_label` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `attachment` VARCHAR(191) NULL,
    `data` JSON NULL,
    `resolved_at` DATETIME(3) NULL,

    UNIQUE INDEX `CitizenRequest_reference_key`(`reference`),
    INDEX `CitizenRequest_status_idx`(`status`),
    INDEX `CitizenRequest_type_idx`(`type`),
    INDEX `CitizenRequest_citizen_id_idx`(`citizen_id`),
    INDEX `CitizenRequest_assigned_agent_id_idx`(`assigned_agent_id`),
    INDEX `CitizenRequest_service_id_idx`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequestEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `request_id` INTEGER NOT NULL,
    `author_id` INTEGER NULL,
    `type` ENUM('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED', 'COMMENT') NOT NULL,
    `from_status` ENUM('SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'WAITING_CITIZEN', 'RESOLVED', 'REJECTED', 'CLOSED') NULL,
    `to_status` ENUM('SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'WAITING_CITIZEN', 'RESOLVED', 'REJECTED', 'CLOSED') NULL,
    `message` TEXT NULL,
    `is_internal` BOOLEAN NOT NULL DEFAULT false,

    INDEX `RequestEvent_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Announcement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(500) NULL,
    `content` TEXT NOT NULL,
    `category` ENUM('NEWS', 'SERVICE_CHANGE', 'PRACTICAL_INFO', 'EVENT') NOT NULL DEFAULT 'NEWS',
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `is_important` BOOLEAN NOT NULL DEFAULT false,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `cover_image` VARCHAR(191) NULL,
    `service_id` INTEGER NULL,
    `author_id` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,

    INDEX `Announcement_status_published_at_idx`(`status`, `published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Alert` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'WARNING',
    `audience` ENUM('ALL', 'DISTRICTS', 'VULNERABLE') NOT NULL DEFAULT 'ALL',
    `instructions` TEXT NULL,
    `recommendations` JSON NULL,
    `source` VARCHAR(191) NULL,
    `starts_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ends_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_id` INTEGER NULL,

    INDEX `Alert_is_active_starts_at_idx`(`is_active`, `starts_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AlertDistrict` (
    `alert_id` INTEGER NOT NULL,
    `district_id` INTEGER NOT NULL,

    PRIMARY KEY (`alert_id`, `district_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `link` VARCHAR(191) NULL,
    `data` JSON NULL,
    `read_at` DATETIME(3) NULL,

    INDEX `Notification_user_id_read_at_idx`(`user_id`, `read_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`);

-- CreateIndex
CREATE INDEX `User_role_idx` ON `User`(`role`);

-- CreateIndex
CREATE INDEX `User_district_id_idx` ON `User`(`district_id`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `District`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CityService` ADD CONSTRAINT `CityService_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `ServiceCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Procedure` ADD CONSTRAINT `Procedure_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `CityService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CitizenRequest` ADD CONSTRAINT `CitizenRequest_citizen_id_fkey` FOREIGN KEY (`citizen_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CitizenRequest` ADD CONSTRAINT `CitizenRequest_assigned_agent_id_fkey` FOREIGN KEY (`assigned_agent_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CitizenRequest` ADD CONSTRAINT `CitizenRequest_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `CityService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CitizenRequest` ADD CONSTRAINT `CitizenRequest_procedure_id_fkey` FOREIGN KEY (`procedure_id`) REFERENCES `Procedure`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CitizenRequest` ADD CONSTRAINT `CitizenRequest_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `District`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequestEvent` ADD CONSTRAINT `RequestEvent_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `CitizenRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequestEvent` ADD CONSTRAINT `RequestEvent_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `CityService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertDistrict` ADD CONSTRAINT `AlertDistrict_alert_id_fkey` FOREIGN KEY (`alert_id`) REFERENCES `Alert`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertDistrict` ADD CONSTRAINT `AlertDistrict_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `District`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

