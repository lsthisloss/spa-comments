-- MySQL Script for creating spa_comments database
-- Compatible with MySQL Workbench

CREATE DATABASE IF NOT EXISTS `spa_comments`;
USE `spa_comments`;

-- Create tables
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `email` VARCHAR(255) NOT NULL,
    `userName` VARCHAR(255) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `avatarUrl` VARCHAR(255) NULL,
    `avatarShape` VARCHAR(50) NOT NULL DEFAULT 'circle',
    `role` ENUM('user', 'admin', 'superadmin', 'test') NOT NULL DEFAULT 'user',
    `slug` VARCHAR(255) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `UQ_email` (`email`),
    UNIQUE INDEX `UQ_userName` (`userName`),
    UNIQUE INDEX `UQ_slug` (`slug`)
);

CREATE TABLE `posts` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `content` TEXT NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `userId` CHAR(36) NOT NULL,
    `likes` INT NOT NULL DEFAULT 0,
    `fileUrl` VARCHAR(255) NULL,
    `fileType` VARCHAR(255) NULL,
    `fileName` VARCHAR(255) NULL,
    `likedUserIds` TEXT NOT NULL DEFAULT '',
    `repliesCount` INT NOT NULL DEFAULT 0,
    `imageUrl` VARCHAR(255) NULL,
    `slug` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `UQ_slug` (`slug`),
    INDEX `idx_userId` (`userId`),
    CONSTRAINT `FK_posts_userId` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

CREATE TABLE `comments` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `content` TEXT NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `userId` CHAR(36) NOT NULL,
    `postId` CHAR(36) NOT NULL,
    `parentId` CHAR(36) NULL,
    `likes` INT NOT NULL DEFAULT 0,
    `fileUrl` VARCHAR(255) NULL,
    `fileType` VARCHAR(255) NULL,
    `fileName` VARCHAR(255) NULL,
    `imageUrl` VARCHAR(255) NULL,
    `likedUserIds` TEXT NOT NULL DEFAULT '',
    `repliesCount` INT NOT NULL DEFAULT 0,
    `numericId` VARCHAR(255) NULL,
    `slug` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `UQ_slug` (`slug`),
    INDEX `idx_userId` (`userId`),
    INDEX `idx_postId` (`postId`),
    INDEX `idx_parentId` (`parentId`),
    CONSTRAINT `FK_comments_userId` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_comments_postId` FOREIGN KEY (`postId`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_comments_parentId` FOREIGN KEY (`parentId`) REFERENCES `comments` (`id`) ON DELETE CASCADE
);

CREATE TABLE `user_following` (
    `userId` CHAR(36) NOT NULL,
    `followingId` CHAR(36) NOT NULL,
    PRIMARY KEY (`userId`, `followingId`),
    INDEX `idx_userId` (`userId`),
    INDEX `idx_followingId` (`followingId`),
    CONSTRAINT `FK_following_userId` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_following_followingId` FOREIGN KEY (`followingId`) REFERENCES `users` (`id`) ON DELETE CASCADE
);