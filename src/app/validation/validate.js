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

export {
     authQuerySchema
}
