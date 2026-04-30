import { Router } from 'express'
import path from 'path';
import { 
     userRegistrationController, 
     userLoginController,
     forgotPasswordController,
     verifyResetCodeController,
     resetPasswordController
} from './user.controller.js'

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userRouter = Router()

//============Sign up logic======================
// GET: Serve the registration page
userRouter.get('/signup', (req, res) => {
     res.sendFile(path.join(__dirname, 'ui', 'register.html'));
});
// GET: Serve the registration CSS
userRouter.get('/auth.css', (_, res) => {
     res.sendFile(path.join(__dirname, 'ui', 'auth.css'));
});
// POST: Handle the signup data (log to console as requested)
userRouter.post('/signup', userRegistrationController);

//=================Log in Logic====================
// GET: Serve the login page
userRouter.get('/login', (_, res) => {
     res.sendFile(path.join(__dirname, 'ui', 'login.html'));
});

userRouter.get('/forgot-password', (_, res) => {
     res.sendFile(path.join(__dirname, 'ui', 'forgot-password.html'));
});


userRouter.post('/login', userLoginController);

//============Forgot Password Logic================
userRouter.post('/forgot-password', forgotPasswordController);
userRouter.post('/verify-reset-code', verifyResetCodeController);
userRouter.post('/reset-password', resetPasswordController);



export default userRouter
