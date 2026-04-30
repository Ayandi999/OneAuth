import { pgTable, varchar, uuid, timestamp, text, boolean } from "drizzle-orm/pg-core";

// 1. Users Table: Core identity
export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: text("password").notNull(), // Hashed
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow(),
});

// 2. Clients Table: Registered OAuth2 Applications
export const clients = pgTable("clients", {
    id: uuid("id").primaryKey().defaultRandom(), //Shall act as client ID
    clientName: varchar("client_name", { length: 255 }).notNull(),
    clientSecret: text("client_secret").notNull(), // Hashed
    redirectUris: text("redirect_uris").notNull(), // Comma separated or JSON
    createdAt: timestamp("created_at").defaultNow(),
});

// 3. Sessions Table: Tracks User-to-AuthServer login state (SSO)
export const sessions = pgTable("sessions", {
    id: uuid("id").primaryKey().defaultRandom(), // sessionId
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    lastActive: boolean("last_active").default(true),
});

// 4. ClientUserMap: Tracks which User has authorized which Client + Store Refresh Token
export const clientUserMap = pgTable("client_user_map", {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    revoked: boolean("revoked").default(false),
    createdAt: timestamp("created_at").defaultNow(),
});
