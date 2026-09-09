CREATE TABLE `libraryBooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`author` varchar(180),
	`issuedOn` date,
	`returnBy` date,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `libraryBooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurringDays` varchar(32);--> statement-breakpoint
ALTER TABLE `libraryBooks` ADD CONSTRAINT `libraryBooks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `library_books_user_idx` ON `libraryBooks` (`userId`);