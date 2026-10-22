CREATE TABLE `day_entries` (
	`date` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`hours` real,
	`note` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bokio_invoice_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`hours` real NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`hourly_rate` real,
	`bokio_customer_id` text,
	`invoice_item_name` text
);
--> statement-breakpoint
CREATE TABLE `week_reports` (
	`iso_year` integer NOT NULL,
	`iso_week` integer NOT NULL,
	`submitted_at` text NOT NULL,
	PRIMARY KEY(`iso_year`, `iso_week`)
);
