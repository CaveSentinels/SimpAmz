CREATE DATABASE `SimpAmz` /*!40100 DEFAULT CHARACTER SET utf8 */;

USE SimpAmz;

CREATE TABLE `User` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Password` varchar(200) NOT NULL,
  `Role` varchar(10) NOT NULL DEFAULT 'Customer',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

CREATE TABLE `Question` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Text` varchar(200) DEFAULT NULL,
  `Expected` varchar(200) DEFAULT NULL COMMENT 'Expected answers to the question.',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

CREATE TABLE `Feedback` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Time` datetime DEFAULT NULL,
  `UserID` int(11) DEFAULT NULL,
  `QID` int(11) DEFAULT NULL COMMENT 'Question ID.',
  `ActualAns` varchar(200) DEFAULT NULL COMMENT 'Actual answer to the question.',
  `Result` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `QuestionIDRef_idx` (`QID`),
  KEY `UserIDRef_idx` (`UserID`),
  CONSTRAINT `QuestionIDRef` FOREIGN KEY (`QID`) REFERENCES `Question` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `UserIDRef` FOREIGN KEY (`UserID`) REFERENCES `User` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8;


/* Insert the user data */
INSERT INTO User (Name, Password, Role) VALUES ('hsmith', 'smith', 'Customer');
INSERT INTO User (Name, Password, Role) VALUES ('tbucktoo', 'bucktoo', 'Customer');
INSERT INTO User (Name, Password, Role) VALUES ('jadmin', 'admin', 'Admin');

/* Insert the question data. */
INSERT INTO Question (Text, Expected) VALUES ('2 + 2', '4');
INSERT INTO Question (Text, Expected) VALUES ('3 * 4', '12');
INSERT INTO Question (Text, Expected) VALUES ('2 / 2', '1');

/* Query the tables. */
SELECT * FROM User;
SELECT * FROM Question;
SELECT * FROM Feedback;

SELECT Feedback.Time, User.Name, Question.Text, Question.Expected, Feedback.ActualAns, Feedback.Result 
FROM Feedback
INNER JOIN User ON Feedback.UserID = User.ID
INNER JOIN Question ON Question.ID = Feedback.QID
ORDER BY Feedback.Time
;

INSERT INTO Feedback (Time, UserID, QID, ActualAns, Result) VALUES (NOW(), 1, 1, "99", "Wrong!");

DELETE FROM Feedback;

