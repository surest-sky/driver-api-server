INSERT INTO `app_updates` (
  `platform`,
  `version`,
  `build_number`,
  `version_code`,
  `download_url`,
  `release_notes`,
  `force_update`
)
SELECT
  'android',
  '1.0.1',
  2,
  2,
  'https://download.example.com/android/app-release-1.0.1.apk',
  '• 修复已知问题\n• 提升稳定性',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM `app_updates` WHERE `platform` = 'android' AND `version_code` = 2
);

INSERT INTO `app_updates` (
  `platform`,
  `version`,
  `build_number`,
  `version_code`,
  `download_url`,
  `release_notes`,
  `force_update`
)
SELECT
  'ios',
  '1.0.1',
  2,
  2,
  'https://download.example.com/ios/app-release-1.0.1.ipa',
  '• 优化性能\n• 修复若干 UI 问题',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM `app_updates` WHERE `platform` = 'ios' AND `version_code` = 2
);
