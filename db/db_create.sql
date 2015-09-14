# ================================================================================
# Create the database and the tables.


CREATE DATABASE `SimpAmz` /*!40100 DEFAULT CHARACTER SET utf8 */;


CREATE TABLE `User` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Password` varchar(200) NOT NULL,
  `Role` varchar(10) NOT NULL DEFAULT 'Customer',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Name_UNIQUE` (`Name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8;


CREATE TABLE `UserContact` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `FName` varchar(100) DEFAULT NULL COMMENT 'First name',
  `LName` varchar(100) DEFAULT NULL COMMENT 'Last name.',
  `Addr` varchar(500) DEFAULT NULL,
  `City` varchar(100) DEFAULT NULL,
  `State` varchar(2) DEFAULT NULL,
  `Zip` varchar(5) DEFAULT NULL COMMENT 'Zip code.',
  `Email` varchar(100) DEFAULT NULL,
  `UserID` int(11) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `Search` (`FName`,`LName`),
  KEY `UserRef_idx` (`UserID`),
  CONSTRAINT `UserRef` FOREIGN KEY (`UserID`) REFERENCES `User` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `Session` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `UserID` int(11) DEFAULT NULL,
  `SHA1` varchar(32) DEFAULT NULL,
  `LastLogin` datetime NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `SHA1_UNIQUE` (`SHA1`),
  KEY `UserRef_idx` (`UserID`),
  KEY `UserRef_Session_idx` (`UserID`),
  CONSTRAINT `UserRef_Session` FOREIGN KEY (`UserID`) REFERENCES `User` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `Product` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Description` varchar(500) DEFAULT NULL,
  `Category` varchar(100) DEFAULT NULL,
  `Title` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


# ================================================================================
# Insert initial data.

-- INSERT INTO User (Name, Password, Role) VALUES ('hsmith', 'smith', 'Customer');
-- INSERT INTO User (Name, Password, Role) VALUES ('tbucktoo', 'bucktoo', 'Customer');
INSERT INTO User (Name, Password, Role) VALUES ('jadmin', 'admin', 'Admin');

INSERT INTO Product (ID, Description, Category, Title) VALUES (1, "Mac Book Pro", "Computer", "MacPro");
INSERT INTO Product (ID, Description, Category, Title) VALUES (2, "Robin's coffee cup", "Appliance", "Cup");
INSERT INTO Product (ID, Description, Category, Title) VALUES (3, "Diet Coke bottle", "Trash", "Bottle");


# ================================================================================
# Reinitialize database.

DELETE FROM UserContact WHERE ID >= 1;
DELETE FROM User WHERE ID > 1;

SELECT * FROM UserContact;
SELECT * FROM User;
SELECT * FROM Product;


# ================================================================================
# Test script.

SELECT User.Name, User.Role, UserContact.FName, UserContact.LName, UserContact.Addr, 
UserContact.City, UserContact.State, UserContact.Zip, UserContact.Email 
FROM User 
INNER JOIN UserContact 
ON User.ID = UserContact.UserID
WHERE UserContact.FName LIKE "%o%" OR UserContact.LName LIKE "%x%"
;