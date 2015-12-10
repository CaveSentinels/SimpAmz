# ================================================================================
# Create the database and the tables.


CREATE DATABASE `SimpAmz` /*!40100 DEFAULT CHARACTER SET utf8 */;


CREATE TABLE `User` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `FName` varchar(100) DEFAULT NULL COMMENT 'First name',
  `LName` varchar(100) DEFAULT NULL COMMENT 'Last name.',
  `Addr` varchar(500) DEFAULT NULL,
  `City` varchar(100) DEFAULT NULL,
  `State` varchar(2) DEFAULT NULL,
  `Zip` varchar(5) DEFAULT NULL COMMENT 'Zip code.',
  `Email` varchar(100) DEFAULT NULL,
  `UName` varchar(100) NOT NULL COMMENT 'User name',
  `Password` varchar(200) NOT NULL,
  `Role` varchar(10) NOT NULL DEFAULT 'Customer',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `UName_UNIQUE` (`UName`),
  KEY `Search` (`FName`,`LName`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8;


CREATE TABLE `Session` (
  `SessionID` varchar(50) NOT NULL,
  `UserID` int(11) NOT NULL,
  `LastLogin` bigint(20) NOT NULL,
  PRIMARY KEY (`SessionID`),
  KEY `UserRef_idx` (`UserID`),
  KEY `UserRef_Session_idx` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `Product` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `ASIN` varchar(45) DEFAULT NULL,
  `Description` varchar(500) DEFAULT NULL,
  `Category` varchar(10240) DEFAULT NULL,
  `Title` varchar(4096) DEFAULT NULL,
  `Group` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


CREATE TABLE `Inventory` (
  `ProdID` int(11) NOT NULL,
  `Quantity` int(11) DEFAULT '0',
  PRIMARY KEY (`ProdID`),
  CONSTRAINT `Inventory_ProdID` FOREIGN KEY (`ProdID`) REFERENCES `Product` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `Order` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `ProdID` int(11) NOT NULL,
  `Quantity` int(11) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `Order_ProdID_idx` (`ProdID`),
  CONSTRAINT `Order_ProdID` FOREIGN KEY (`ProdID`) REFERENCES `Product` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


# ================================================================================
# Insert initial data.

INSERT INTO User (ID, UName, Password, Role) VALUES (1, 'jadmin', 'admin', 'Admin');
INSERT INTO User (ID, UName, Password, Role) VALUES (2, 'hsmith', 'smith', 'Customer');
INSERT INTO User (ID, UName, Password, Role) VALUES (3, 'tbucktoo', 'bucktoo', 'Customer');
