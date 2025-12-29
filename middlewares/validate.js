const MESSAGES = require('../constants/messages');

const handleValidationError = (req, res, redirectPath, errors) => {
  try {
    return res.status(400).render(redirectPath, {
      errors,
      old: req.body || {},
      error: MESSAGES.VALIDATION.FIX_ERRORS,
      message: null
    });
  } catch (renderError) {
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
            errors[err.path[0]] = err.message;
          });
        } else {
          errors.general = MESSAGES.VALIDATION.INVALID_INPUT;
        }

        return handleValidationError(req, res, redirectPath, errors);
      }

      next();
    } catch (error) {
      return handleValidationError(
        req,
        res,
        redirectPath,
        { general: MESSAGES.VALIDATION.VALIDATION_FAILED }
      );
    }
  };
};

module.exports = validate;
