-- CreateTable
CREATE TABLE `LoginAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `email` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(64) NOT NULL,
    `user_agent` VARCHAR(255) NULL,
    `success` BOOLEAN NOT NULL,
    `reason` VARCHAR(32) NOT NULL,
    `user_id` INTEGER NULL,

    INDEX `LoginAttempt_email_created_at_idx`(`email`, `created_at`),
    INDEX `LoginAttempt_ip_created_at_idx`(`ip`, `created_at`),
    INDEX `LoginAttempt_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceInterruption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `service_id` INTEGER NOT NULL,
    `type` ENUM('MAINTENANCE', 'INCIDENT') NOT NULL DEFAULT 'MAINTENANCE',
    `impact` ENUM('DEGRADED', 'UNAVAILABLE') NOT NULL DEFAULT 'UNAVAILABLE',
    `reason` TEXT NOT NULL,
    `alternative` TEXT NULL,
    `starts_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ends_at` DATETIME(3) NULL,
    `created_by_id` INTEGER NULL,

    INDEX `ServiceInterruption_service_id_starts_at_idx`(`service_id`, `starts_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppointmentSlot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `service_id` INTEGER NOT NULL,
    `agent_id` INTEGER NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 1,
    `preparation_notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `AppointmentSlot_service_id_starts_at_idx`(`service_id`, `starts_at`),
    INDEX `AppointmentSlot_starts_at_idx`(`starts_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Appointment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `slot_id` INTEGER NOT NULL,
    `citizen_id` INTEGER NULL,
    `service_id` INTEGER NOT NULL,
    `procedure_id` INTEGER NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW') NOT NULL DEFAULT 'BOOKED',
    `agent_notes` TEXT NULL,
    `reminder_offset_minutes` INTEGER NOT NULL DEFAULT 1440,
    `reminder_sent_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,

    UNIQUE INDEX `Appointment_reference_key`(`reference`),
    INDEX `Appointment_citizen_id_idx`(`citizen_id`),
    INDEX `Appointment_slot_id_idx`(`slot_id`),
    INDEX `Appointment_status_reminder_sent_at_idx`(`status`, `reminder_sent_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransitLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mode` ENUM('BUS', 'TRAM', 'METRO', 'SHUTTLE', 'CABLE') NOT NULL DEFAULT 'BUS',
    `color` VARCHAR(16) NULL,
    `description` TEXT NULL,
    `status` ENUM('NORMAL', 'DISRUPTED', 'INTERRUPTED') NOT NULL DEFAULT 'NORMAL',
    `status_message` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `TransitLine_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransitStop` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `district_id` INTEGER NULL,
    `address` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `accessible` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `TransitStop_code_key`(`code`),
    INDEX `TransitStop_district_id_idx`(`district_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransitLineStop` (
    `line_id` INTEGER NOT NULL,
    `stop_id` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,

    PRIMARY KEY (`line_id`, `stop_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransitDeparture` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `line_id` INTEGER NOT NULL,
    `stop_id` INTEGER NOT NULL,
    `day_type` ENUM('WEEKDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `time` CHAR(5) NOT NULL,
    `direction` VARCHAR(191) NULL,

    INDEX `TransitDeparture_stop_id_day_type_time_idx`(`stop_id`, `day_type`, `time`),
    INDEX `TransitDeparture_line_id_day_type_idx`(`line_id`, `day_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LoginAttempt` ADD CONSTRAINT `LoginAttempt_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceInterruption` ADD CONSTRAINT `ServiceInterruption_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `CityService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceInterruption` ADD CONSTRAINT `ServiceInterruption_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppointmentSlot` ADD CONSTRAINT `AppointmentSlot_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `CityService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppointmentSlot` ADD CONSTRAINT `AppointmentSlot_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_slot_id_fkey` FOREIGN KEY (`slot_id`) REFERENCES `AppointmentSlot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_citizen_id_fkey` FOREIGN KEY (`citizen_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `CityService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_procedure_id_fkey` FOREIGN KEY (`procedure_id`) REFERENCES `Procedure`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransitStop` ADD CONSTRAINT `TransitStop_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `District`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransitLineStop` ADD CONSTRAINT `TransitLineStop_line_id_fkey` FOREIGN KEY (`line_id`) REFERENCES `TransitLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransitLineStop` ADD CONSTRAINT `TransitLineStop_stop_id_fkey` FOREIGN KEY (`stop_id`) REFERENCES `TransitStop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransitDeparture` ADD CONSTRAINT `TransitDeparture_line_id_fkey` FOREIGN KEY (`line_id`) REFERENCES `TransitLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransitDeparture` ADD CONSTRAINT `TransitDeparture_stop_id_fkey` FOREIGN KEY (`stop_id`) REFERENCES `TransitStop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

