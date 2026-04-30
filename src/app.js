import cookieParser from 'cookie-parser';
import express, { urlencoded } from 'express'

const app = express();
app.use(express.json());
app.use(urlencoded({ extended: true, limit: "16kb" }));
// app.use(express.static("public"));
app.use(cookieParser());

//Write the Routing logic.


export default app;