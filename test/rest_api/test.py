# =============================================================================
# @type: file
# @brief: The REST API test script for SimpAmz project.
# @course: Engineering Data Intensive Scalable Systems (EDISS)
# @author: Yaobin "Robin" Wen
# @email: yaobinw@andrew.cmu.edu


# =============================================================================
# @type: directive
# @brief: Imports.

import urllib
import urllib2
import sys
import datetime


# =============================================================================
# @type: constants

http_request_local_base = "http://localhost:3000"


# =============================================================================
# @type: function
# @brief: The main work flow.
# @param: [in] args: The command line arguments.
# @return: N/A
# @note: arguments
#   first: How many threads will be started to send HTTP requests.
#   second: How many HTTP requests will be sent per thread.

def Main( args ) :

    # Test user registration.
    data = {
        'fName' : 'Yaobin',
        'lName' : 'Wen',
        'uName' : 'yaobinw',
        # 'pWord' : 'password'
    }
    data = urllib.urlencode(data)

    http_request_reg_user = urllib2.Request(http_request_local_base + "/registerUser", data)

    print http_request_reg_user.get_method()

    res = urllib2.urlopen( http_request_reg_user )

    print res.read()


# =============================================================================
# @type: script
# @brief: The main entry of the script.

if __name__ == "__main__" :

    print datetime.datetime.now()

    Main( sys.argv )

    print datetime.datetime.now()