import 'dotenv/config';
import app from './app.js';
import db from './db/index.js';
import { sql } from 'drizzle-orm';

//checking id DB is connected successfuly tricky because of lazy connection
db.execute(sql`SELECT 1`) //Ping to see if the coneection is even working
     .then((eve) => {
          console.log("Connection to server databse successfully!");
          const PORT = process.env.PORT || 8000;
          app.listen(PORT, () => {
               console.log(`Server running at port:${PORT}`);
               console.log("Listening for activities");
          })
     })
     .catch((e) => console.log("Problem while connecting to server"));
