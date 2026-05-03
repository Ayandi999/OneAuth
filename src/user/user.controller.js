import asyncHandler from "../utils/asyncHandler.js"
import db from '../db/index.js'
import { userRegistrationSchema, userLoginSchema } from "./validation/validation.js"
import ApiError from '../utils/ApiError.js'
import ApiResponse from '../utils/ApiResponse.js'
import { users, sessions } from "../db/schema.js"

import { eq } from "drizzle-orm"
import argon2 from "argon2"
import redisClient from "../db/redis.js"
import sendEmail from "../utils/sendEmail.js"

const userRegistrationController = asyncHandler(async (req, res) => {
     // ... (previous logic)

     // 1. Validate request body
     const { error, value } = userRegistrationSchema.validate(req.body);
     if (error) throw new ApiError(400, error.message);

     //Extracted user info
     const { email, password, firstName, lastName } = value;

     // 2. Check if this user already exists
     const [fetchedUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email));

     if (fetchedUser) {
          throw new ApiError(409, "User with this email already exists. Please sign in.");
     }


     // 3. Hash password using argon2
     const hashedPassword = await argon2.hash(password);

     // 4. Store the user's credentials onto the db
     const [createdUser] = await db.insert(users).values({
          email,
          password: hashedPassword,
          firstName,
          lastName
     }).returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
     });

     if (!createdUser) {
          throw new ApiError(500, "Internal server error while creating user");
     }

     // 5. Send success email
     await sendEmail({
          to: createdUser.email,
          subject: "Welcome to OneAuth",
          text: `Hi ${createdUser.firstName},\n\nYour account has been created successfully. Thanks for using OneAuth!`,
          html: `<h3>Welcome to OneAuth</h3><p>Hi ${createdUser.firstName},</p><p>Your account has been created successfully. Thanks for using OneAuth!</p>`
     }).catch(err => console.error("Error sending registration email:", err));

     // 6. Send proper structured API response
     const redirectUri = req.query.redirect_uri || null;
     return res.status(201).json(
          new ApiResponse(201, { ...createdUser, redirectUri }, "User registered successfully")
     );
});


const userLoginController = asyncHandler(async (req, res) => {
     // 1. Validate request body
     const { error, value } = userLoginSchema.validate(req.body);
     if (error) throw new ApiError(400, error.message);

     const { email, password } = value;

     // 2. Check if user exists
     const [user] = await db.select().from(users).where(eq(users.email, email));
     if (!user) {
          throw new ApiError(401, "Account does not exist. Please create an account first.");
     }

     // 3. Verify password using argon2
     const isPasswordValid = await argon2.verify(user.password, password);
     if (!isPasswordValid) {
          throw new ApiError(401, "Invalid email or password");
     }

     // 4. Create a new session
     const expiresAt = new Date();
     expiresAt.setDate(expiresAt.getDate() + 7); // Session expires in 7 days

     const [session] = await db.insert(sessions).values({
          userId: user.id,
          expiresAt: expiresAt
     }).returning({ id: sessions.id });

     if (!session) {
          throw new ApiError(500, "Internal server error while creating session");
     }

     // 5. Send success response with session ID in a cookie
     const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          expires: expiresAt
     };

     const redirectUri = req.query.redirect_uri || req.query.return_to || null;

     return res
          .status(200)
          .cookie("sessionId", session.id, cookieOptions)
          .json(
               new ApiResponse(200, { sessionId: session.id, redirectUri }, "User logged in successfully")
          );
});



// ---------------------------------------------------------
// Forgot Password Flow
// ---------------------------------------------------------

const forgotPasswordController = asyncHandler(async (req, res) => {
     const { email } = req.body;
     if (!email) throw new ApiError(400, "Email is required");

     // 1. Check if user exists
     const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
     if (!user) {
          throw new ApiError(404, "No account found with this email");
     }

     // 2. Generate 6-digit code
     const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

     // 3. Store in Valkey (expires in 15 mins)
     await redisClient.set(`reset:${email.toLowerCase()}`, resetCode, "EX", 900);

     // 4. Send Email
     await sendEmail({
          to: email,
          subject: "OneAuth Password Reset Code",
          text: `Your password reset code is: ${resetCode}. It will expire in 15 minutes.`,
          html: `<h3>Password Reset</h3><p>Your verification code is: <b>${resetCode}</b></p><p>Expires in 15 minutes.</p>`
     });

     return res.status(200).json(
          new ApiResponse(200, null, "Verification code sent to your email")
     );
});

const verifyResetCodeController = asyncHandler(async (req, res) => {
     const { email, code } = req.body;
     if (!email || !code) throw new ApiError(400, "Email and code are required");

     const storedCode = await redisClient.get(`reset:${email.toLowerCase()}`);

     if (!storedCode || storedCode !== code) {
          throw new ApiError(401, "Invalid or expired verification code");
     }

     return res.status(200).json(
          new ApiResponse(200, null, "Code verified successfully")
     );
});

const resetPasswordController = asyncHandler(async (req, res) => {
     const { email, code, newPassword } = req.body;
     if (!email || !code || !newPassword) throw new ApiError(400, "Missing required fields");

     // 1. Double check the code
     const storedCode = await redisClient.get(`reset:${email.toLowerCase()}`);
     if (!storedCode || storedCode !== code) {
          throw new ApiError(401, "Invalid or expired verification code");
     }

     // 2. Hash new password
     const hashedPassword = await argon2.hash(newPassword);

     // 3. Update DB
     await db.update(users)
          .set({ password: hashedPassword })
          .where(eq(users.email, email.toLowerCase()));

     // 4. Clean up Valkey
     await redisClient.del(`reset:${email.toLowerCase()}`);

     // 5. Send success email
     await sendEmail({
          to: email,
          subject: "Password Reset Successful",
          text: `Your OneAuth password has been changed successfully. If you didn't do this, please contact support immediately.`,
          html: `<h3>Password Reset Successful</h3><p>Your OneAuth password has been changed successfully.</p><p>If you didn't do this, please contact support immediately.</p>`
     }).catch(err => console.error("Error sending reset password success email:", err));

     const redirectUri = req.query.redirect_uri || null;
     return res.status(200).json(
          new ApiResponse(200, { redirectUri }, "Password has been reset successfully")
     );
});




export {
     userRegistrationController,
     userLoginController,
     forgotPasswordController,
     verifyResetCodeController,
     resetPasswordController
}
