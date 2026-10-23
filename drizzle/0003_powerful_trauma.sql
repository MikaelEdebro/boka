PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bokio_invoice_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`hours` real NOT NULL,
	`client_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_invoices`(`id`, `bokio_invoice_id`, `period_start`, `period_end`, `hours`, `client_id`, `created_at`)
SELECT `id`, `bokio_invoice_id`, `period_start`, `period_end`, `hours`,
	COALESCE((SELECT `id` FROM `clients` WHERE `is_default` = 1), (SELECT MIN(`id`) FROM `clients`)),
	`created_at`
FROM `invoices`;--> statement-breakpoint
DROP TABLE `invoices`;--> statement-breakpoint
ALTER TABLE `__new_invoices` RENAME TO `invoices`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
