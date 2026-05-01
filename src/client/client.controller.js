import asyncHandler from "../utils/asyncHandler.js"
import db from '../db/index.js'
import ApiError from '../utils/ApiError.js'
import ApiResponse from '../utils/ApiResponse.js'
import { clientRegistrationSchema } from "./validation/client.validation.js"
import { clients } from "../db/schema.js"
import argon2 from "argon2"

const registerClientController = asyncHandler(async (req, res) => {
    // 1. Validate request body with Joi
    const { error, value } = clientRegistrationSchema.validate(req.body);
    if (error) {
        throw new ApiError(400, error.message);
    }

    const { clientName, clientSecret, redirectUris } = value;

    const hashedSecret = await argon2.hash(clientSecret);

    const [newClient] = await db.insert(clients).values({
        clientName,
        clientSecret: hashedSecret,
        redirectUris: redirectUris.join(',')
    }).returning({
        id: clients.id,
        clientName: clients.clientName,
        redirectUris: clients.redirectUris,
        createdAt: clients.createdAt
    });

    if (!newClient) {
        throw new ApiError(500, "Internal server error while registering client");
    }

    return res.status(201).json(
        new ApiResponse(201, { clientId: newClient.id }, "Client registered successfully")
    );
});

export {
    registerClientController
}
