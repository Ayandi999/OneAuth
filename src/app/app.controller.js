import fs from 'fs'
import argon2 from 'argon2'
import db from '../db/index.js'
import { clients, sessions, users, clientUserMap } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import redisClient from '../db/redis.js'
import accessClient from '../db/access.js'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import { tokenRequestSchema, userInfoRequestSchema } from './validation/validate.js'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

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


//Client will hit this to get the tokens gneerated
const tokenController = asyncHandler(async (req, res) => {
     //Client is going to send me Code I gave,secret,clientID,redirectURI,grant_type='authorization_code'
     const { error, value } = tokenRequestSchema.validate(req.body);
     if (error) throw new ApiError(400, error.message);

     const { code, grant_type, secret = value.client_secret, clientID = value.client_id, redirectURI = value.redirect_uri } = value;

     switch (grant_type) {
          case 'authorization_code':{
               //Use the code to retrieve the values from redis and delete the redis entry immediatelty
               const redisDataStr = await redisClient.get(`auth_code:${code}`);
               if (!redisDataStr) {
                    throw new ApiError(400, "Invalid or expired authorization code");
               }
               await redisClient.del(`auth_code:${code}`);

               const codeData = JSON.parse(redisDataStr);

               //match the redirect URIs as well new and old must match if not error redirect to new redirect URI
               if (codeData.redirectUri !== redirectURI || codeData.clientId !== clientID) {
                    return res.redirect(`${redirectURI}?error=invalid_grant`);
               }

               //Pull the client out from DB using his ID he provides
               const [client] = await db.select().from(clients).where(eq(clients.id, clientID));

               //If client dont exist throw error
               if (!client) {
                    throw new ApiError(400, "Client not found");
               }

               //else Match my known secret to clients provided secret using argon 2
               const isSecretValid = await argon2.verify(client.clientSecret, secret);
               if (!isSecretValid) {
                    throw new ApiError(401, "Invalid client secret");
               }

               //now fom redis use the scope to find out the info the client wants and extract those infor making a DB call to user table use userID to match
               const [user] = await db.select().from(users).where(eq(users.id, codeData.userId));
               if (!user) {
                    throw new ApiError(404, "User not found");
               }

               //use private key to encrypt and sign the tokens from cert folder
               const privateKeyPath = path.join(process.cwd(), 'cert', 'private-key.pem');
               const privateKeyStr = fs.readFileSync(privateKeyPath, 'utf8');

               const scopes = codeData.scope ? codeData.scope.split(' ') : [];
               const payload = {
                    clientId: clientID,
                    userId: user.id,
                    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
                    iat: Math.floor(Date.now() / 1000)
               };

               if (scopes.includes('email')) payload.email = user.email;
               if (scopes.includes('profile')) {
                    payload.firstName = user.firstName;
                    payload.lastName = user.lastName;
               }

               const accessToken = jwt.sign(payload, privateKeyStr, { algorithm: 'RS256' });

               //generate refresh token[containing only the clientId and userID]
               const refreshPayload = {
                    clientId: clientID,
                    userId: user.id,
                    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
                    iat: Math.floor(Date.now() / 1000)
               };

               const refreshToken = jwt.sign(refreshPayload, privateKeyStr, { algorithm: 'RS256' });

               //store the created refresh token in the mapper table with the clientID and userID
               const expiresAt = new Date();
               expiresAt.setDate(expiresAt.getDate() + 30);

               await db.insert(clientUserMap).values({
                    clientId: clientID,
                    userId: user.id,
                    refreshToken: refreshToken,
                    refreshTokenExpiresAt: expiresAt,
                    revoked: false
               });


               //send response as cokkie with access and refresh also send them inside the json response in the ApiResponse with code 200
               return res.status(200).json({
                    success: true,
                    message: "Tokens generated successfully",
                    data: {
                         access_token: accessToken,
                         refresh_token: refreshToken,
                         token_type: "Bearer",
                         expires_in: 3600
                    }
               });
          }
          case 'refresh_token': {
               //extract access and refresh token from req.body
               const access_token = value.access_token;
               const refresh_token = value.refresh_token;

               // either is missing error
               if (!access_token || !refresh_token) {
                    throw new ApiError(400, "Both access_token and refresh_token are required");
               }

               // verify client
               const [client] = await db.select().from(clients).where(eq(clients.id, clientID));
               if (!client) throw new ApiError(400, "Client not found");

               const isSecretValid = await argon2.verify(client.clientSecret, secret);
               if (!isSecretValid) throw new ApiError(401, "Invalid client secret");

               //unlock the refresh token
               const privateKeyPath = path.join(process.cwd(), 'cert', 'private-key.pem');
               const privateKeyStr = fs.readFileSync(privateKeyPath, 'utf8');

               let decodedRefresh;
               try {
                    decodedRefresh = jwt.verify(refresh_token, privateKeyStr, { algorithms: ['RS256'] });
               } catch (err) {
                    throw new ApiError(401, "Invalid or expired refresh token");
               }

               if (decodedRefresh.clientId !== clientID) {
                    throw new ApiError(403, "Token mismatch or unauthorized client");
               }

               // decode old access token
               const decodedAccess = jwt.decode(access_token);
               if (!decodedAccess || decodedAccess.userId !== decodedRefresh.userId) {
                    throw new ApiError(400, "Invalid access token provided or mismatch with refresh token");
               }

               // check in DB
               const [dbTokenMap] = await db.select().from(clientUserMap).where(
                    and(
                         eq(clientUserMap.clientId, clientID),
                         eq(clientUserMap.userId, decodedRefresh.userId),
                         eq(clientUserMap.refreshToken, refresh_token)
                    )
               );

               if (!dbTokenMap || dbTokenMap.revoked) {
                    throw new ApiError(403, "Refresh token revoked or not found");
               }

               //renew the refresh token update it in the DB 
               const newRefreshPayload = {
                    clientId: clientID,
                    userId: decodedRefresh.userId,
                    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
                    iat: Math.floor(Date.now() / 1000)
               };
               const newRefreshToken = jwt.sign(newRefreshPayload, privateKeyStr, { algorithm: 'RS256' });

               const newExpiresAt = new Date();
               newExpiresAt.setDate(newExpiresAt.getDate() + 30);

               await db.update(clientUserMap)
                    .set({
                         refreshToken: newRefreshToken,
                         refreshTokenExpiresAt: newExpiresAt
                    })
                    .where(eq(clientUserMap.id, dbTokenMap.id));

               //make access token using the same data as in the previous access token
               const newPayload = { ...decodedAccess };
               delete newPayload.exp;
               delete newPayload.iat;
               newPayload.exp = Math.floor(Date.now() / 1000) + (60 * 60);
               newPayload.iat = Math.floor(Date.now() / 1000);

               const newAccessToken = jwt.sign(newPayload, privateKeyStr, { algorithm: 'RS256' });

               //send it back
               res.cookie('access_token', newAccessToken, { httpOnly: true, secure: true, sameSite: 'strict' });
               res.cookie('refresh_token', newRefreshToken, { httpOnly: true, secure: true, sameSite: 'strict' });

               return res.status(200).json({
                    success: true,
                    message: "Tokens refreshed successfully",
                    data: {
                         access_token: newAccessToken,
                         refresh_token: newRefreshToken,
                         token_type: "Bearer",
                         expires_in: 3600
                    }
               });
          }
          default:
               throw new ApiError(400, "Unsupported grant type");
     }
});

const userinfoController = asyncHandler(async (req, res) => {
     let access_token = req.query.access_token || req.body?.access_token;
     if (!access_token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
          access_token = req.headers.authorization.split(' ')[1];
     }

     const payloadToValidate = {
          client_id: req.query.client_id || req.body?.client_id,
          client_secret: req.query.client_secret || req.body?.client_secret,
          access_token
     };

     const { error, value } = userInfoRequestSchema.validate(payloadToValidate);
     if (error) throw new ApiError(400, error.message);

     const { client_id, client_secret, access_token: token } = value;

     // Verify Client
     const [client] = await db.select().from(clients).where(eq(clients.id, client_id));
     if (!client) throw new ApiError(400, "Client not found");

     const isSecretValid = await argon2.verify(client.clientSecret, client_secret);
     if (!isSecretValid) throw new ApiError(401, "Invalid client secret");

     // Verify Token
     const privateKeyPath = path.join(process.cwd(), 'cert', 'private-key.pem');
     const privateKeyStr = fs.readFileSync(privateKeyPath, 'utf8');

     let decoded;
     try {
          decoded = jwt.verify(token, privateKeyStr, { algorithms: ['RS256'] });
     } catch (err) {
          throw new ApiError(401, "Invalid or expired access token");
     }

     if (decoded.clientId !== client_id) {
          throw new ApiError(403, "Access token does not belong to this client");
     }

     // Return the payload information
     const { iat, exp, clientId, ...info } = decoded;
     res.status(200).json({ success: true, data: info });
});


const keysController = asyncHandler(async (req, res) => {
     const publicKeyPath = path.join(process.cwd(), 'cert', 'public-key.pub');
     const publicKeyStr = fs.readFileSync(publicKeyPath, 'utf8');
     res.status(200).json({ publicKey: publicKeyStr });
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
