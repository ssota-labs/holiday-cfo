CREATE TABLE `balance_assertion` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`as_of` text NOT NULL,
	`commodity` text NOT NULL,
	`expected_minor` integer NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_balance_assertion_account_id_account_id_fk` FOREIGN KEY (`account_id`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_balance_assertion_commodity_commodity_code_fk` FOREIGN KEY (`commodity`) REFERENCES `commodity`(`code`)
);
--> statement-breakpoint
CREATE TABLE `snapshot` (
	`id` text PRIMARY KEY,
	`period_id` text NOT NULL,
	`kind` text NOT NULL,
	`as_of` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_snapshot_period_id_period_id_fk` FOREIGN KEY (`period_id`) REFERENCES `period`(`id`),
	CONSTRAINT "snapshot_kind_enum" CHECK("kind" IN ('close','checkpoint'))
);
--> statement-breakpoint
CREATE TABLE `snapshot_balance` (
	`snapshot_id` text NOT NULL,
	`account_id` text NOT NULL,
	`commodity` text NOT NULL,
	`units_minor` integer NOT NULL,
	`weight_minor` integer NOT NULL,
	`period_units_minor` integer DEFAULT 0 NOT NULL,
	`period_weight_minor` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `snapshot_balance_pk` PRIMARY KEY(`snapshot_id`, `account_id`, `commodity`),
	CONSTRAINT `fk_snapshot_balance_snapshot_id_snapshot_id_fk` FOREIGN KEY (`snapshot_id`) REFERENCES `snapshot`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_snapshot_balance_account_id_account_id_fk` FOREIGN KEY (`account_id`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_snapshot_balance_commodity_commodity_code_fk` FOREIGN KEY (`commodity`) REFERENCES `commodity`(`code`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `balance_assertion_unique` ON `balance_assertion` (`account_id`,`as_of`,`commodity`);--> statement-breakpoint
CREATE INDEX `balance_assertion_by_date` ON `balance_assertion` (`as_of`);--> statement-breakpoint
CREATE UNIQUE INDEX `snapshot_unique` ON `snapshot` (`period_id`,`kind`);