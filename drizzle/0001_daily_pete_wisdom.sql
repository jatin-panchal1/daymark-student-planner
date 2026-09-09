CREATE TABLE `schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectId` int NOT NULL,
	`dayOfWeek` int NOT NULL,
	`startTime` varchar(10),
	`userId` int NOT NULL,
	CONSTRAINT `schedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`code` varchar(40),
	`color` varchar(20),
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`subjectId` int,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`dueDate` date,
	`priority` varchar(16) NOT NULL DEFAULT 'Medium',
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` varchar(16) NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `schedule` ADD CONSTRAINT `schedule_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule` ADD CONSTRAINT `schedule_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `schedule_subject_idx` ON `schedule` (`subjectId`);--> statement-breakpoint
CREATE INDEX `schedule_user_idx` ON `schedule` (`userId`);--> statement-breakpoint
CREATE INDEX `subjects_user_idx` ON `subjects` (`userId`);--> statement-breakpoint
CREATE INDEX `tasks_user_idx` ON `tasks` (`userId`);--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`dueDate`);