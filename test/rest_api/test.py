# =============================================================================
# @type: file
# @brief: The REST API test script for SimpAmz project.
# @course: Engineering Data Intensive Scalable Systems (EDISS)
# @author: Yaobin "Robin" Wen
# @email: yaobinw@andrew.cmu.edu


# =============================================================================

from api_wrap import *
import sys
import json
import datetime

# =============================================================================

def PrintRes(action, res) :
    print "===================="
    print action
    response = json.loads(res)
    print "Response:"
    print "\tMessage: " + response["message"]
    print "\tDetails: " + response["details"]
    print "\tCode:    " + response["code"]
    print "\tMore:    " + response["more"]
    print "Response(raw):"
    print "\t" + res

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
    PrintRes(RegisterUser.__name__, RegisterUser(uname="yaobin", pwd="yaobin", role="Admin",
                                                 fname="Yaobin", lname="Wen",
                                                 addr="4750 Centre Ave.", city="Pittsburgh", state="PA", zip="12345",
                                                 email="yaobin@simpamz.com"))

# =============================================================================

def Test_Login() :
    PrintRes(Login.__name__, Login("user1", "password1"))
    PrintRes(Login.__name__, Login("user1", "pass"))
    PrintRes(Login.__name__, Login("user2", "password2"))
    PrintRes(Login.__name__, Login("jadmin", "admin"))

# =============================================================================

def Test_Logout() :
    PrintRes(Logout.__name__, Logout("33_1442259036241"))
    PrintRes(Logout.__name__, Logout("34_1442259036266"))
    PrintRes(Logout.__name__, Logout("32_1442259088778"))

# =============================================================================

def Test_UpdateContactInfo() :
    RegisterUser(uname="smith", pwd="smith")
    RegisterUser(uname="black", pwd="black")

    # Logged in
    if True :
        res = Login("smith", "smith")
        response = json.loads(res)
        session_id = response["sessionID"]

        raw_data = {
            "sessionID" : session_id,
            "fName" : "Yaobin",
            "lName" : "Wen",
            "address" : "4750 Centre Ave.",
            "city" : "Pittsburgh",
            "state" : "PA",
            "zip" : "15213",
            "email" : "yaobinw@andrew.cmu.edu",
            "uName" : "yaobinwen",
            "pWord" : "yaobinwen",
        }
        print UpdateContactInfo(raw_data)

        # raw_data = {
        #     "sessionID" : session_id,
        #     "fName" : "Yaobin",
        #     "lName" : "Wen",
        #     "address" : "4750 Centre Ave.",
        #     "city" : "Pittsburgh",
        #     "state" : "PA",
        #     "zip" : "15213",
        #     "email" : "yaobinw@andrew.cmu.edu",
        #     "uName" : "black",
        #     "pWord" : "black",
        # }
        # print UpdateContactInfo(raw_data)
        #
        # raw_data = {
        #     "sessionID" : session_id,
        #     "uName" : "smith",
        #     "pWord" : "smith",
        # }
        # print UpdateContactInfo(raw_data)

    # Not logged in
    if True :
        raw_data = {
            "sessionID" : "",
            "uName" : "black",
            "pWord" : "black",
        }
        print UpdateContactInfo(raw_data)

# =============================================================================

def Test_ModifyProduct() :
    # Admin
    if True :
        res = Login("jadmin", "admin")
        response = json.loads(res)
        session_id = response["sessionID"]
        print ModifyProduct(session_id, "", "", "")
        print ModifyProduct(session_id, "-1", "", "")
        print ModifyProduct(session_id, "-1", "Mac Book Pro", "MacPro")
        print ModifyProduct(session_id, "-1", "Mac Book Pro", "")
        print ModifyProduct(session_id, "-1", "Mac Book Pro", "MacPro")

# =============================================================================

def Test_ViewUsers() :
    print "Admin views users"
    if True :
        res = Login("jadmin", "admin")
        response = json.loads(res)
        session_id = response["sessionID"]
        # session_id = "1_1442416033613"
        print session_id
        print ViewUsers(session_id, "", "") # All users.
        print ViewUsers(session_id, "Cai", "")  # No users
        print ViewUsers(session_id, "Yaob", "")  # 2 users

    print "Customer views users"
    if True :
        res = Login("user2", "password2")
        response = json.loads(res)
        session_id = response["sessionID"]
        print session_id
        print ViewUsers(session_id, "", "") # All users.
        print ViewUsers(session_id, "Cai", "")  # No users
        print ViewUsers(session_id, "Yaob", "")  # No users

    print "Not logged in"
    if True :
        print ViewUsers("rubish", "", "") # All users.

# =============================================================================

def Test_ViewProducts() :
    print ViewProduct("1", "aa", "bb")  # Return ID#1
    print ViewProduct("40", "Computer", "MacPro")   # Nothing
    print ViewProduct("", "Computer", "MacPro")   # MacPro
    print ViewProduct("", "mpu", "M")   # MacPro
    print ViewProduct("", "", "")

# =============================================================================

def SmokeTest() :
    print "===================="
    print "RegisterUser: (Customer: Sarah)"
    result = RegisterUser(uname="scai",
        pwd="yunshang",
        role="Customer",
        fname="Sarah",
        lname="Cai",
        addr="",
        city="",
        state="",
        zip="",
        email=""
    )
    print result

    print "===================="
    print "Login: (as Customer)"
    response = Login(uname="scai", pwd="yunshang")
    result = json.loads(response)
    print result
    session_sarah = result["sessionID"]

    print "===================="
    print "Login: (as Admin)"
    response = Login(uname="jadmin", pwd="admin")
    result = json.loads(response)
    print result
    session_admin = result["sessionID"]

    print "===================="
    print "UpdateContactInfo: (Customer: Sarah)"
    result = UpdateContactInfo({
        'sessionID' : session_sarah,
        'address' : "4750 Centre Ave. APT 37",
        'city' : "Pittsburgh",
        'state' : "PA",
        'zip' : "15213",
        'email' : "sarah.cai@gmail.com"
    })
    print result

    print "===================="
    print "ModifyProduct: (as Customer)"
    result = ModifyProduct(session_id=session_sarah, prod_id="1", prod_desc="11111", prod_title="1111111111")
    print result

    print "===================="
    print "ModifyProduct: (as Admin)"
    result = ModifyProduct(session_id=session_admin, prod_id="1", prod_desc="11111", prod_title="1111111111")
    print result

    print "===================="
    print "ViewUsers: (as Customer)"
    result = ViewUsers(session_id=session_sarah, fName="Sarah")
    print result

    print "===================="
    print "ViewUsers: (as Admin)"
    result = ViewUsers(session_id=session_admin, fName="Sarah")
    print result

    print "===================="
    print "ViewProduct: (as anyone)"
    result = ViewProduct(id="1")
    print result

    print "===================="
    print "ViewProduct: (as anyone)"
    result = ViewProduct(id="2")
    print result

    print "===================="
    print "Logout: (Customer: Sarah)"
    result = Logout(session_sarah)
    print result

    print "===================="
    print "Logout: (Customer: Admin)"
    result = Logout(session_admin)
    print result

# =============================================================================

def Benchmark() :
    # Login
    response = Login(uname="jadmin", pwd="admin")
    result = json.loads(response)
    session_admin = result["sessionID"]

    print "===================="
    print "Benchmarking read:"
    n = 1000
    start = datetime.datetime.now()
    for i in range(0, n) :
        ViewProduct(id="1")
    end = datetime.datetime.now()
    diff = end - start
    t = diff.total_seconds()
    print "Query: " + str(n) + " queries"
    print "Total time: " + str(t) + " second(s)"
    print "Average time: " + str(n / t) + " RPS"

    print "===================="
    print "Benchmarking update:"
    n = 1000
    start = datetime.datetime.now()
    for i in range(0, n) :
        ModifyProduct(session_id=session_admin, prod_id="1", prod_desc="11111", prod_title="1111111111")
    end = datetime.datetime.now()
    diff = end - start
    t = diff.total_seconds()
    print "Update: " + str(n) + " updates"
    print "Total time: " + str(t) + " second(s)"
    print "Average time: " + str(n / t) + " RPS"

# =============================================================================

def Main( args ) :
    if args[1] == "smoke_test" :
        SmokeTest()
    elif args[1] == "benchmark" :
        Benchmark()
    else :
        print "Invalid argument: ", args[1]

# =============================================================================

if __name__ == "__main__" :
    Main( sys.argv )
