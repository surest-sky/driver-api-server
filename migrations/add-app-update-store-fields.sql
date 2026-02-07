CREATE TABLE IF NOT EXISTS `app_updates` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `platform` enum('ios','android') NOT NULL,
  `version` varchar(32) NOT NULL,
  `build_number` int NOT NULL DEFAULT 1,
  `version_code` int NOT NULL DEFAULT 1,
  `download_url` varchar(512) NULL,
  `play_store_url` varchar(512) NULL,
  `app_store_url` varchar(512) NULL,
  `release_notes` text NULL,
  `force_update` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_app_updates_platform_active_code` (`platform`,`is_active`,`version_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='App 版本更新表';

ALTER TABLE `app_updates`
  MODIFY COLUMN `download_url` varchar(512) NULL;

ALTER TABLE `app_updates`
  ADD COLUMN IF NOT EXISTS `play_store_url` varchar(512) NULL AFTER `download_url`,
  ADD COLUMN IF NOT EXISTS `app_store_url` varchar(512) NULL AFTER `play_store_url`;
