class ApiError extends Error {
     constructor(
          statusCode,
          message = `Something went Erong`,
          errors = [],
          stack = ""
     ) {
          super(message);
          this.data = null;
          this.message = message;
          this.statusCode = statusCode;
          this.errors = errors;
          this.stack = stack ? stack : Error.captureStackTrace(this, this.constructor);
          this.success = false;
     }
}

export default ApiError;