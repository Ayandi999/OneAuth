import joi from 'joi'

const authQuerySchema = joi.object({
     client_id: joi.string().required().messages({
          'any.required': 'client_id is required'
     }),
     redirect_uri: joi.string().uri().required().messages({
          'any.required': 'redirect_uri is required',
          'string.uri': 'redirect_uri must be a valid URI'
     }),
     scope: joi.string().required().messages({
          'any.required': 'scope is required'
     }),
     response_type: joi.string().valid('code').required().messages({
          'any.required': 'response_type is required',
          'any.only': 'Only response_type=code is supported'
     }),
     state: joi.string().optional()
});

const tokenRequestSchema = joi.object({
     grant_type: joi.string().valid('authorization_code', 'refresh_token').required(),
     code: joi.string().when('grant_type', { is: 'authorization_code', then: joi.required(), otherwise: joi.optional() }),
     access_token: joi.string().when('grant_type', { is: 'refresh_token', then: joi.required(), otherwise: joi.optional() }),
     refresh_token: joi.string().when('grant_type', { is: 'refresh_token', then: joi.required(), otherwise: joi.optional() }),
     secret: joi.string().optional(),
     client_secret: joi.string().optional(),
     clientID: joi.string().uuid().optional(),
     client_id: joi.string().uuid().optional(),
     redirectURI: joi.string().uri().optional(),
     redirect_uri: joi.string().uri().optional()
}).or('secret', 'client_secret').or('clientID', 'client_id');

export {
     authQuerySchema,
     tokenRequestSchema
}
