-- CreateTable
CREATE TABLE `ArbitrageData` (
    `id` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `baseCurrency` VARCHAR(191) NOT NULL,
    `quoteCurrency` VARCHAR(191) NOT NULL,
    `status` ENUM('PROCESSED', 'PROCESSING', 'UNTOUCHED', 'FAILED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'UNTOUCHED',
    `confirmationCode` INTEGER UNSIGNED NOT NULL,
    `isConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArbitrageStep` (
    `id` VARCHAR(191) NOT NULL,
    `arbitrageDataId` VARCHAR(191) NOT NULL,
    `order` TINYINT UNSIGNED NOT NULL,
    `type` ENUM('TRADE', 'WITHDRAW') NOT NULL,
    `status` ENUM('PROCESSED', 'PROCESSING', 'UNTOUCHED', 'FAILED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'UNTOUCHED',
    `details` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ArbitrageStep_arbitrageDataId_order_key`(`arbitrageDataId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ArbitrageStep` ADD CONSTRAINT `ArbitrageStep_arbitrageDataId_fkey` FOREIGN KEY (`arbitrageDataId`) REFERENCES `ArbitrageData`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
