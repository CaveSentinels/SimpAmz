import json

raw_data_user_registration = {
    'fname' : "Mickey",
    'lname' : "Mouse",
    'address' : "123 Main Street",
    'city' : "Orlando",
    'state' : "FI",
    'zip' : 15111,
    'email' : "mickey@mouse.com",
    'username' : "mmouse",
    'password' : "mouse"
}

print "=" * 50
print "JSON data: User Registration"
print json.dumps(raw_data_user_registration)
