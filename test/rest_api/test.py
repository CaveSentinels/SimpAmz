# =============================================================================
# @type: file
# @brief: The REST API test script for SimpAmz project.
# @course: Engineering Data Intensive Scalable Systems (EDISS)
# @author: Yaobin "Robin" Wen
# @email: yaobinw@andrew.cmu.edu


# =============================================================================

import urllib
import urllib2
import sys
import json


# =============================================================================

http_request_local_base = "http://localhost:3000"

# =============================================================================

def PrintRes(action, res) :
    print "=" * 20
    print action
    response = json.loads(res)
    print "Response:"
    print "\tMessage: " + response["message"]
    print "\tDetails: " + response["details"]
    print "\tCode:    " + response["code"]
    print "\tMore:    " + response["more"]

# =============================================================================

def RegisterUser(uname, pwd, fname="", lname="", addr="", city="", state="", zip="", email="") :
    raw_data = {
        'fName' : fname,
        'lName' : lname,
        'address' : addr,
        'city' : city,
        'state' : state,
        'zip' : zip,
        'email' : email,
        'uName' : uname,
        'pWord' : pwd
    }
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_local_base + "/registerUser", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def UnregisterUser() :
    raw_data = {
        # Empty
    }
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_local_base + "/unregisterUser", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def Login(uname, pwd) :
    raw_data = {
        'username' : uname,
        'password' : pwd
    }
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_local_base + "/login", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def Logout() :
    raw_data = {
        # Empty
    }
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_local_base + "/logout", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def Test_Registration() :
    PrintRes(RegisterUser.__name__, RegisterUser(uname="user1", pwd="password1"))
    PrintRes(RegisterUser.__name__, RegisterUser(uname="user2", pwd="password2", state="XX"))
    PrintRes(RegisterUser.__name__, RegisterUser(uname="user2", pwd="password2", state="PA", zip="1a5b3"))
    PrintRes(RegisterUser.__name__, RegisterUser(uname="user2", pwd="password2", state="PA", zip="15213", email="abc"))
    PrintRes(RegisterUser.__name__, RegisterUser(uname="user2", pwd="password2",
                                                 fname="Yaobin", lname="Wen",
                                                 addr="4750 Centre Ave.", city="Pittsburgh", state="PA", zip="12345",
                                                 email="user1@simpamz.com"))


# =============================================================================

def TestScript1() :
    PrintRes(RegisterUser.__name__, RegisterUser(uname="yaobinw", pwd="password"))
    # PrintRes(Login.__name__, Login("yaobinw", "password"))
    # PrintRes(UnregisterUser.__name__, UnregisterUser())
    # PrintRes(Logout.__name__, Logout())

# =============================================================================

def Main( args ) :
    Test_Registration()

# =============================================================================

if __name__ == "__main__" :
    Main( sys.argv )