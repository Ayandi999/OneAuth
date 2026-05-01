# OneAuth Integration Guide

Welcome to the OneAuth integration guide! This document explains how you can integrate OneAuth into your applications to provide secure, standard-compliant authentication (OAuth 2.0 / OpenID Connect) for your users.

## 1. Register Your Client
Before you begin, you must register your application with OneAuth to obtain a `client_id` and `client_secret`. 
- Make sure to provide a valid **Redirect URI** during registration. This is where OneAuth will send your users after they successfully log in.

## 2. The Authorization Flow (Authorization Code Grant)

The primary way to authenticate users is through the Authorization Code Flow. 

### Step 1: Redirect User to OneAuth
When a user clicks "Log in with OneAuth", redirect them to our authorization endpoint:

**Endpoint:** `GET /oauth2/auth`

**Query Parameters Required:**
- `client_id`: Your registered Client ID.
- `redirect_uri`: The exact Redirect URI you registered.
- `response_type`: Must be set to `code`.
- `scope`: A space-separated list of permissions (e.g., `profile email`).
- `state`: (Optional but highly recommended) A random string to prevent CSRF attacks.

**Example Request:**
```text
http://localhost:8080/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/callback&response_type=code&scope=profile%20email&state=xyz123
```

### Step 2: Handle the Callback
Once the user logs in and grants permission, OneAuth will redirect them back to your `redirect_uri` with an authorization `code` attached to the URL.

**Example Callback:**
```text
http://localhost:3000/callback?code=CODE_YOU_RECEIVED_IN_STEP_2&state=xyz123
```
*Note: If the user denies consent, you will receive `?error=access_denied` instead.*

### Step 3: Exchange Code for Tokens
Immediately extract the `code` from the URL and make a backend server-to-server request to exchange it for access and refresh tokens.

**Endpoint:** `POST /oauth2/token`

**JSON Body:**
```json
{
  "grant_type": "authorization_code",
  "code": "CODE_YOU_RECEIVED_IN_STEP_2",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "redirect_uri": "http://localhost:3000/callback"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Tokens generated successfully",
  "data": {
    "access_token": "eyJhbGciOiJSU...",
    "refresh_token": "eyJhbGciOiJSU...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```

## 3. Retrieving User Information

Once you have the `access_token`, you can fetch the authenticated user's profile details based on the scopes they granted.

**Endpoint:** `GET /oauth2/userinfo`

**How to authenticate:**
You must pass your client credentials along with the access token. You can pass the access token in the query, body, or as a Bearer token in the `Authorization` header.

**Query / Body Parameters:**
- `client_id`: Your Client ID
- `client_secret`: Your Client Secret
- `access_token`: The user's valid access token (or use `Authorization: Bearer <token>` header)

**Success Response:**
```json
{
  "success": true,
  "data": {
    "userId": "12345",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

## 4. Refreshing Expired Tokens

Access tokens expire after 1 hour. When this happens, use the `refresh_token` (which lasts 30 days) to silently obtain a new access token without asking the user to log in again.

**Endpoint:** `POST /oauth2/token`

**JSON Body:**
```json
{
  "grant_type": "refresh_token",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "access_token": "EXPIRED_ACCESS_TOKEN",
  "refresh_token": "VALID_REFRESH_TOKEN"
}
```
*Note: We employ **Refresh Token Rotation**. When you refresh a token, you will receive a brand new `access_token` AND a brand new `refresh_token`. The old refresh token will be invalidated.*

## 5. Cryptographic Key Verification

If your application prefers to locally verify the signatures of the JWTs instead of calling the `/userinfo` endpoint, you can fetch our public key.

**Endpoint:** `GET /oauth2/keys`

**Success Response:**
```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBI...\n-----END PUBLIC KEY-----"
}
```
You can use this public key with standard JWT libraries (algorithm: `RS256`) to locally verify the token's authenticity without needing an extra network request to OneAuth.

## 6. OIDC Discovery Document

To retrieve metadata about OneAuth's OpenID Connect routes (such as the authorization, token, and userinfo endpoints), make a `GET` request to our discovery endpoint:

**Endpoint:** `GET /oauth2/.well-known/openid-configuration`

## Edge Cases to Handle
- **Invalid Grant / Expired Code:** Authorization codes expire in 5 minutes and can only be used once. If your token exchange fails, redirect the user to log in again.
- **Revoked Refresh Tokens:** If a user logs out globally or a refresh token is stolen and rotated maliciously, the refresh attempt will fail with a `403`. Your app should force the user to re-authenticate.
- **State Mismatch:** Always verify that the `state` parameter returned in the callback exactly matches the `state` you generated in Step 1 to prevent Cross-Site Request Forgery (CSRF).
