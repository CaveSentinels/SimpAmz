# SimpAmz

#### SimpAmz = SIMPlified AMaZon

---

### Code Structure

The source code folder has the standard Node.js project structure. The following items are added by me:

1. ./db/db_create.sql: The SQL script that creates the database and its tables. This script only has three pre-defined users. You need to import product data in order to use it. There are some other files in the "db" folder but you can safely ignore them.
2. ./app.js: The source code of the web service.
3. ./sample.txt: A small sample of product data (450 items) for testing purpose.


### Start Web Service

Follow the steps below to start the web service:

1. Modify the database configuration:
	1. Open the app.js with a plain text editor.
	2. Go the line #11: ```var pool = mysql.createPool({``` This section has all the DB-related settings.
	3. Change the ```connectionLimit``` to any number you want.
	4. Change the ```host``` to the DNS of the database.
	5. Change the ```user``` and ```password``` to the ones you use to connect to database.
	6. Change the ```port``` if necessary.
2. Go to the root of the source code folder where app.js resides in.
3. Type "npm start" to run the web service.


### Database Creation

Import the db_create.sql into MySQL to create the database and its tables.

### User Data Import

Follow the steps below to import the user data:

1. Start the web service and make sure it connects to the database correctly.
2. Put ```UserData5000.csv``` under the ```db``` folder. Make sure the file name is exactly "UserData5000.csv".
3. Open a browser, enter ```http://<Web service DNS>:3000/admin/load_users```. For example, if you start your web service in the local machine, then type ```http://localhost:3000/sandbox/load_users```.
4. The web service will read the user data from "UserData5000.csv" under the ```db``` folder and write them to the database. This may take a few minutes and the browser may show a not-respond error page. When the data are all loaded, a summary message will be printed in the web service's console window:

Completion message:

	==============================
    Data import completed:
    Total: 5000 user(s)
    Error: 0 user(s)
    ==============================


### Product Data Import

Follow the steps below to import the product data:

1. Start the web service and make sure it connects to the database correctly.
2. Put ```amazon-meta.txt``` under the same folder with app.js. Make sure the file name is exactly "amazon-meta.txt".
3. Open a browser, enter ```http://<Web service DNS>:3000/admin/load_data?source=amazon-meta```. For example, if you start your web service in the local machine, then type ```http://localhost:3000/sandbox/load_data?source=amazon-meta```.
4. The web service will read the product data from "amazon-meta.txt" and write them to the database. This may take a few minutes and the browser may show a not-respond error page. When the data are all loaded, a summary message will be printed in the web service's console window:

Completion message:

	==============================
    Data import completed:
    Total: 50000 product(s)
    Error: 0 product(s)
    ==============================
