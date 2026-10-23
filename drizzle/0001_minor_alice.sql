CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`hourly_rate` real NOT NULL,
	`bokio_customer_id` text NOT NULL,
	`invoice_item_name` text DEFAULT 'Programmering' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `clients` (`name`, `hourly_rate`, `bokio_customer_id`, `invoice_item_name`, `is_default`, `created_at`)
SELECT 'Standard', `hourly_rate`, COALESCE(`bokio_customer_id`, ''), COALESCE(`invoice_item_name`, 'Programmering'), 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `settings`
WHERE `id` = 1 AND `hourly_rate` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `hourly_rate`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `bokio_customer_id`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `invoice_item_name`;