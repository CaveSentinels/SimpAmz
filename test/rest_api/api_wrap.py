import urllib
import urllib2


# =============================================================================

http_request_local_base = "http://localhost:3000"

# =============================================================================

def RegisterUser(uname, pwd, role="", fname="", lname="", addr="", city="", state="", zip="", email="") :
    raw_data = {
        'fName' : fname,
        'lName' : lname,
        'address' : addr,
        'city' : city,
        'state' : state,
        'zip' : zip,
        'email' : email,
        'uName' : uname,
        'pWord' : pwd,
        'role' : role
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

def Logout(session_id) :
    raw_data = {
        'sessionID' : session_id
    }
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_local_base + "/logout", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def UpdateContactInfo(raw_data) :
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_local_base + "/updateInfo", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def ModifyProduct(session_id, prod_id, prod_desc, prod_title) :
    raw_data = {
        'sessionID' : session_id,
        'productId' : prod_id,
        'productDescription' : prod_desc,
        'productTitle' : prod_title
    }
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_local_base + "/modifyProduct", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def ViewUsers(session_id, fName="", lName="") :
    query_str = "?sessionID=" + session_id + "&fName=" + fName +"&lName=" + lName
    req = urllib2.Request(http_request_local_base + "/viewUsers" + query_str)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def ViewProduct(id="", category="", keyword="") :
    query_str = "?productId=" + id + "&category=" + category +"&keyword=" + keyword
    req = urllib2.Request(http_request_local_base + "/getProducts" + query_str)
    res = urllib2.urlopen(req)

    return res.read()
