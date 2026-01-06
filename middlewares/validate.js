

import MESSAGES from '../constants/messages.js';

const handleValidationError = (req, res, redirectPath, errors) => {
  try {
    return res.status(400).render(redirectPath, {
      errors,
      old: req.body || {},
      error: MESSAGES.VALIDATION.FIX_ERRORS,
      message: null
    });
  } catch (renderError) {
    console.error('Render error in validation middleware:', renderError);
    return res.status(500).json({
      success: false,
      message: MESSAGES.VALIDATION.SERVER_ERROR,
      errors: errors || { general: MESSAGES.VALIDATION.UNKNOWN_ERROR }
    });
  }
};

const validate = (schema, redirectPath) => {
  return (req, res, next) => {
    try {
      if (!schema || typeof schema.safeParse !== 'function') {
        return handleValidationError(
          req,
          res,
          redirectPath,
          { general: MESSAGES.VALIDATION.INVALID_SCHEMA }
        );
      }

      const validationResult = schema.safeParse(req.body);

      if (!validationResult.success) {
        const errors = {};

        if (Array.isArray(validationResult.error?.issues)) {
          validationResult.error.issues.forEach(err => {
            const field = err.path[0];
            if (field) {
              errors[field] = err.message;
            }
          });
        }

    
        if (Object.keys(errors).length === 0) {
          errors.general = MESSAGES.VALIDATION.INVALID_INPUT;
        }

        return handleValidationError(req, res, redirectPath, errors);
      }


      next();
    } catch (error) {
      console.error('Unexpected error in validation middleware:', error);
      return handleValidationError(
        req,
        res,
        redirectPath,
        { general: MESSAGES.VALIDATION.VALIDATION_FAILED }
      );
    }
  };
};

export default validate;