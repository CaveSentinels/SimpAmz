var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

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

// ============================================================================

var valid_state_abbr = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY"
];

// Do not use the "g" flag if you don't want to reset the index.
// See this post for more info:
// http://stackoverflow.com/a/1520853/630364
var zip_code_pattern = /^\d{5}$/;

// The email address regex pattern is found here:
// http://stackoverflow.com/a/1373724/630364
// God knows how the IETF guys figured out such a complex pattern...
var email_pattern = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

// ============================================================================

var USER_ROLE_CUSTOMER = "Customer";
var USER_ROLE_ADMIN = "Admin";

var ERR_MSG_AUTH_FAILURE = "Authentication failed: ";
var ERR_MSG_DB_CONN_ERR = "Database connection error: ";
var ERR_MSG_DB_SELECT_ERR = "Database SELECT error: ";
var ERR_MSG_DB_DELETE_ERR = "Database DELETE error: ";

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
// Utility functions

function _NU(obj) {
    return (obj == null || obj == undefined);
}

function emptize(str) {
    return (_NU(str) ? "" : str);
}

function ret_value(msg_base, msg_detail, err_code, more_info) {
    return {
        message : emptize(msg_base),
        details : emptize(msg_detail),
        code : emptize(err_code),
        more : emptize(more_info)
    };
}

function _Q(str) {
    return "\"" + emptize(str) + "\"";
}

// ============================================================================
// Session management

// The in-memory session manager.
var g_sessions = [];

function session_create(user_id, user_role) {
    var curr_date_time_value = new Date().valueOf();
    return {
        sid : user_id + "_" + curr_date_time_value,     // session ID
        uid : user_id,         // user ID
        role : user_role      // user's role
    };
}

function session_save(session_info) {
    g_sessions.push(session_info);
}

// ============================================================================
// Helper functions

function get_role_menu(base_url, user_role) {
    if (user_role == "Admin") {
        return [
            base_url + "/" + "modifyProduct",
            base_url + "/" + "viewUsers",
            base_url + "/" + "getProducts"
        ];
    } else if (user_role == "Customer") {
        return [
            base_url + "/" + "updateInfo",
            base_url + "/" + "getProducts"
        ];
    }

    return [];  // Wrong user role so we return empty menu list.
}

// ============================================================================
// Register new user as Customer.

app.post("/registerUser", function(req, res) {
    // Define the default return message.
    var success_msg_base = "Your account has been registered";
    var failure_msg_base = "there was a problem with your registration";

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
            return res.json(ret_value(
                failure_msg_base,
                "Invalid state abbreviation: " + state,
                "E_POST_REG_USER_01", null
            )); // Return
        }
    }

    // Validate parameter: zip code.
    if (zip) {
        if (!zip_code_pattern.test(zip)) {
            // Meaning that zip's value is not a 5-digit zip code.
            return res.json(ret_value(
                failure_msg_base,
                "Invalid zip code: " + zip,
                "E_POST_REG_USER_02", null
            ));    // Return
        }
    }

    // Validate parameter: email format.
    // We assume that if the format is correct, the email is valid.
    if (email) {
        if (!email_pattern.test(email)) {
            // Meaning that email's value is not a valid email address.
            return res.json(ret_value(
                failure_msg_base,
                "Invalid email format: " + email,
                "E_POST_REG_USER_03", null
            ));    // Return
        }
    }

    // Validate parameter: user name must not be empty and must not exist.
    if (!uname || uname == "") {
        // Meaning that uname is empty, which is not allowed.
        return res.json(ret_value(
            failure_msg_base,
            "User name must not be empty.",
            "E_POST_REG_USER_05", null
        ));    // Return
    }

    // Validate parameter: password must not be empty and must not exist.
    if (!pwd || pwd == "") {
        // Meaning that pwd is empty, which is not allowed.
        return res.json(ret_value(
            failure_msg_base,
            "Password must not be empty.",
            "E_POST_REG_USER_06", null
        ));    // Return
    }

    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_REG_USER_04", null
            ));    // Return
        }

        var sql_stmt = "SELECT * FROM `User` WHERE `Name`=" + _Q(uname);
        conn.query(sql_stmt, function(err, rows) {    // func_02
            if (err) {
                return res.json(ret_value(
                    failure_msg_base,
                    "Database QUERY error: " + err,
                    "E_POST_REG_USER_07",
                    sql_stmt
                ));    // Return
            } else {
                if (rows.length > 0) {
                    return res.json(ret_value(
                        failure_msg_base,
                        "User name already exists: " + uname,
                        "E_POST_REG_USER_08",
                        null
                    ));    // Return
                }
            }

            // Now we know that the uname doesn't exist. We can create
            // the user account.
            sql_stmt = "INSERT INTO User (Name, Password, Role) VALUES (" +
                _Q(uname) + ", " + _Q(pwd) + ", 'Customer')";
            conn.query(sql_stmt, function(err, result) {    // func_03
                if (err) {
                    return res.json(ret_value(
                        failure_msg_base,
                        "Database INSERT INTO error: " + err,
                        "E_POST_REG_USER_09",
                        sql_stmt
                    ));    // Return
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
                            return res.json(ret_value(
                                failure_msg_base,
                                "Database INSERT INTO error: " + err,
                                "E_POST_REG_USER_10",
                                sql_stmt
                            ));    // Return
                        } else {
                            // OK. Finally we've done everything.
                            // Return success.
                            return res.json(ret_value(
                                success_msg_base, null, null, null
                            ));    // Return
                        }
                    }); // func_04
                }
            }); // func_03
        }); // func_02
    }); // func_01
});

// ============================================================================
// Unregister an existing user.

app.post('/unregisterUser', function(req, res) {
    var success_msg_base = "Your account has been unregistered.";
    var failure_msg_base = "Account unregistration failed: ";

    // The user must be authenticated in order to unregister the account.
    if (!req.isAuthenticated()) {
        return res.json(ret_value(
            failure_msg_base,
            ERR_MSG_AUTH_FAILURE + "User must log in before unregistering the account.",
            "E_POST_UNREG_USER_01", null
        ));
    }

    var uid = req.user.id;

    // Go and delete the account from the database.
    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.json(ret_value(
                failure_msg_base,
                ERR_MSG_DB_CONN_ERR + err,
                "E_POST_UNREG_USER_02", null
            ));
        }

        var sql_stmt = "DELETE FROM `User` WHERE `ID` = " + conn.escape(uid);

        conn.query(sql_stmt, function(err, result) {    // func_02
            if (err) {
                return res.json(ret_value(
                    failure_msg_base,
                    ERR_MSG_DB_DELETE_ERR + err,
                    "E_POST_UNREG_USER_03", null
                ));
            }

            // User info has been deleted. Now delete the contact info.
            sql_stmt = "DELETE FROM `UserContact` WHERE `UserID` = " + conn.escape(uid);

            conn.query(sql_stmt, function(err, result) {    // func_03
                if (err) {
                    return res.json(ret_value(
                        failure_msg_base,
                        ERR_MSG_DB_DELETE_ERR + err,
                        "E_POST_UNREG_USER_04", null
                    ));
                }

                // Deletion succeeded.
                return res.json(ret_value(
                    success_msg_base,
                    null, null, null
                ));
            }); // func_03
        }); // func_02
    }); // func_01
});

// ============================================================================
// Login

app.post('/login', function(req, res) {
    var failure_msg_base = "That username and password combination was not correct";
    var success_msg_base = "Authentication succeeded.";

    var username = emptize(req.body.username);
    var password = emptize(req.body.password);

    pool.getConnection(function(err, conn) {    // Func_01
        if (err) {
            var ret = ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_LOGIN_01", null
            );
            ret["menu"] = [];
            ret["sessionID"] = "";
            return res.json(ret);
        }

        var sql_stmt = "SELECT * FROM `User` WHERE `Name`=" +
            conn.escape(username) + " AND `Password`=" +
            conn.escape(password) + "";

        conn.query(sql_stmt, function(err, rows) {  // Func_02
            conn.release();
            if (err) {
                var ret = ret_value(
                    failure_msg_base,
                    "Database QUERY error: " + err,
                    "E_POST_LOGIN_02",
                    sql_stmt
                );
                ret["menu"] = [];
                ret["sessionID"] = "";
                return res.json(ret);
            }

            if (rows.length > 1) {
                var ret = ret_value(
                    failure_msg_base,
                    "Database error: The provided user name matches multiple users.",
                    "E_POST_LOGIN_03",
                    _Q(rows.length) + " users."
                );
                ret["menu"] = [];
                ret["sessionID"] = "";
                return res.json(ret);
            }

            if (rows.length == 0) {
                var ret = ret_value(
                    failure_msg_base,
                    "Incorrect user name or password.",
                    "E_POST_LOGIN_04", null
                );
                ret["menu"] = [];
                ret["sessionID"] = "";
                return res.json(ret);
            }

            if (rows.length == 1) {
                // User authentication succeeded. Create a session for him/her.
                var session_info = session_create(rows[0].ID, rows[0].Role);
                // Return the allowed menu items.
                var menu_list = get_role_menu(req.baseUrl, rows[0].Role);
                // Respond.
                var ret = ret_value(
                    success_msg_base,
                    null, null, null
                );
                ret["menu"] = menu_list;
                ret["sessionID"] = session_info.sid;
                return res.json(ret);
            }
        }); // Func_02

        conn.on('error', function(err) {    // Func_03
            var ret = ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_LOGIN_05", null
            );
            ret["menu"] = [];
            ret["sessionID"] = "";
            return res.json(ret);
        }); // Func_03
    }); // Func_01
});

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
// Update Contact Information

function sql_set_field_value(conn, field, value, sep) {
    return (_NU(value) ? "" : ("`" + field + "`=" + conn.escape(value) + sep));
}

function db_update_user(conn, user_info) {
    var failure_msg_base = "Contact info update failed: ";
    var success_msg_base = "Your information has been updated.";

    var assignments =
        sql_set_field_value(conn, "uName", user_info.uname, ",") +
        sql_set_field_value(conn, "pWord", user_info.pwd, "")
        ;

    if (assignments != "") {
        // Only update the User table when there is something to update.
        var sql_stmt = "UPDATE `User` SET "+ assignments + " WHERE `ID`=" + user_info.id;
        conn.query(sql_stmt, function(err, result) {    // func_02
            if (err) {
                return res.json(ret_value(
                    failure_msg_base,
                    "Database UPDATE error: " + err,
                    "E_POST_UPDATE_INFO_06",
                    sql_stmt
                ));    // Return
            } else {
                // OK. Finally we've done everything.
                // Return success.
                return res.json(ret_value(
                    success_msg_base, null, null, null
                ));    // Return
            }
        }); // func_02
    }
}

app.post('/updateInfo', function(req, res) {
    var failure_msg_base = "Contact info update failed: ";
    var success_msg_base = "Your information has been updated.";

    if (!req.isAuthenticated()) {
        return res.json(ret_value(
            failure_msg_base,
            "Not authenticated.",
            "E_POST_UPDATE_INFO_01",
            null
        ));
    }

    var user_info = {
        id : req.user.id,
        fname : req.body.fName,
        lname : req.body.lName,
        addr : req.body.address,
        city : req.body.city,
        state : req.body.state,
        zip : req.body.zip,
        email : req.body.email,
        uname : req.body.uName,
        pwd : req.body.pWord
    };

    // Validate parameter: state
    if (user_info.state) {
        if (valid_state_abbr.indexOf(user_info.state.toUpperCase()) == -1) {
            // Meaning that state's value is not a valid state abbreviation.
            return res.json(ret_value(
                failure_msg_base,
                "Invalid state abbreviation: " + user_info.state,
                "E_POST_UPDATE_INFO_02", null
            )); // Return
        }
    }

    // Validate parameter: zip code.
    if (user_info.zip) {
        if (!zip_code_pattern.test(user_info.zip)) {
            // Meaning that zip's value is not a 5-digit zip code.
            return res.json(ret_value(
                failure_msg_base,
                "Invalid zip code: " + user_info.zip,
                "E_POST_UPDATE_INFO_03", null
            ));    // Return
        }
    }

    // Validate parameter: email format.
    // We assume that if the format is correct, the email is valid.
    if (user_info.email) {
        if (!email_pattern.test(user_info.email)) {
            // Meaning that email's value is not a valid email address.
            return res.json(ret_value(
                failure_msg_base,
                "Invalid email format: " + user_info.email,
                "E_POST_UPDATE_INFO_04", null
            ));    // Return
        }
    }

    // Update the database.
    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_UPDATE_INFO_05", null
            ));    // Return
        }

        // Create the value assignments in the SET part.
        var assignments = sql_set_field_value(conn, "fName", user_info.fname, ",") +
            sql_set_field_value(conn, "lName", user_info.lname, ",") +
            sql_set_field_value(conn, "addr", user_info.addr, ",") +
            sql_set_field_value(conn, "city", user_info.city, ",") +
            sql_set_field_value(conn, "state", user_info.state, ",") +
            sql_set_field_value(conn, "zip", user_info.zip, ",") +
            sql_set_field_value(conn, "email", user_info.email, "")
            ;

        if (assignments != "") {
            // Only update the UserContact table when there is something to update.
            var sql_stmt = "UPDATE `UserContact` SET "+ assignments + " WHERE `ID`=" + user_info.id;
            conn.query(sql_stmt, function(err, result) {    // func_02
                if (err) {
                    return res.json(ret_value(
                        failure_msg_base,
                        "Database UPDATE error: " + err,
                        "E_POST_UPDATE_INFO_06",
                        sql_stmt
                    ));    // Return
                } else {
                    // Update the User table.
                    return db_update_user(conn, user_info);
                }
            }); // func_02
        } else {
            // If there is nothing to update to the UserContact table,
            // then only update the User table.
            return db_update_user(conn, user_info);
        }
    }); // func_01
});

// ============================================================================
// Modify Products

app.post('/modifyProduct', function(req, res) {
    var success_msg_base = "The product information has been updated";
    var failure_msg_base = "There was a problem with this action";

    // Authenticate the user
    if (!req.isAuthenticated()) {
        return res.json(ret_value(
            failure_msg_base,
            ERR_MSG_AUTH_FAILURE + "User must log in to modify the product information.",
            "E_POST_MODIFY_PROD_01", null
        ));
    }

    // Check if the user is an admin.
    if (req.user.role != USER_ROLE_CUSTOMER) {
        return res.json(ret_value(
            failure_msg_base,
            ERR_MSG_AUTH_FAILURE + "Only admin can modify product information",
            "E_POST_MODIFY_PROD_02", null
        ));
    }

    // Update the product info in database.
    // Update the database.
    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_MODIFY_PROD_03", null
            ));    // Return
        }

        var sql_stmt = "UPDATE `Product` SET " +
            sql_set_field_value(conn, "ID", prod_info.id, ",") +
            sql_set_field_value(conn, "Description", prod_info.description, ",") +
            sql_set_field_value(conn, "Title", prod_info.title, "")
            ;

        conn.query(sql_stmt, function(err, result) {    // func_02
            if (err) {
                return res.json(ret_value(
                    failure_msg_base,
                    "Database UPDATE error: " + err,
                    "E_POST_MODIFY_PROD_04",
                    sql_stmt
                ));    // Return
            }

            // Product info update succeeded.
            res.json(ret_value(
                success_msg_base,
                null, null, null
            ));
        }); // func_02
    }); // func_01
});

// ============================================================================
// View Users

app.get('/viewUsers', function(req, res) {
    var failure_msg_base = "There was a problem with this action";

    // Authenticate the user
    if (!req.isAuthenticated()) {
        return res.json(ret_value(
            failure_msg_base,
            ERR_MSG_AUTH_FAILURE + "User must log in to view the users' information.",
            "E_GET_VIEW_USER_01", null
        ));
    }

    // Check if the user is an admin.
    if (req.user.role != USER_ROLE_CUSTOMER) {
        return res.json(ret_value(
            failure_msg_base,
            ERR_MSG_AUTH_FAILURE + "Only admin can view users' information.",
            "E_GET_VIEW_USER_02", null
        ));
    }

    var fname = emptize(req.body.fName);
    var lname = emptize(req.body.lName);

    // Find the user information from the database.
    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.json(ret_value(
                failure_msg_base,
                ERR_MSG_DB_CONN_ERR + err,
                "E_GET_VIEW_USER_03", null
            ));    // Return
        }

        var sql_stmt = "SELECT User.Name, User.Role, UserContact.FName, "
            "UserContact.LName, UserContact.Addr, UserContact.City, UserContact.State, "
            "UserContact.Zip, UserContact.Email "
            "FROM User INNER JOIN UserContact ON User.ID = UserContact.UserID "
            "WHERE UserContact.FName LIKE '%" + fname + "%' OR UserContact.LName LIKE '%" + lname + "%'";
            ;

        conn.query(sql_stmt, function(err, rows) {    // func_02
            if (err) {
                return res.json(ret_value(
                    failure_msg_base,
                    ERR_MSG_DB_SELECT_ERR + err,
                    "E_GET_VIEW_USER_04",
                    sql_stmt
                ));    // Return
            }

            // User information has been selected.
            res.json(rows);
        }); // func_02
    }); // func_01
});

// ============================================================================
// View Products

app.get('/getProducts', function(req, res) {
    var failure_msg_base = "There was a problem with this action";

    // "View Products" does not require user login.

    var id = emptize(req.body.productId);
    var category = emptize(req.body.category);
    var keyword = emptize(req.body.keyword);

    // Find the product information from the database.
    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.json(ret_value(
                failure_msg_base,
                ERR_MSG_DB_CONN_ERR + err,
                "E_GET_VIEW_PROD_01", null
            ));    // Return
        }

        // Build the search criteria.
        // TODO: Implement me!

        var sql_stmt = "SELECT Product.Title, Product.Category, Product.Description FROM Product ";

        conn.query(sql_stmt, function(err, rows) {    // func_02
            if (err) {
                return res.json(ret_value(
                    failure_msg_base,
                    ERR_MSG_DB_SELECT_ERR + err,
                    "E_GET_VIEW_PROD_02",
                    sql_stmt
                ));    // Return
            }

            // Product information has been selected.
            res.json(rows);
        }); // func_02
    }); // func_01
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
