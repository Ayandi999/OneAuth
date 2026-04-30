import cookieParser from 'cookie-parser';
import express, { urlencoded } from 'express'
import userRouter from './user/user.routes.js';

const app = express();
app.use(express.json());
app.use(urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Temporary route for UI data logging
app.get('/health', (_, res) => res.json({ message: "All good from here" }))
app.use('/user', userRouter);


export default app;