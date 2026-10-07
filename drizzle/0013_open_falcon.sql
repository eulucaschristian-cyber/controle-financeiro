CREATE TABLE `grocery_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`purchaseDate` date NOT NULL,
	`store` varchar(150) NOT NULL,
	`rawName` varchar(255) NOT NULL,
	`productName` varchar(150) NOT NULL,
	`quantity` decimal(10,3) NOT NULL DEFAULT '1.000',
	`unit` varchar(10) NOT NULL DEFAULT 'un',
	`unitPrice` decimal(10,2) NOT NULL,
	`totalPrice` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `grocery_prices_id` PRIMARY KEY(`id`)
);
