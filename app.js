var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var uuid_gen = require('node-uuid');
var lineReader = require('line-reader');

var mysql = require('mysql');
var pool = mysql.createPool({
    connectionLimit : 100,
    host : 'localhost',
    user : 'root',
    password : 'password',
    port : 3306,
    database : 'SimpAmz',
    debug : false
});

var app = express();

// ============================================================================

// Do not use the "g" flag if you don't want to reset the index.
// See this post for more info:
// http://stackoverflow.com/a/1520853/630364
var zip_code_pattern = /^\d{5}$/;

// The email address regex pattern is found here:
// http://stackoverflow.com/a/1373724/630364
// God knows how the IETF guys figured out such a complex pattern...
var email_pattern = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

// ============================================================================

// The time that a session will timeout.
var SESSION_TIMEOUT = 15 * 60 * 1000;

var USER_ROLE_CUSTOMER = "Customer";
var USER_ROLE_ADMIN = "Admin";

var ERR_MSG_AUTH_FAILURE = "Authentication failed: ";
var ERR_MSG_PARAM = "Parameter error: ";
var ERR_MSG_DB_CONN_ERR = "Database connection error: ";
var ERR_MSG_DB_SELECT_ERR = "Database SELECT error: ";
var ERR_MSG_DB_DELETE_ERR = "Database DELETE error: ";

// ============================================================================

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Favicon
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// Utility functions

function _NU(obj) {
    return (obj == null || obj == undefined);
}

function _NUE(obj) {
    return (obj == null || obj == undefined || obj == "");
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
    var rand_uuid = uuid_gen.v4();
    return {
        sid : user_id + "_" + curr_date_time_value + "_" + rand_uuid.substring(0, 7),     // session ID
        uid : user_id,         // user ID
        role : user_role,      // user's role
        last_login : curr_date_time_value   // The time the user last logged in
    };
}

// ============================================================================
// Helper functions

function sql_set_field_value(conn, field, value, sep) {
    return (_NU(value) ? "" : ("`" + field + "`=" + conn.escape(value) + sep));
}

function get_role_menu(url, user_role) {
    if (user_role == "Admin") {
        return [
            url + "/" + "modifyProduct",
            url + "/" + "viewUsers",
            url + "/" + "getProducts"
        ];
    } else if (user_role == "Customer") {
        return [
            url + "/" + "updateInfo",
            url + "/" + "getProducts"
        ];
    }

    return [];  // Wrong user role so we return empty menu list.
}

// ============================================================================
// Index page

app.get("/", function(req, res) {
    // Accessing '/' will be redirected to '/index'.
    res.redirect("/index");
});

app.get("/index", function(req, res) {
    res.render('index', {
        title: 'SimpAmz',
        full_title: 'SIMPlified AMaZon',
        error: ''
    });
});

// ============================================================================
// Register new user as Customer.

app.post("/registerUser", function(req, res) {
    // Define the default return message.
    var success_msg_base = "Your account has been registered";
    var failure_msg_base = "there was a problem with your registration";

    // Get the registration parameters.
    var fname = req.body.fname;
    var lname = req.body.lname;
    var addr = req.body.address;
    var city = req.body.city;
    var state = req.body.state;
    var zip = req.body.zip;
    var email = req.body.email;
    var uname = req.body.username;
    var pwd = req.body.password;
    var role = req.body.role;

    // Validate parameter: zip code.
    if (zip) {
        if (!zip_code_pattern.test(zip)) {
            // Meaning that zip's value is not a 5-digit zip code.
            return res.status(400).json(ret_value(
                failure_msg_base,
                "Invalid zip code: " + zip,
                "E_POST_REG_USER_01", null
            ));    // Return
        }
    }

    // Validate parameter: email format.
    // We assume that if the format is correct, the email is valid.
    if (email) {
        if (!email_pattern.test(email)) {
            // Meaning that email's value is not a valid email address.
            return res.status(400).json(ret_value(
                failure_msg_base,
                "Invalid email format: " + email,
                "E_POST_REG_USER_02", null
            ));    // Return
        }
    }

    // Validate parameter: user name must not be empty and must not exist.
    if (!uname || uname == "") {
        // Meaning that uname is empty, which is not allowed.
        return res.status(400).json(ret_value(
            failure_msg_base,
            "User name must not be empty.",
            "E_POST_REG_USER_03", null
        ));    // Return
    }

    // Validate parameter: password must not be empty and must not exist.
    if (!pwd || pwd == "") {
        // Meaning that pwd is empty, which is not allowed.
        return res.status(400).json(ret_value(
            failure_msg_base,
            "Password must not be empty.",
            "E_POST_REG_USER_04", null
        ));    // Return
    }

    // Validate parameter: Role is a secret parameter. If it is correctly
    // assigned a value, then we use the value to assign the role.
    // Otherwise we treat it as "Customer".
    if ((!role) || (role != USER_ROLE_ADMIN && role != USER_ROLE_CUSTOMER)) {
        role = USER_ROLE_CUSTOMER;
    }

    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(500).json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_REG_USER_05", null
            ));    // Return
        }

        var sql_stmt = "INSERT INTO `User` (`FName`, `LName`, `Addr`, `City`, `State`, `Zip`, `Email`, `UName`, `Password`, `Role`) VALUES (" +
            _Q(fname) + ", " + _Q(lname) + ", " + _Q(addr) + ", " + _Q(city) + ", " +
            _Q(state) + ", " + _Q(zip) + ", " + _Q(email) + ", " + _Q(uname) + ", " +
            _Q(pwd) + ", " + _Q(role) + ")";
        conn.query(sql_stmt, function(err, result) {    // func_02
            if (err) {
                conn.release();
                return res.status(500).json(ret_value(
                    failure_msg_base,
                    "Database INSERT INTO error: " + err,
                    "E_POST_REG_USER_06",
                    sql_stmt
                ));    // Return
            } else {
                conn.release();
                // OK. Finally we've done everything.
                // Return success.
                return res.json(ret_value(
                    success_msg_base, null, null, null
                ));    // Return
            }
        }); // func_02
    }); // func_01
});

// ============================================================================
// Unregister an existing user.

app.post('/unregisterUser', function(req, res) {
    var success_msg_base = "Your account has been unregistered.";
    var failure_msg_base = "Account unregistration failed: ";

    // The user must be authenticated in order to unregister the account.
    var sessionID = emptize(req.body.sessionID);

    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(500).json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_UNREG_USER_01", null
            ));    // Return
        }

        var sql_stmt = "SELECT User.ID, User.Role, Session.LastLogin FROM User " +
                       "INNER JOIN Session " +
                       "ON User.ID = Session.UserID " +
                       "WHERE Session.SessionID = " + _Q(sessionID);
        var session_info = null;    // Will retrieve the info later.
        conn.query(sql_stmt, function(err, rows) {  // func_02
            if (err) {
                conn.release();
                return res.status(500).json(ret_value(
                    failure_msg_base,
                    "Database SELECT error: " + err,
                    "E_POST_UNREG_USER_02",
                    sql_stmt
                ));    // Return
            } else {
                if (rows.length < 1) {
                    conn.release();
                    // Not authenticated
                    return res.status(401).json(ret_value(
                        failure_msg_base,
                        "Not authenticated.",
                        "E_POST_UNREG_USER_03",
                        null
                    ));
                } else {
                    // The case that rows.length > 1 should never happen
                    // because the session ID is unique in the database.
                    // In case it happens, we just assume the user has logged
                    // in successfully.
                    //
                    // Need to retrieve the user information.
                    session_info = {
                        uid : rows[0].ID,
                        role : rows[0].Role,
                        lastLogin : rows[0].LastLogin
                    };
                }
            }

            // TODO: Check if the session expires. If yes, return error;
            // if not, update the last login time.

            sql_stmt = "DELETE FROM `User` WHERE `ID` = " + conn.escape(session_info.uid);

            conn.query(sql_stmt, function(err, result) {    // func_03
                if (err) {
                    conn.release();
                    return res.status(500).json(ret_value(
                        failure_msg_base,
                        ERR_MSG_DB_DELETE_ERR + err,
                        "E_POST_UNREG_USER_04", null
                    ));
                }

                // Deletion succeeded.
                conn.release();
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
            ret["err_message"] = failure_msg_base;
            ret["menu"] = [];
            res.cookie("sessionID", "");
            return res.status(500).json(ret);
        }

        var sql_stmt = "SELECT * FROM `User` WHERE `UName`=" +
            conn.escape(username) + " AND `Password`=" +
            conn.escape(password) + "";

        conn.query(sql_stmt, function(err, rows) {  // Func_02
            if (err) {
                conn.release();
                var ret = ret_value(
                    failure_msg_base,
                    "Database QUERY error: " + err,
                    "E_POST_LOGIN_02",
                    sql_stmt
                );
                ret["err_message"] = failure_msg_base;
                ret["menu"] = [];
                res.cookie("sessionID", "");
                return res.status(500).json(ret);
            }

            if (rows.length > 1) {
                conn.release();
                var ret = ret_value(
                    failure_msg_base,
                    "Database error: The provided user name matches multiple users.",
                    "E_POST_LOGIN_03",
                    _Q(rows.length) + " users."
                );
                ret["err_message"] = failure_msg_base;
                ret["menu"] = [];
                res.cookie("sessionID", "");
                return res.status(500).json(ret);
            }

            if (rows.length == 0) {
                conn.release();
                var ret = ret_value(
                    failure_msg_base,
                    "Incorrect user name or password.",
                    "E_POST_LOGIN_04", null
                );
                ret["err_message"] = failure_msg_base;
                ret["menu"] = [];
                res.cookie("sessionID", "");
                return res.status(401).json(ret);
            }

            if (rows.length == 1) {
                // User authentication succeeded. Create a session for him/her.
                var session_info = session_create(rows[0].ID, rows[0].Role);

                // Now save the session info into database.
                sql_stmt = "INSERT INTO Session (SessionID, UserID, LastLogin) VALUES (" +
                    _Q(session_info.sid) + ", " + _Q(session_info.uid) + ", " + _Q(session_info.last_login) + ")";

                conn.query(sql_stmt, function(err, result) {    // func_03
                    if (err) {
                        conn.release();
                        return res.status(500).json(ret_value(
                            failure_msg_base,
                            "Database INSERT INTO error: " + err,
                            "E_POST_LOGIN_05",
                            sql_stmt
                        ));    // Return
                    } else {
                        conn.release();
                        // OK. Finally we've done everything.
                        // Return success.
                        // Return the allowed menu items.
                        var menu_list = get_role_menu(
                            req.hostname + req.baseUrl,
                            rows[0].Role
                        );
                        // Respond.
                        var ret = ret_value(
                            success_msg_base,
                            null, null, null
                        );
                        ret["err_message"] = "";
                        ret["menu"] = menu_list;
                        res.cookie("sessionID", session_info.sid);
                        return res.json(ret);
                    }
                }); // func_03
            } else {
                conn.release();
                // Either we found no record(which means the user or password don't match)
                // or we found multiple records which is a weird case.
                var ret = ret_value(
                    failure_msg_base,
                    null, "E_POST_LOGIN_06", null
                );
                ret["err_message"] = failure_msg_base;
                ret["menu"] = [];
                res.cookie("sessionID", "");
                return res.status(500).json(ret);
            }
        }); // Func_02

        conn.on('error', function(err) {    // Func_03
            conn.release();
            var ret = ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_LOGIN_05", null
            );
            ret["err_message"] = failure_msg_base;
            ret["menu"] = [];
            res.cookie("sessionID", "");
            return res.status(500).json(ret);
        }); // Func_03
    }); // Func_01
});

// ============================================================================
// Logout

app.post('/logout', function(req, res) {
    var success_msg_base = "You have been logged out";
    var failure_msg_base = "You are not currently logged in";

    var sessionID = emptize(req.cookies.sessionID);

    // Try to delete the session directly.
    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(500).json(ret_value(
                "Database connection error: ",
                err, "E_POST_LOGOUT_01", null
            ));    // Return
        }

        var sql_stmt = "DELETE FROM `Session` WHERE `SessionID`=" + _Q(sessionID);
        conn.query(sql_stmt, function(err, result) {    // func_02
            if (err) {
                conn.release();
                return res.status(500).json(ret_value(
                    "Database DELETE error: ",
                    err, "E_POST_LOGOUT_02",
                    sql_stmt
                ));    // Return
            } else {
                if (result.affectedRows == 0) {
                    conn.release();
                    // If the number of affected rows is 0, that means this
                    // session didn't exist before.
                    return res.status(500).json(ret_value(
                        failure_msg_base,
                        null, "E_POST_LOGOUT_03",
                        sql_stmt
                    ));    // Return
                } else if (result.affectedRows > 1) {
                    conn.release();
                    // This should never happen because the session ID
                    // is guaranteed to be unique in the database.
                    // However, in case this really happens, let's just assume
                    // the user logs out successfully.
                    // But because this is an abnormal case, we still give the
                    // error point value.
                    return res.json(ret_value(
                        success_msg_base,
                        null, "E_POST_LOGOUT_04", null
                    ));
                } else {
                    conn.release();
                    // Successful logout.
                    return res.json(ret_value(
                        success_msg_base,
                        null, null, null
                    ));
                }
            }
        }); // func_02
    }); // func_01
});

// ============================================================================
// Update Contact Information

app.post('/updateInfo', function(req, res) {
    var failure_msg_base = "There was a problem with this action";
    var success_msg_base = "Your information has been updated";

    // Authenticate the user
    var sessionID = emptize(req.cookies.sessionID);

    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(500).json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_UPDATE_INFO_01", null
            ));    // Return
        }

        var sql_stmt = "SELECT User.ID, User.Role, Session.LastLogin FROM User " +
                       "INNER JOIN Session " +
                       "ON User.ID = Session.UserID " +
                       "WHERE Session.SessionID = " + _Q(sessionID);
        var session_info = null;    // Will retrieve the info later.
        conn.query(sql_stmt, function(err, rows) {  // func_02
            if (err) {
                conn.release();
                return res.status(500).json(ret_value(
                    failure_msg_base,
                    "Database SELECT error: " + err,
                    "E_POST_UPDATE_INFO_02",
                    sql_stmt
                ));    // Return
            } else {
                if (rows.length < 1) {
                    conn.release();
                    // Not authenticated
                    return res.status(401).json(ret_value(
                        failure_msg_base,
                        "Not authenticated.",
                        "E_POST_UPDATE_INFO_03",
                        null
                    ));
                } else {
                    // The case that rows.length > 1 should never happen
                    // because the session ID is unique in the database.
                    // In case it happens, we just assume the user has logged
                    // in successfully.
                    //
                    // Need to retrieve the user information.
                    session_info = {
                        uid : rows[0].ID,
                        role : rows[0].Role,
                        lastLogin : rows[0].LastLogin
                    };
                }
            }

            // TODO: Check if the session expires. If yes, return error;
            // if not, update the last login time.

            // OK. Now the user is an authenticated one.
            // We can go on and try to update the user's information.

            var user_info = {
                id : session_info.uid,
                fname : req.body.fname,
                lname : req.body.lname,
                addr : req.body.address,
                city : req.body.city,
                state : req.body.state,
                zip : req.body.zip,
                email : req.body.email,
                uname : req.body.username,
                pwd : req.body.password
            };

            // Validate parameter: zip code.
            if (user_info.zip) {
                if (!zip_code_pattern.test(user_info.zip)) {
                    conn.release();
                    // Meaning that zip's value is not a 5-digit zip code.
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        "Invalid zip code: " + user_info.zip,
                        "E_POST_UPDATE_INFO_04", null
                    ));    // Return
                }
            }

            // Validate parameter: email format.
            // We assume that if the format is correct, the email is valid.
            if (user_info.email) {
                if (!email_pattern.test(user_info.email)) {
                    conn.release();
                    // Meaning that email's value is not a valid email address.
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        "Invalid email format: " + user_info.email,
                        "E_POST_UPDATE_INFO_05", null
                    ));    // Return
                }
            }

            // Create the value assignments in the SET part.
            var assignments =
                sql_set_field_value(conn, "FName", user_info.fname, ",") +
                sql_set_field_value(conn, "LName", user_info.lname, ",") +
                sql_set_field_value(conn, "Addr", user_info.addr, ",") +
                sql_set_field_value(conn, "City", user_info.city, ",") +
                sql_set_field_value(conn, "State", user_info.state, ",") +
                sql_set_field_value(conn, "Zip", user_info.zip, ",") +
                sql_set_field_value(conn, "Email", user_info.email, ",") +
                sql_set_field_value(conn, "UName", user_info.uname, ",") +
                sql_set_field_value(conn, "Password", user_info.pwd, "")
                ;

            if (assignments != "") {
                // Only update the UserContact table when there is something to update.
                sql_stmt = "UPDATE `User` SET "+ assignments +
                    " WHERE `ID`=" + conn.escape(user_info.id);
                conn.query(sql_stmt, function(err, result) {    // func_03
                    if (err) {
                        conn.release();
                        return res.status(400).json(ret_value(
                            failure_msg_base,
                            "Database UPDATE error: " + err,
                            "E_POST_UPDATE_INFO_06",
                            sql_stmt
                        ));    // Return
                    } else {
                        conn.release();
                        return res.json(ret_value(success_msg_base, null, null, null));
                    }
                }); // func_03
            } else {
                conn.release();
                return res.json(ret_value(success_msg_base, null, null, null));
            }
        }); // func_02
    }); // func_01
});

// ============================================================================
// Modify Products

app.post('/modifyProduct', function(req, res) {
    var success_msg_base = "The product information has been updated";
    var failure_msg_base = "There was a problem with this action";

    // Authenticate the user
    var sessionID = emptize(req.cookies.sessionID);

    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(400).json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_MODIFY_PROD_01", null
            ));    // Return
        }

        var sql_stmt = "SELECT User.ID, User.Role, Session.LastLogin FROM User " +
                       "INNER JOIN Session " +
                       "ON User.ID = Session.UserID " +
                       "WHERE Session.SessionID = " + _Q(sessionID);
        var session_info = null;    // Will retrieve the info later.
        conn.query(sql_stmt, function(err, rows) {  // func_02
            if (err) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    "Database SELECT error: " + err,
                    "E_POST_MODIFY_PROD_02",
                    sql_stmt
                ));    // Return
            } else {
                if (rows.length < 1) {
                    conn.release();
                    // Not authenticated
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        "Not authenticated.",
                        "E_POST_MODIFY_PROD_03",
                        null
                    ));
                } else {
                    // The case that rows.length > 1 should never happen
                    // because the session ID is unique in the database.
                    // In case it happens, we just assume the user has logged
                    // in successfully.
                    //
                    // Need to retrieve the user information.
                    session_info = {
                        uid : rows[0].ID,
                        role : rows[0].Role,
                        lastLogin : rows[0].LastLogin
                    };
                }
            }

            // TODO: Check if the session expires. If yes, return error;
            // if not, update the last login time.

            if (session_info.role != USER_ROLE_ADMIN) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    ERR_MSG_AUTH_FAILURE + "Only admin can modify product information.",
                    "E_POST_MODIFY_PROD_04", null
                ));
            }

            var prod_info = {
                id : req.body.productId,
                description : req.body.productDescription,
                title : req.body.productTitle
            };

            // ID must be provided.
            if (_NUE(prod_info.id)) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    ERR_MSG_PARAM + "productId must not be empty.",
                    "E_POST_MODIFY_PROD_05", null
                ));
            }

            // Only update when there is something to update.
            if (_NU(prod_info.description) && _NU(prod_info.title)) {
                conn.release();
                return res.json(ret_value(
                    success_msg_base,
                    null, null, null
                ));
            }

            var sql_stmt = "UPDATE `Product` SET " +
                sql_set_field_value(conn, "Description", prod_info.description, ",") +
                sql_set_field_value(conn, "Title", prod_info.title, "") +
                " WHERE `ID`=" + prod_info.id;
                ;

            conn.query(sql_stmt, function(err, result) {    // func_03
                if (err) {
                    conn.release();
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        "Database UPDATE error: " + err,
                        "E_POST_MODIFY_PROD_06",
                        sql_stmt
                    ));    // Return
                }

                conn.release();
                // Product info update succeeded.
                return res.json(ret_value(
                    success_msg_base,
                    null, null, null
                ));
            }); // func_03
        }); // func_02
    }); // func_01
});

// ============================================================================
// View Users

app.get('/viewUsers', function(req, res) {
    var failure_msg_base = "There was a problem with this action";

    // Authenticate the user
    var sessionID = emptize(req.cookies.sessionID);

    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(400).json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_GET_VIEW_USER_01", null
            ));    // Return
        }

        var sql_stmt = "SELECT User.ID, User.Role, Session.LastLogin FROM User " +
                       "INNER JOIN Session " +
                       "ON User.ID = Session.UserID " +
                       "WHERE Session.SessionID = " + _Q(sessionID);
        var session_info = null;    // Will retrieve the info later.
        conn.query(sql_stmt, function(err, rows) {  // func_02
            if (err) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    "Database SELECT error: " + err,
                    "E_GET_VIEW_USER_02",
                    sql_stmt
                ));    // Return
            } else {
                if (rows.length < 1) {
                    conn.release();
                    // Not authenticated
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        "Not authenticated.",
                        "E_GET_VIEW_USER_03",
                        null
                    ));
                } else {
                    // The case that rows.length > 1 should never happen
                    // because the session ID is unique in the database.
                    // In case it happens, we just assume the user has logged
                    // in successfully.
                    //
                    // Need to retrieve the user information.
                    session_info = {
                        uid : rows[0].ID,
                        role : rows[0].Role,
                        lastLogin : rows[0].LastLogin
                    };
                }
            }

            // TODO: Check if the session expires. If yes, return error;
            // if not, update the last login time.

            // Check if the user is an admin.
            if (session_info.role != USER_ROLE_ADMIN) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    ERR_MSG_AUTH_FAILURE + "Only admin can view users' information.",
                    "E_GET_VIEW_USER_04", null
                ));
            }

            var fname = emptize(req.query.fname);
            var lname = emptize(req.query.lname);

            // This is the SQL statement that queries everything about user.
            // We do not need so much information right now, so just comment it
            // out for future reference.
            //
            // var sql_stmt = "SELECT User.Name, User.Role, UserContact.FName, "
            //     "UserContact.LName, UserContact.Addr, UserContact.City, UserContact.State, "
            //     "UserContact.Zip, UserContact.Email "
            //     "FROM User INNER JOIN UserContact ON User.ID = UserContact.UserID "
            //     "WHERE UserContact.FName LIKE '%" + fname + "%' OR UserContact.LName LIKE '%" + lname + "%'";
            //     ;

            var sql_stmt = "SELECT User.ID, User.UName, User.FName, User.LName " +
                "FROM User WHERE User.FName LIKE '%" + fname + "%' AND User.LName LIKE '%" + lname + "%'";
                ;

            conn.query(sql_stmt, function(err, rows) {    // func_03
                if (err) {
                    conn.release();
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        ERR_MSG_DB_SELECT_ERR + err,
                        "E_GET_VIEW_USER_05",
                        sql_stmt
                    ));    // Return
                }

                conn.release();
                // User information has been selected.
                return res.json({
                    user_list : rows
                });
            }); // func_03
        }); // func_02
    }); // func_01
});

// ============================================================================
// View Products

app.get('/getProducts', function(req, res) {
    var failure_msg_base = "There was a problem with this action";

    // "View Products" does not require user login.

    var id = emptize(req.query.productId);
    var category = emptize(req.query.category);
    var keyword = emptize(req.query.keyword);

    // Find the product information from the database.
    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(400).json(ret_value(
                failure_msg_base,
                ERR_MSG_DB_CONN_ERR + err,
                "E_GET_VIEW_PROD_01", null
            ));    // Return
        }

        // Build the search criteria.
        var sql_stmt;
        if (id != "") {
            // If ID is provided, then we can search for the specific product.
            sql_stmt = "SELECT `ID`, `Title` FROM `Product` WHERE `ID`=" + conn.escape(id);
        } else {
            // conn.escape() will put a pair of '' around the variables' values
            // and caused SQL syntax errors. So please do not use them.
            sql_stmt = "SELECT `ID`, `Title` FROM `Product` WHERE `Category` LIKE '%" +
                category + "%' AND (`Title` LIKE '%" +
                keyword + "%' OR `Description` LIKE '%" +
                keyword + "%')";
        }

        conn.query(sql_stmt, function(err, rows) {    // func_02
            if (err) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    ERR_MSG_DB_SELECT_ERR + err,
                    "E_GET_VIEW_PROD_02",
                    sql_stmt
                ));    // Return
            }

            conn.release();
            // Product information has been selected.
            return res.json({
                product_list : rows
            });
        }); // func_02
    }); // func_01
});

// ============================================================================
// Purchase a product

app.post('/buyProduct', function(req, res) {
    var success_msg_base = "01 the purchase has been made successfully";
    var failure_msg_base = "There was a problem with this action";

    // Authenticate the user
    var sessionID = emptize(req.cookies.sessionID);

    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(400).json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_BUY_PROD_01", null
            ));    // Return
        }

        var sql_stmt = "SELECT User.ID, User.Role, Session.LastLogin FROM User " +
                       "INNER JOIN Session " +
                       "ON User.ID = Session.UserID " +
                       "WHERE Session.SessionID = " + _Q(sessionID);
        var session_info = null;    // Will retrieve the info later.
        conn.query(sql_stmt, function(err, rows) {  // func_02
            if (err) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    "Database SELECT error: " + err,
                    "E_POST_BUY_PROD_02",
                    sql_stmt
                ));    // Return
            } else {
                if (rows.length < 1) {
                    conn.release();
                    // Not authenticated
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        "02 you need to log in prior to buying a product",
                        "E_POST_BUY_PROD_03",
                        null
                    ));
                } else {
                    // The case that rows.length > 1 should never happen
                    // because the session ID is unique in the database.
                    // In case it happens, we just assume the user has logged
                    // in successfully.
                    //
                    // Need to retrieve the user information.
                    session_info = {
                        uid : rows[0].ID,
                        role : rows[0].Role,
                        lastLogin : rows[0].LastLogin
                    };
                }
            }

            // TODO: Check if the session expires. If yes, return error;
            // if not, update the last login time.

            var prod_info = {
                id : req.body.productId,
                quantity : 1    // Default value
            };

            // ID must be provided.
            if (_NUE(prod_info.id)) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    ERR_MSG_PARAM + "productId must not be empty.",
                    "E_POST_BUY_PROD_04", null
                ));
            }

            var sql_stmt = "UPDATE `Inventory` SET " +
                "`Quantity` = `Quantity` - " + prod_info.quantity +
                " WHERE `ProdID` = " + prod_info.id + " AND `Quantity` > 0"
                ;

            conn.query(sql_stmt, function(err, result) {    // func_03
                if (err) {
                    conn.release();
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        "Database UPDATE error: " + err,
                        "E_POST_BUY_PROD_05",
                        sql_stmt
                    ));    // Return
                }

                if (result.affectedRows == 0) {
                    // Either the ID is wrong or the quantity is already 0.
                    conn.release();
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        "03 that product is out of stock",
                        "E_POST_BUY_PROD_06",
                        sql_stmt
                    ));     // Return
                }

                // Insert the order info.
                sql_stmt = "INSERT INTO `Order` (`ProdID`, `Quantity`) VALUES (" +
                    prod_info.id + ", " + prod_info.quantity + ")";

                conn.query(sql_stmt, function(err, result) {    // func_04
                    if (err) {
                        conn.release();
                        return res.status(400).json(ret_value(
                            failure_msg_base,
                            "Database INSERT error: " + err,
                            "E_POST_BUY_PROD_08",
                            sql_stmt
                        ));    // Return
                    }

                    conn.release();
                    // Inventory info update succeeded.
                    return res.json(ret_value(
                        success_msg_base,
                        null, null, null
                    ));
                }); // func_04
            }); // func_03
        }); // func_02
    }); // func_01
});

// ============================================================================
// Get orders

app.get('/getOrders', function(req, res) {
    var failure_msg_base = "There was a problem with this action";

    // Authenticate the user
    var sessionID = emptize(req.cookies.sessionID);

    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(400).json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_GET_ORDERS_01", null
            ));    // Return
        }

        var sql_stmt = "SELECT User.ID, User.Role, Session.LastLogin FROM User " +
                       "INNER JOIN Session " +
                       "ON User.ID = Session.UserID " +
                       "WHERE Session.SessionID = " + _Q(sessionID);
        var session_info = null;    // Will retrieve the info later.
        conn.query(sql_stmt, function(err, rows) {  // func_02
            if (err) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    "Database SELECT error: " + err,
                    "E_GET_ORDERS_02",
                    sql_stmt
                ));    // Return
            } else {
                if (rows.length < 1) {
                    conn.release();
                    // Not authenticated
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        "Not authenticated.",
                        "E_GET_ORDERS_03",
                        null
                    ));
                } else {
                    // The case that rows.length > 1 should never happen
                    // because the session ID is unique in the database.
                    // In case it happens, we just assume the user has logged
                    // in successfully.
                    //
                    // Need to retrieve the user information.
                    session_info = {
                        uid : rows[0].ID,
                        role : rows[0].Role,
                        lastLogin : rows[0].LastLogin
                    };
                }
            }

            // TODO: Check if the session expires. If yes, return error;
            // if not, update the last login time.

            var sql_stmt = "SELECT `ProdID`, `Quantity` FROM `Order`";

            conn.query(sql_stmt, function(err, rows) {    // func_03
                if (err) {
                    conn.release();
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        ERR_MSG_DB_SELECT_ERR + err,
                        "E_GET_ORDERS_04",
                        sql_stmt
                    ));    // Return
                }

                // Create the order list.
                var order_list = [];
                for (i = 0; i < rows.length; i++) {
                    order_list.push({
                        productId : rows[i].ProdID,
                        quantitySold : rows[i].Quantity
                    });
                }

                conn.release();
                return res.json(order_list);
            }); // func_03
        }); // func_02
    }); // func_01
});

// ============================================================================
// Add AlsoBought info.

app.post('/alsoBought', function(req, res) {
    var success_msg_base = "01 the request was successful";
    var failure_msg_base = "02 there was a problem processing the request";

    // Authenticate the user
    var sessionID = emptize(req.cookies.sessionID);

    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(400).json(ret_value(
                failure_msg_base,
                "Database connection error: " + err,
                "E_POST_ALSO_BOUGHT_01", null
            ));    // Return
        }

        var sql_stmt = "SELECT User.ID, User.Role, Session.LastLogin FROM User " +
                       "INNER JOIN Session " +
                       "ON User.ID = Session.UserID " +
                       "WHERE Session.SessionID = " + _Q(sessionID);
        var session_info = null;    // Will retrieve the info later.
        conn.query(sql_stmt, function(err, rows) {  // func_02
            if (err) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    "Database SELECT error: " + err,
                    "E_POST_ALSO_BOUGHT_02",
                    sql_stmt
                ));    // Return
            } else {
                if (rows.length < 1) {
                    conn.release();
                    // Not authenticated
                    return res.status(400).json(ret_value(
                        failure_msg_base,
                        "Not authenticated.",
                        "E_POST_ALSO_BOUGHT_03",
                        null
                    ));
                } else {
                    // The case that rows.length > 1 should never happen
                    // because the session ID is unique in the database.
                    // In case it happens, we just assume the user has logged
                    // in successfully.
                    //
                    // Need to retrieve the user information.
                    session_info = {
                        uid : rows[0].ID,
                        role : rows[0].Role,
                        lastLogin : rows[0].LastLogin
                    };
                }
            }

            // TODO: Check if the session expires. If yes, return error;
            // if not, update the last login time.

            if (session_info.role != USER_ROLE_ADMIN) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    ERR_MSG_AUTH_FAILURE + "Only admin can add also-bought information.",
                    "E_POST_ALSO_BOUGHT_04", null
                ));
            }

            var prod_1_id = req.body.productId1;
            var prod_2_id = req.body.productId2;

            // ID must be provided.
            if (_NUE(prod_1_id) || _NUE(prod_2_id)) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    ERR_MSG_PARAM + "productId1 and productId2 must not be empty.",
                    "E_POST_ALSO_BOUGHT_05", null
                ));
            }

            var sql_stmt = "INSERT INTO `AlsoBought` (`Bought`, `AlsoBought`) VALUES (" +
                _Q(prod_1_id) + ", " + _Q(prod_2_id) + ")";
            conn.query(sql_stmt, function(err, result) {    // func_03
                if (err) {
                    conn.release();
                    return res.status(500).json(ret_value(
                        failure_msg_base,
                        "Database INSERT INTO error: " + err,
                        "E_POST_ALSO_BOUGHT_06",
                        sql_stmt
                    ));    // Return
                } else {
                    conn.release();
                    // OK. Finally we've done everything.
                    // Return success.
                    return res.json(ret_value(
                        success_msg_base, null, null, null
                    ));    // Return
                }
            }); // func_03
        }); // func_02
    }); // func_01
});

// ============================================================================
// Get Recommendations

app.post('/getRecommendations', function(req, res) {
    var success_msg_base = "01 the request was successful";
    var failure_msg_base = "02 there was a problem processing the request";

    // Get Recommendations does not require the user to log in.

    var prod_id = emptize(req.body.productId);

    // Get the product recommendations from the database.
    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.status(400).json(ret_value(
                failure_msg_base,
                ERR_MSG_DB_CONN_ERR + err,
                "E_POST_GET_RECOMMENDATIONS_01", null
            ));    // Return
        }

        // TODO: Implement me !

        var sql_stmt = "";
        conn.query(sql_stmt, function(err, rows) {    // func_02
            if (err) {
                conn.release();
                return res.status(400).json(ret_value(
                    failure_msg_base,
                    ERR_MSG_DB_SELECT_ERR + err,
                    "E_POST_GET_RECOMMENDATIONS_02",
                    sql_stmt
                ));    // Return
            }

            conn.release();
            // Product recommendations have been selected.
            return res.json({
                product_list : rows
            });
        }); // func_02
    }); // func_01
});

// ============================================================================
// Sandbox: A place to test or experiment various capabilities.

function db_insert_user(user) {
    // Insert user information.
    var sql_stmt = "INSERT INTO `User` (`FName`, `LName`, `Addr`, `City`, `State`, `Zip`, `Email`, `UName`, `Password`) VALUES (" +
        pool.escape(user.fname) + ", " + pool.escape(user.lname) + ", " + pool.escape(user.address) + ", " +
        pool.escape(user.city) + ", " + pool.escape(user.state) + ", " + pool.escape(user.zip) + ", " +
        pool.escape(user.email) + ", " + pool.escape(user.uname) + ", " + pool.escape(user.password) +
        ")";

    pool.query(sql_stmt, function(err, result) {
        if (err || result.affectedRows != 1) {
            return false;
        }
    });

    return true;
}

app.get('/admin/load_users', function(req, res) {
    var data_file = "./data/UserData5000.csv";
    var users = [];
    var line_count = 0;
    var total_count = 0;
    var error_count = 0;

    lineReader.eachLine(data_file, function(line, last) {   // func_01
        ++line_count;

        if (line_count > 1) {
            // Skip the first line because it is the title.
            var parts = line.split("|");

            var user = {
                fname : parts[0], lname : parts[1],
                address : parts[2], city : parts[3], state : parts[4],
                zip : "", email : parts[5],
                uname : parts[6], password : parts[7]
            };

            users.push([
                user.fname, user.lname,
                user.address, user.city, user.state, user.zip, user.email,
                user.uname, user.password
            ]);
        }

        if (last) {
            var sql_stmt = "INSERT INTO `User` (`FName`, `LName`, `Addr`, `City`, `State`, `Zip`, `Email`, `UName`, `Password`) VALUES ?";
            pool.query(sql_stmt, [users], function(err, result) {
                total_count = result.affectedRows;
                error_count = users.length - total_count;

                console.log("==============================");
                console.log("Data import completed:");
                console.log("Total: " + total_count + " user(s)");
                console.log("Error: " + error_count + " user(s)");
                console.log("==============================");

                return res.json("Data import completed.");
            });
        }
    }); // func_01
});

function db_insert_record(record) {
    var categories = "";
    var index;
    for (index = 0; index < record.categories.length; ++index) {
        categories += record.categories[index];
    }

    // Insert product information.
    var sql_stmt = "INSERT INTO `Product` (`ID`, `ASIN`, `Description`, `Categories`, `Title`, `Group`) VALUES (" +
        pool.escape(record.Id) + ", " + pool.escape(record.ASIN) + ", " +
        pool.escape(null) + ", " + pool.escape(categories) + ", " +
        pool.escape(record.title) + ", " + pool.escape(record.group) + ")";

    pool.query(sql_stmt, function(err, result) {
        if (err) {
            return false;
        }
    });

    // Insert product inventory.
    var default_quantity = "5";
    sql_stmt = "INSERT INTO `Inventory` (`ProdID`, `Quantity`) VALUES (" +
        pool.escape(record.Id) + ", " + default_quantity + ")";

    pool.query(sql_stmt, function(err, result) {
        if (err) {
            return false;
        }
    });

    return true;
}

app.get('/admin/load_data', function(req, res) {
    var record = new Object();
    record.categories = [];
    var jsonRecord;
    var categories = false;
    var state = 1;  // 1 means "Not in any record"

    var data_source = req.query.source;
    var data_file = null;
    if (data_source == "amazon-meta") {
        data_file = "./data/amazon-meta.txt";
    } else {
        data_file = "./data/sample.txt";
    }

    var total_count = 0;
    var error_count = 0;

    lineReader.eachLine(data_file, function(line, last) {

        // console.log("Current line: " + line);

        if (line.indexOf("Id:") >= 0) {
            if (state == 1 /*Not in any record*/) {
                // If we are currently not in any record, that means this is
                // the very first record.
                var subStr = line.substring(line.indexOf("Id:")+3).trim();
                record.Id = subStr;

                state = 2 /*In record*/;
            } else if (state == 2 /*In record*/) {
                // If we are already in a record but encounter "Id" again,
                // that means we've come to the next record.
                // So we need to store the previous record to DB.

                ++total_count;
                if (!db_insert_record(record)) {
                    ++error_count;
                }

                // Reinitialize the record and add Id value
                record = new Object();
                record.categories = [];
                var subStr = line.substring(line.indexOf("Id:")+3).trim();
                record.Id = subStr;
            }
        }

        if (line.indexOf("ASIN:") >= 0) {
            // Record the ASIN.
            var subStr = line.substring(line.indexOf("ASIN:")+5).trim();
            record.ASIN = subStr;
        }

        if (line.indexOf("title:") >= 0) {
            // Record the title
            var subStr = line.substring(line.indexOf("title:")+6).trim();
            record.title = subStr;
        }

        if (line.indexOf("group:") >= 0) {
            // Record the group
            var subStr = line.substring(line.indexOf("group:")+6).trim();
            record.group = subStr;
        }

        if (line.indexOf("categories:") >= 0 || line.indexOf("reviews:") > 0 || state == 3/*In categories*/) {
            //Check if there are more categories to record and make sure we haven't started reading reviews
            if (line.indexOf("reviews:") >= 0) {
                state = 2;  // Back to "In record"
            } else if (line.indexOf("categories:") >= 0) {
                state = 3;  // In categories
            } else if (state == 3) {
                var subStr = line.substring(line.indexOf("|Books")).trim();
                record.categories.push(subStr);
            }
        }

        if (last) {
            ++total_count;
            if (!db_insert_record(record)) {
                ++error_count;
            }

            console.log("==============================");
            console.log("Data import completed:");
            console.log("Total: " + total_count + " product(s)");
            console.log("Error: " + error_count + " product(s)");
            console.log("==============================");

            return res.json("Data import completed.");
        }
    });
});

app.get('/sandbox', function(req, res) {

    // Print the HTTP headers
    console.log("==============================");
    console.log("Header:");
    var hd = req["headers"];
    for (var key in hd) {
        console.log(key + " : " + hd[key]);
    }
    console.log("==============================");

    return res.json(req["headers"]);
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
