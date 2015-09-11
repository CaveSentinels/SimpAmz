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


# =============================================================================

http_request_local_base = "http://localhost:3000"

# =============================================================================

def PrintRes(res) :
    print "=" * 20
    print res

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

def TestScript1() :
    PrintRes(RegisterUser(uname="yaobinw", pwd="password"))
    PrintRes(Login("yaobinw", "password"))
    PrintRes(Logout())

# =============================================================================

def Main( args ) :
    TestScript1()

# =============================================================================

if __name__ == "__main__" :
    Main( sys.argv )