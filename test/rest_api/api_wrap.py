import urllib
import urllib2


# =============================================================================

http_request_base = "http://ediss-a03-380488941.us-east-1.elb.amazonaws.com:3000"
#http_request_base = "http://localhost:3000"

# =============================================================================

def RegisterUser(uname, pwd, role="", fname="", lname="", addr="", city="", state="", zip="", email="") :
    raw_data = {
        'fname' : fname,
        'lname' : lname,
        'address' : addr,
        'city' : city,
        'state' : state,
        'zip' : zip,
        'email' : email,
        'username' : uname,
        'password' : pwd,
        'role' : role
    }
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_base + "/registerUser", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def UnregisterUser() :
    raw_data = {
        # Empty
    }
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_base + "/unregisterUser", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def Login(uname, pwd) :
    raw_data = {
        'username' : uname,
        'password' : pwd
    }
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_base + "/login", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def Logout(session_id) :
    raw_data = {
        'sessionID' : session_id
    }
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_base + "/logout", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def UpdateContactInfo(raw_data) :
    data = urllib.urlencode(raw_data)
    req = urllib2.Request(http_request_base + "/updateInfo", data)
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
    req = urllib2.Request(http_request_base + "/modifyProduct", data)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def ViewUsers(session_id, fName="", lName="") :
    query_str = "?sessionID=" + session_id + "&fname=" + fName +"&lname=" + lName
    req = urllib2.Request(http_request_base + "/viewUsers" + query_str)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def ViewProduct(id="", category="", keyword="") :
    query_str = "?productId=" + id + "&category=" + category +"&keyword=" + keyword
    req = urllib2.Request(http_request_base + "/getProducts" + query_str)
    res = urllib2.urlopen(req)

    return res.read()

# =============================================================================

def Sandbox() :
    req = urllib2.Request(http_request_base + "/sandbox")
    res = urllib2.urlopen(req)

    return res.read()
