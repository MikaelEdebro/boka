PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_day_entries` (
	`date` text NOT NULL,
	`type` text NOT NULL,
	`hours` real,
	`note` text,
	`client_id` integer,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`date`, `type`),
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_day_entries`("date", "type", "hours", "note", "client_id", "updated_at") SELECT "date", "type", "hours", "note", "client_id", "updated_at" FROM `day_entries`;--> statement-breakpoint
DROP TABLE `day_entries`;--> statement-breakpoint
ALTER TABLE `__new_day_entries` RENAME TO `day_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;