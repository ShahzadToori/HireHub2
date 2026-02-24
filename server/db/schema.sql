-- ============================================================
--  HIREHUB JOB BOARD - DATABASE SCHEMA
--  Import this file in phpMyAdmin:
--  Go to Import tab → Choose File → Select this file → Click Go
-- ============================================================

CREATE DATABASE IF NOT EXISTS `hirehub_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `hirehub_db`;

-- ── 1. ADMINS ────────────────────────────────────────────────

CREATE TABLE `admins` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `username`   VARCHAR(80)  NOT NULL,
  `email`      VARCHAR(160) NOT NULL,
  `password`   VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. CATEGORIES ────────────────────────────────────────────

CREATE TABLE `categories` (
  `id`   INT          NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(110) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `categories` (`name`, `slug`) VALUES
('Technology',    'technology'),
('Marketing',     'marketing'),
('Finance',       'finance'),
('Design',        'design'),
('Sales',         'sales'),
('HR',            'hr'),
('Operations',    'operations'),
('Healthcare',    'healthcare'),
('Education',     'education'),
('Other',         'other');

-- ── 3. JOBS ──────────────────────────────────────────────────

CREATE TABLE `jobs` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `title`          VARCHAR(200) NOT NULL,
  `company`        VARCHAR(200) NOT NULL,
  `category_id`    INT          NOT NULL,
  `location`       VARCHAR(200) NOT NULL,
  `job_type`       VARCHAR(50)  NOT NULL DEFAULT 'Full-time',
  `description`    TEXT         NOT NULL,
  `phone`          VARCHAR(30)           DEFAULT NULL,
  `whatsapp`       VARCHAR(30)           DEFAULT NULL,
  `email`          VARCHAR(160)          DEFAULT NULL,
  `status`         VARCHAR(20)  NOT NULL DEFAULT 'active',
  `featured`       TINYINT(1)   NOT NULL DEFAULT 0,
  `featured_until` DATE                  DEFAULT NULL,
  `sponsored`      TINYINT(1)   NOT NULL DEFAULT 0,
  `views`          INT          NOT NULL DEFAULT 0,
  `slug`           VARCHAR(220) NOT NULL,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_jobs_status`   (`status`),
  KEY `idx_jobs_featured` (`featured`),
  KEY `idx_jobs_category` (`category_id`),
  KEY `idx_jobs_created`  (`created_at`),
  FULLTEXT KEY `idx_jobs_ft` (`title`, `company`, `description`),
  CONSTRAINT `fk_jobs_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. SETTINGS ──────────────────────────────────────────────

CREATE TABLE `settings` (
  `key`   VARCHAR(80) NOT NULL,
  `value` TEXT                DEFAULT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `settings` (`key`, `value`) VALUES
('site_name',        'HireHub'),
('site_tagline',     'Find Your Next Opportunity'),
('logo_url',         ''),
('primary_color',    '#0f62fe'),
('secondary_color',  '#161616'),
('default_theme',    'light'),
('hero_title',       'Discover Jobs That Matter'),
('hero_subtitle',    'Browse thousands of opportunities and connect directly with recruiters.'),
('jobs_per_page',    '12'),
('show_featured',    '1'),
('show_sponsored',   '1'),
('show_banner_top',  '1'),
('show_banner_side', '1');

-- ── 5. MONETIZATION ──────────────────────────────────────────

CREATE TABLE `monetization` (
  `id`            INT           NOT NULL AUTO_INCREMENT,
  `feature`       VARCHAR(80)   NOT NULL,
  `enabled`       TINYINT(1)    NOT NULL DEFAULT 1,
  `price`         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `duration_days` INT           NOT NULL DEFAULT 30,
  `description`   VARCHAR(255)           DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `feature` (`feature`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `monetization` (`feature`, `enabled`, `price`, `duration_days`, `description`) VALUES
('featured_job',   1,  9.99, 30, 'Highlight job in featured section'),
('sponsored_top',  1, 19.99, 14, 'Pin job at top of listings'),
('banner_top',     1, 29.99, 30, 'Top banner ad space'),
('banner_sidebar', 1, 14.99, 30, 'Sidebar banner ad space');

-- ── 6. AD PLACEMENTS ─────────────────────────────────────────

CREATE TABLE `ad_placements` (
  `id`         INT         NOT NULL AUTO_INCREMENT,
  `zone`       VARCHAR(50) NOT NULL,
  `ad_code`    TEXT                 DEFAULT NULL,
  `enabled`    TINYINT(1)  NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `ad_placements` (`zone`, `ad_code`, `enabled`) VALUES
('top',          '<!-- AdSense top banner code here -->',   1),
('sidebar',      '<!-- AdSense sidebar code here -->',      1),
('between_jobs', '<!-- AdSense in-feed code here -->',      1),
('footer',       '<!-- AdSense footer code here -->',       0);
