var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var session = require('express-session');

var mysql = require('mysql');

var pool = mysql.createPool({
    connectionLimit : 100,
    host : 'ec2-54-208-169-115.compute-1.amazonaws.com',
    user : 'root',
    password : '',
    port : 3306,
    database : 'SimpAmz',
    debug : false
});

// ============================================================================
// User authentication

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy(
    function(username, password, done) {
        pool.getConnection(function(err, connection) {
            if (err) {
                console.log("Database connection error: " + err);
                // connection.release();
                return done(err);
            }

            var sql_stmt = "SELECT * FROM `User` WHERE `Name`=" +
                connection.escape(username) + " AND `Password`=" +
                connection.escape(password) + "";

            connection.query(sql_stmt, function(err, rows) {
                connection.release();
                if (err) {
                    return done(err);
                }

                if (rows.length > 1) {
                    return done(new Error('Authentication fails: ' + rows.length + ' user(s) match the username/password.'));
                }

                if (rows.length == 0) {
                    return done(null, false, { message: 'Incorrect username or password.'});
                }

                if (rows.length == 1) {
                    var auth_user = {
                        id : rows[0].ID,
                        name : rows[0].Name,
                        role : rows[0].Role
                    };
                    return done(null, auth_user);
                }
            });

            connection.on('error', function(err) {
                return done(err);
            });
        });
    }
));

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(session({ secret: 'robin on rails' })); // Needed!
app.use(passport.initialize());
app.use(passport.session());


// ============================================================================
// Route handlers

// List all the questions.
function list_questions(req, res, result) {
    pool.getConnection(function(err, connection) {
        if (err) {
            connection.release();
            res.render('questions', {
                "questionlist" : [],
                "result" : "Database error!"
            });
        }

        var sql_stmt = "SELECT * FROM Question";

        connection.query(sql_stmt, function(err, rows) {
            if (!err) {
                var questions = [];
                for (i = 0; i < rows.length; i++) {
                    questions.push({
                        "Id" : rows[i].ID,
                        "Text" : rows[i].Text
                    });
                }
                res.render('questions', {
                    "questionlist" : questions,
                    "result" : result
                });
            } else {
                res.render('questions', {
                    "questionlist" : [],
                    "result" : "Database error!"
                });
            }
        });

        connection.on('error', function(err) {
            res.render('questions', {
                "questionlist" : [],
                "result" : "Database error!"
            });
        });
    });
}

function list_feedback(req, res) {
    pool.getConnection(function(err, connection) {
        if (err) {
            connection.release();
            console.log("Database error: " + err);
            res.render('feedback', {
                "feedback_history" : []
            });
        }

        var sql_stmt =
            "SELECT Feedback.Time, User.Name, Question.Text, Question.Expected, Feedback.ActualAns, Feedback.Result " +
            "FROM Feedback " +
            "INNER JOIN User ON Feedback.UserID = User.ID " +
            "INNER JOIN Question ON Question.ID = Feedback.QID " +
            "ORDER BY Feedback.Time";

        connection.query(sql_stmt, function(err, rows) {
            if (!err) {
                var feedback_history = [];
                for (i = 0; i < rows.length; i++) {
                    feedback_history.push({
                        "DateTime" : rows[i].Time,
                        "UserName" : rows[i].Name,
                        "Question" : rows[i].Text,
                        "ExpectedAnswer" : rows[i].Expected,
                        "ActualAnswer" : rows[i].ActualAns,
                        "Result" : rows[i].Result
                    });
                }
                res.render('feedback', {
                    "feedback_history" : feedback_history
                });
            } else {
                console.log("Database error: " + err);
                res.render('feedback', {
                    "feedback_history" : []
                });
            }
        });

        connection.on('error', function(err) {
            console.log("Database error: " + err);
            res.render('feedback', {
                "feedback_history" : []
            });
        });
    });
}

function record_answer(req, res) {
    var uid = req.user.id;
    var qid = req.body.qid;
    var answer = req.body.answer;
    var result = "<Unknown>";

    pool.getConnection(function(err, connection) {
        if (err) {
            connection.release();
            res.render('questions');
        }

        var sql_stmt = "SELECT * FROM `Question` WHERE `ID`=" + qid;

        connection.query(sql_stmt, function(err, rows) {
            if (!err) {
                var expected_ans = rows[0].Expected;
                result = (answer == expected_ans ? "Correct" : "Wrong");

                sql_stmt = "INSERT INTO `Feedback` (`Time`, `UserID`, `QID`, " +
                    "`ActualAns`, `Result`) VALUES (NOW(), " +
                    uid + ", " + qid + ", " + answer + ", '" + result + "')";
                console.log("SQL STMT: " + sql_stmt);

                connection.query(sql_stmt, function(err, affects) {
                    if (!err) {
                        console.log("Answer recorded: " + affects);
                    } else {
                        console.log("Answer recording fails: " + err);
                    }
                    list_questions(req, res, result);
                });
            } else {
                console.log("Database error: Cannot find the question's expected answer.");
            }
        });

        connection.on('error', function(err) {
            res.redirect('questions');
        });
    });
}

/* GET home page. */
app.get('/', function(req, res, next) {
    res.render('index', {
        title: 'SimpAmz',
        full_title: 'SIMPlified AMaZon',
        error: ''
    });
});

/* POST login information. */
app.post('/', passport.authenticate('local', { failureRedirect : '/' }),
    function(req, res) {
        if (req.user.role == "Admin") {
            res.redirect('/feedback');
        } else if (req.user.role == "Customer") {
            res.redirect('/questions');
        } else {
            res.redirect('/');
        }
    }
);

/* POST logout information. */
app.post('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

/* GET questions. */
app.get('/questions', function(req, res){
    // Query the database for the questions.
    if (req.isAuthenticated() && req.user.role == "Customer") {
        list_questions(req, res, "");
    } else {
        res.redirect('/');
    }
});

/* POST answers to questions. */
app.post('/questions', function(req, res) {
    // Record the question answers.
    record_answer(req, res);
});

/* GET feedback history. */
app.get('/feedback', function(req, res){
    // Query the database for the feedback history.
    if (req.isAuthenticated() && req.user.role == "Admin") {
        list_feedback(req, res);
    } else {
        res.redirect('/');
    }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
