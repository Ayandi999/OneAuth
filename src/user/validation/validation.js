import Joi from 'joi';

/**
 * Validation schema for user registration
 */
export const userRegistrationSchema = Joi.object({
    firstName: Joi.string()
        .trim()
        .max(50)
        .required()
        .messages({
            'string.empty': 'First name is required',
            'string.max': 'First name cannot exceed 50 characters',
            'any.required': 'First name is required'
        }),

    lastName: Joi.string()
        .trim()
        .max(50)
        .required()
        .messages({
            'string.empty': 'Last name is required',
            'string.max': 'Last name cannot exceed 50 characters',
            'any.required': 'Last name is required'
        }),

    email: Joi.string()
        .trim()
        .email({ tlds: { allow: false } })
        .max(255)
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.max': 'Email cannot exceed 255 characters',
            'string.empty': 'Email is required',
            'any.required': 'Email is required'
        }),

    password: Joi.string()
        .min(6)
        .max(128)
        .required()
        .messages({
            'string.min': 'Password must be at least 6 characters long',
            'string.max': 'Password cannot exceed 128 characters',
            'string.empty': 'Password is required',
            'any.required': 'Password is required'
        })
});


//==============Login validation======================
export const userLoginSchema = Joi.object({
    email: Joi.string()
        .trim()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required',
            'any.required': 'Email is required'
        }),

    password: Joi.string()
        .required()
        .messages({
            'string.empty': 'Password is required',
            'any.required': 'Password is required'
        })
});
