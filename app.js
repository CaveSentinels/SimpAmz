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
    return {
        sid : user_id + "_" + curr_date_time_value,     // session ID
        uid : user_id,         // user ID
        role : user_role,      // user's role
        last_login : curr_date_time_value   // The time the user last logged in
    };
}

function session_save(session_info) {
    for (var index = 0; index < g_sessions.length; index++) {
        if (_NU(g_sessions[index])) {
            g_sessions[index] = session_info;
            return;
        }
    }

    g_sessions.push(session_info);
}

function session_find(sessionID) {
    var index;
    for (index = 0; index < g_sessions.length; index++) {
        var s = g_sessions[index];
        if (!_NU(s) && s.sid == sessionID) {
            return s;    // The session is found.
        }
    }
    return null;   // The session is not found.
}

function session_in(sessionID) {
    var index;
    for (index = 0; index < g_sessions.length; index++) {
        var s = g_sessions[index];
        if (!_NU(s) && s.sid == sessionID) {
            return true;    // The session is found.
        }
    }
    return false;   // The session is not found.
}

function session_expired(sessionID) {
    var index;
    for (index = 0; index < g_sessions.length; index++) {
        var s = g_sessions[index];
        if (!_NU(s) && s.sid == sessionID) {
            var curr_date_time_value = new Date().valueOf();
            var ms_diff = curr_date_time_value - s.last_login;
            return (ms_diff > SESSION_TIMEOUT);
        }
    }

    return true;
}

function session_update_login_time(sessionID) {
    var index;
    for (index = 0; index < g_sessions.length; index++) {
        var s = g_sessions[index];
        if (!_NU(s) && s.sid == sessionID) {
            s.last_login = new Date().valueOf();
        }
    }
}

function session_delete(sessionID) {
    var index;
    for (index = 0; index < g_sessions.length; index++) {
        var s = g_sessions[index];
        if (!_NU(s) && s.sid == sessionID) {
            delete g_sessions[index];
            return true;    // Deleted.
        }
    }
    return false;   // The session is not found.
}

function session_print() {
    var index;
    for (index = 0; index < g_sessions.length; index++) {
        var s = g_sessions[index];
        if (!_NU(s)) {
            console.log("Session { \n" + "\tSID: " + s.sid + "\n" + "\tUID: " + s.uid + "\n" + "\tRole: " + s.role + "\n}\n");
        }
    }
}

function user_authenticated(sessionID) {
    var sid = emptize(sessionID);

    if (!session_in(sid)) {
        // Session is not found so the user is not authenticated.
        return false;
    }

    if (session_expired(sid)) {
        // If the session has expired, delete it.
        session_delete(sid);
        return false;
    }

    // If the session can be found and has not expired, update the last
    // login time and return true.
    session_update_login_time(sid);
    return true;
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

    // Validate parameter: Role is a secret parameter. If it is correctly
    // assigned a value, then we use the value to assign the role.
    // Otherwise we treat it as "Customer".
    if ((!role) || (role != USER_ROLE_ADMIN && role != USER_ROLE_CUSTOMER)) {
        role = USER_ROLE_CUSTOMER;
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
                _Q(uname) + ", " + _Q(pwd) + ", " + _Q(role) + ")";
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
// NOTE: The "unregisterUser" has not been tested.

app.post('/unregisterUser', function(req, res) {
    var success_msg_base = "Your account has been unregistered.";
    var failure_msg_base = "Account unregistration failed: ";

    // The user must be authenticated in order to unregister the account.
    var sessionID = emptize(req.body.sessionID);
    if (!user_authenticated(sessionID)) {
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
            ret["err_message"] = failure_msg_base;
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
                ret["err_message"] = failure_msg_base;
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
                ret["err_message"] = failure_msg_base;
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
                ret["err_message"] = failure_msg_base;
                ret["menu"] = [];
                ret["sessionID"] = "";
                return res.json(ret);
            }

            if (rows.length == 1) {
                // User authentication succeeded. Create a session for him/her.
                var session_info = session_create(rows[0].ID, rows[0].Role);
                session_save(session_info);
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
            ret["err_message"] = failure_msg_base;
            ret["menu"] = [];
            ret["sessionID"] = "";
            return res.json(ret);
        }); // Func_03
    }); // Func_01
});

// ============================================================================
// Logout

app.post('/logout', function(req, res) {

    var success_msg_base = "You have been logged out";
    var failure_msg_base = "You are not currently logged in";

    var sessionID = emptize(req.body.sessionID);

    if (session_in(sessionID)) {
        // If the user has logged in before, we then log him/her out.
        session_delete(sessionID);
        return res.json(ret_value(
            success_msg_base,
            null, null, null
        ));
    } else {
        // If the user has not logged in before, we tell him/her.
        return res.json(ret_value(
            failure_msg_base,
            null, null, null
        ));
    }
});

// ============================================================================
// Update Contact Information

function db_update_user(conn, user_info, res) {
    var failure_msg_base = "There was a problem with this action";
    var success_msg_base = "Your information has been updated";

    var assignments =
        sql_set_field_value(conn, "Name", user_info.uname, ",") +
        sql_set_field_value(conn, "Password", user_info.pwd, "")
        ;

    if (assignments != "") {
        // Only update the User table when there is something to update.
        var sql_stmt = "UPDATE `User` SET "+ assignments +
            " WHERE `ID`=" + conn.escape(user_info.id);
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
    var failure_msg_base = "There was a problem with this action";
    var success_msg_base = "Your information has been updated";

    // Authenticate the user
    var sessionID = emptize(req.body.sessionID);
    if (!user_authenticated(sessionID)) {
        return res.json(ret_value(
            failure_msg_base,
            "Not authenticated.",
            "E_POST_UPDATE_INFO_01",
            null
        ));
    }

    var session_info = session_find(sessionID);

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
            var sql_stmt = "UPDATE `UserContact` SET "+ assignments +
                " WHERE `UserID`=" + conn.escape(user_info.id);
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
                    return db_update_user(conn, user_info, res);
                }
            }); // func_02
        } else {
            // If there is nothing to update to the UserContact table,
            // then only update the User table.
            return db_update_user(conn, user_info, res);
        }
    }); // func_01
});

// ============================================================================
// Modify Products

app.post('/modifyProduct', function(req, res) {
    var success_msg_base = "The product information has been updated";
    var failure_msg_base = "There was a problem with this action";

    // Authenticate the user
    var sessionID = emptize(req.body.sessionID);
    if (!user_authenticated(sessionID)) {
        return res.json(ret_value(
            failure_msg_base,
            ERR_MSG_AUTH_FAILURE + "User must log in to modify the product information.",
            "E_POST_MODIFY_PROD_01", null
        ));
    }

    // Check if the user is an admin.
    var session_info = session_find(emptize(sessionID));
    if (session_info.role != USER_ROLE_ADMIN) {
        return res.json(ret_value(
            failure_msg_base,
            ERR_MSG_AUTH_FAILURE + "Only admin can modify product information.",
            "E_POST_MODIFY_PROD_02", null
        ));
    }

    var prod_info = {
        id : req.body.productId,
        description : req.body.productDescription,
        title : req.body.productTitle
    };

    // ID must be provided.
    if (_NUE(prod_info.id)) {
        return res.json(ret_value(
            failure_msg_base,
            ERR_MSG_PARAM + "productId must not be empty.",
            "E_POST_MODIFY_PROD_05", null
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

        // Only update when there is something to update.
        if (_NU(prod_info.description) && _NU(prod_info.title)) {
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
            return res.json(ret_value(
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
    var sessionID = emptize(req.query.sessionID);
    if (!user_authenticated(sessionID)) {
        return res.json(ret_value(
            failure_msg_base,
            ERR_MSG_AUTH_FAILURE + "User must log in to view the users' information.",
            "E_GET_VIEW_USER_01", null
        ));
    }

    // Check if the user is an admin.
    var session_info = session_find(emptize(req.query.sessionID));
    if (session_info.role != USER_ROLE_ADMIN) {
        return res.json(ret_value(
            failure_msg_base,
            ERR_MSG_AUTH_FAILURE + "Only admin can view users' information.",
            "E_GET_VIEW_USER_02", null
        ));
    }

    var fname = emptize(req.query.fname);
    var lname = emptize(req.query.lname);

    // Find the user information from the database.
    pool.getConnection(function(err, conn) {    // func_01
        if (err) {
            return res.json(ret_value(
                failure_msg_base,
                ERR_MSG_DB_CONN_ERR + err,
                "E_GET_VIEW_USER_03", null
            ));    // Return
        }

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

        var sql_stmt = "SELECT User.ID, User.Name " +
            "FROM User INNER JOIN UserContact ON User.ID = UserContact.UserID " +
            "WHERE UserContact.FName LIKE '%" + fname + "%' AND UserContact.LName LIKE '%" + lname + "%'";
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
            res.json({
                user_list : rows
            });
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
            return res.json(ret_value(
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
                return res.json(ret_value(
                    failure_msg_base,
                    ERR_MSG_DB_SELECT_ERR + err,
                    "E_GET_VIEW_PROD_02",
                    sql_stmt
                ));    // Return
            }

            // Product information has been selected.
            res.json({
                product_list : rows
            });
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
