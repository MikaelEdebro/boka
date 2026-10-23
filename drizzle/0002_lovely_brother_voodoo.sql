ALTER TABLE `day_entries` ADD `client_id` integer REFERENCES clients(id);--> statement-breakpoint
UPDATE `day_entries`
SET `client_id` = (SELECT `id` FROM `clients` WHERE `is_default` = 1)
WHERE `type` = 'work' AND `client_id` IS NULL AND EXISTS (SELECT 1 FROM `clients` WHERE `is_default` = 1);
