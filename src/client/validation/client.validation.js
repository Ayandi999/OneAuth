import Joi from 'joi';

/**
 * Validation schema for OAuth2 Client registration
 */
export const clientRegistrationSchema = Joi.object({
    clientName: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.empty': 'Organization name is required',
            'string.min': 'Organization name must be at least 2 characters',
            'string.max': 'Organization name cannot exceed 100 characters',
            'any.required': 'Organization name is required'
        }),

    clientSecret: Joi.string()
        .min(8)
        .max(128)
        .required()
        .messages({
            'string.empty': 'Client secret is required',
            'string.min': 'Client secret must be at least 8 characters long',
            'string.max': 'Client secret cannot exceed 128 characters',
            'any.required': 'Client secret is required'
        }),

    redirectUris: Joi.array()
        .items(Joi.string().uri().required())
        .min(1)
        .max(4)
        .required()
        .messages({
            'array.min': 'At least one redirect URI is required',
            'array.max': 'Maximum 4 redirect URIs allowed',
            'string.uri': 'Each redirect URI must be a valid URL',
            'any.required': 'Redirect URIs are required'
        })
});
