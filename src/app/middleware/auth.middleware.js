import { authQuerySchema } from "../validation/validate.js";
import ApiError from "../../utils/ApiError.js";

const authMiddleware = (req, res, next) => {
     // Validate the query parameters
     const { error, value } = authQuerySchema.validate(req.query);

     if (error) throw new ApiError(400, error.message);

     // If valid, attach the cleaned values back to req.query (or req.authParams)
     req.info = value;
     next();
}

export {
     authMiddleware
}
