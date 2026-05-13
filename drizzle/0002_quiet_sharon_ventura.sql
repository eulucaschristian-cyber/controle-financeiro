ALTER TABLE `transactions` ADD `paymentMethod` enum('debito','credito','pix','dinheiro') DEFAULT 'debito' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `installments` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `installmentNumber` int DEFAULT 1 NOT NULL;