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
    host : 'localhost',
    user : 'root',
    password : '',
    port : 3306,
    database : 'SimpAmz',
    debug : false
});

var app = express();

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var valid_state_abbr = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY"
];

var zip_code_pattern = new RegExp("^\d{5}$", "g");

// The email address regex pattern is found here:
// http://stackoverflow.com/a/1373724/630364
// God knows how the IETF guys figured out such a complex pattern...
var email_pattern = new RegExp("[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", "g");

// ============================================================================

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

// ============================================================================
// Shared function

function _NU(obj) {
    return (obj == null || obj == undefined);
}

function emptize(str) {
    return (_NU(str) ? "" : str);
}

function ret_value(msg_base, msg_detail, err_code, more_info) {
    return {
        message : emptize(msg_base) + emptize(msg_detail),
        code : emptize(err_code),
        more : emptize(more_info)
    };
}

function _Q(str) {
    return "\"" + emptize(str) + "\"";
}

// ============================================================================
// User authentication

passport.use(new LocalStrategy(
    function(username, password, done) {
        var failure_msg_base = "Authentication failed: ";
        var success_msg_base = "Authentication succeeded.";

        pool.getConnection(function(err, conn) {
            if (err) {
                return done(new Error(ret_value(
                    failure_msg_base,
                    "Database connection error: " + err,
                    "E_POST_LOGIN_01", null
                )));
            }

            var sql_stmt = "SELECT * FROM `User` WHERE `Name`=" +
                conn.escape(username) + " AND `Password`=" +
                conn.escape(password) + "";

            conn.query(sql_stmt, function(err, rows) {
                conn.release();
                if (err) {
                    return done(new Error(ret_value(
                        failure_msg_base,
                        "Database QUERY error: " + err,
                        "E_POST_LOGIN_02",
                        sql_stmt
                    )));
                }

                if (rows.length > 1) {
                    return done(new Error(ret_value(
                        failure_msg_base,
                        "Database error: The provided user name matches multiple users.",
                        "E_POST_LOGIN_03",
                        _Q(rows.length) + " users."
                    )));
                }

                if (rows.length == 0) {
                    return done(null, false, ret_value(
                        failure_msg_base,
                        "Incorrect user name or password.",
                        "E_POST_LOGIN_04", null
                    ));
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

            conn.on('error', function(err) {
                return done(new Error(ret_value(
                    failure_msg_base,
                    "Database connection error: " + err,
                    "E_POST_LOGIN_05", null
                )));
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

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(session({ secret: 'robin on rails' })); // Needed!
app.use(passport.initialize());
app.use(passport.session());

// ============================================================================
// Register new user as Customer.

app.post("/registerUser", function(req, res) {
    // Define the default return message.
    var success_msg_base = "Your account has been registered.";
    var failure_msg_base = "Account registration failed: ";

    // Get the registration parameters.
    var fname = req.body.fName;
    var lname = req.body.lName;
    var addr = req.body.address;
    var city = req.body.city;
    var state = req.body.state;
    var zip = req.body.zip;
    var email = req.body.email;
    var uname = req.body.uName;
    var pwd = req.body.pWord;

    // Validate parameter: state
    if (state) {
        if (valid_state_abbr.indexOf(state.toUpperCase()) == -1) {
            // Meaning that state's value is not a valid state abbreviation.
            res.json(ret_value(
                failure_msg_base,
                "Invalid state abbreviation: " + state,
                "E_POST_REG_USER_01", null
            )); // Return
            return;
        }
    }

    // Validate parameter: zip code.
    if (zip) {
        if (!zip_code_pattern.test(zip)) {
            // Meaning that zip's value is not a 5-digit zip code.
            res.json(ret_value(
                failure_msg_base,
                "Invalid zip code: " + zip,
                "E_POST_REG_USER_02", null
            ));    // Return
            return;
        }
    }

    // Validate parameter: email format.
    // We assume that if the format is correct, the email is valid.
    if (email) {
        if (!email_pattern.test(email)) {
            // Meaning that email's value is not a valid email address.
            res.json(ret_value(
                failure_msg_base,
                "Invalid email format: " + email,
                "E_POST_REG_USER_03", null
            ));    // Return
            return;
        }
    }

    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            res.json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_REG_USER_04", null
            ));    // Return
            return;
        }

        // Validate parameter: user name must not be empty and must not exist.
        if (!uname || uname == "") {
            // Meaning that uname is empty, which is not allowed.
            res.json(ret_value(
                failure_msg_base,
                "User name must not be empty.",
                "E_POST_REG_USER_05", null
            ));    // Return
            return;
        } else if (!pwd || pwd == "") {
            // Meaning that pwd is empty, which is not allowed.
            res.json(ret_value(
                failure_msg_base,
                "Password must not be empty.",
                "E_POST_REG_USER_06", null
            ));    // Return
            return;
        } else {
            var sql_stmt = "SELECT * FROM `User` WHERE `Name`=" + _Q(uname);
            conn.query(sql_stmt, function(err, rows) {    // func_02
                if (err) {
                    res.json(ret_value(
                        failure_msg_base,
                        "Database QUERY error: " + err,
                        "E_POST_REG_USER_07",
                        sql_stmt
                    ));    // Return
                    return;
                } else {
                    if (rows.length > 0) {
                        res.json(ret_value(
                            failure_msg_base,
                            "User name already exists: " + uname,
                            "E_POST_REG_USER_08",
                            null
                        ));    // Return
                        return;
                    }
                }

                // Now we know that the uname doesn't exist. We can create
                // the user account.
                sql_stmt = "INSERT INTO User (Name, Password, Role) VALUES (" +
                    _Q(uname) + ", " + _Q(pwd) + ", 'Customer')";
                conn.query(sql_stmt, function(err, result) {    // func_03
                    if (err) {
                        res.json(ret_value(
                            failure_msg_base,
                            "Database INSERT INTO error: " + err,
                            "E_POST_REG_USER_09",
                            sql_stmt
                        ));    // Return
                        return;
                    } else {
                        var uid = result.insertId;
                        // Insert the contact information.
                        // It is possible that the user doesn't provide any
                        // contact information. In this case, we just Insert
                        // an empty row in the database.
                        sql_stmt = "INSERT INTO UserContact " +
                            "(FName, LName, Addr, City, State, Zip, Email, UserID) " +
                            "VALUES (" + _Q(fname) + ", " + _Q(lname) + ", " +
                            _Q(addr) + ", " + _Q(city) + ", " + _Q(state) + ", " +
                            _Q(zip) + ", " + _Q(email) + ", " + _Q(uid) + ")";
                        conn.query(sql_stmt, function(err, result) {    // func_04
                            if (err) {
                                res.json(ret_value(
                                    failure_msg_base,
                                    "Database INSERT INTO error: " + err,
                                    "E_POST_REG_USER_10",
                                    sql_stmt
                                ));    // Return
                                return;
                            } else {
                                // OK. Finally we've done everything.
                                // Return success.
                                res.json(ret_value(
                                    success_msg_base, null, null, null
                                ));    // Return
                                return;
                            }
                        }); // func_04
                    }
                }); // func_03
            }); // func_02
        }
    }); // func_01
});

// ============================================================================
// Login

app.post('/login', passport.authenticate('local', { failureRedirect : '/login' }),
    function(req, res) {
        if (req.user.role == "Admin") {
            res.json({
                menu : ["Modify Products", "View Users", "View Products"]
            });
        } else if (req.user.role == "Customer") {
            res.json({
                menu : ["Update Contact Information", "View Products"]
            });
        } else {
            res.json(ret_value(
                "Incorrect user role",
                req.user.role,
                "E_POST_LOGIN_10",
                null
            ));
        }
    }
);

// ============================================================================
// Logout

app.post('/logout', function(req, res) {
    if (req.isAuthenticated()) {
        // If the user has logged in before, we then logout.
        req.logout();
        res.json(ret_value(
            "You have been logged out.",
            null, null, null
        ));
    } else {
        // If no user has logged in before, we tell them.
        res.json(ret_value(
            "You are not currently logged in.",
            null, null, null
        ));
    }
});

// ============================================================================
// Old routes

/* GET home page. */
app.get('/', function(req, res, next) {
    res.render('index', {
        title: 'SimpAmz',
        full_title: 'SIMPlified AMaZon',
        error: ''
    });
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

// ============================================================================

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
