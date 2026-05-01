import db from '../db/index.js'
import { clients, sessions } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import redisClient from '../db/redis.js'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const issuerController = (_, res) => {
     res.status(200).json({
          issuer: `${process.env.BASE}`,
          authorizatoin_endpoint: `${process.env.BASE}/oauth2/auth`,
          token_endpoint: `${process.env.BASE}/oauth2/token`,
          jwks_uri: `${process.env.BASE}/oauth2/keys`,
          claims_supported: [
               "email",
               "firstName",
               "lastName"
          ]
     })
}

const authController = asyncHandler(async (req, res) => {
     const { client_id, redirect_uri, scope, state, response_type } = req.info;

     // 1. Validate the client id from client table
     const [client] = await db.select().from(clients).where(eq(clients.id, client_id));
     if (!client) throw new ApiError(400, "Invalid client_id. Application not registered.");

     // 2. See if the redirect url provided is actually a url registered
     const registeredUris = client.redirectUris.split(',');
     if (!registeredUris.includes(redirect_uri)) throw new ApiError(400, "Invalid redirect_uri. Not registered for this client.");

     // 3. Check if the user has an active session in the session table
     const sessionId = req.cookies?.sessionId;
     if (!sessionId) {
          // If no session, redirect to login with the current URL as return point
          const returnTo = encodeURIComponent(req.originalUrl);
          return res.status(301).redirect(`/user/login?return_to=${returnTo}`);
     }

     const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
     if (!session || new Date(session.expiresAt) < new Date()) {
          const returnTo = encodeURIComponent(req.originalUrl);
          return res.status(301).redirect(`/user/login?return_to=${returnTo}`);
     }

     // 4. Update the session expiry 
     const newExpiry = new Date();
     newExpiry.setDate(newExpiry.getDate() + 7);
     await db.update(sessions).set({ expiresAt: newExpiry }).where(eq(sessions.id, sessionId));

     // 5. Redirect to Consent UI
     const consentUrl = `/oauth2/consent?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scope)}&state=${state || ''}&response_type=${response_type}&client_name=${encodeURIComponent(client.clientName)}`;
     return res.status(302).redirect(consentUrl);
});

const consentPageController = (req, res) => {
     res.sendFile(path.join(__dirname, 'ui', 'consent.html'));
};

const consentSubmitController = asyncHandler(async (req, res) => {
     const { client_id, redirect_uri, scope, state, response_type, decision } = req.body;

     if (decision !== 'allow') return res.redirect(`${redirect_uri}?error=access_denied&state=${state || ''}`);

     // 1. Generate Auth Code
     const authCode = crypto.randomBytes(16).toString('hex');

     // 2. Store code in Redis (expires in 5 minutes)
     // Link it to the user session
     const sessionId = req.cookies.sessionId;
     const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

     const codeData = {
          userId: session.userId,
          clientId: client_id,
          redirectUri: redirect_uri,
          scope: scope,
          responseType: response_type
     };

     //store data on redis so that the cleint can redirect it and check for it
     await redisClient.set(`auth_code:${authCode}`, JSON.stringify(codeData), 'EX', 300);

     // 3. Redirect back to client with code
     const callbackUrl = `${redirect_uri}?code=${authCode}${state ? `&state=${state}` : ''}`;
     return res.redirect(callbackUrl);
});


const tokenController = asyncHandler(async (req, res) => {
     res.status(200).json({ message: "Token endpoint reached" });
});

const userinfoController = asyncHandler(async (req, res) => {
     res.status(200).json({ message: "Userinfo endpoint reached" });
});


const keysController = asyncHandler(async (req, res) => {
     res.status(200).json({ keys: [] });
});

export {
     issuerController,
     authController,
     userinfoController,
     tokenController,
     keysController,
     consentPageController,
     consentSubmitController
}
