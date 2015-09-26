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

def Main( args ) :
    Test_ViewUsers()

# =============================================================================

if __name__ == "__main__" :
    Main( sys.argv )
