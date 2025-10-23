const handleValidationError = (req, res, redirectPath, errors) => {
  try {
    console.log(`Rendering ${redirectPath} with errors:`, errors);
    return res.status(400).render(redirectPath, {
      errors,
      old: req.body || {},
      error: 'Please fix the validation errors below',
      message: null
    });
  } catch (renderError) {
    console.error(`Error rendering ${redirectPath}:`, renderError);
    return res.status(500).json({
      success: false,
      message: 'Server error during validation',
      errors: errors || { general: 'Unknown server error' }
    });
  }
};

const validate = (schema, redirectPath) => {
  return (req, res, next) => {
    try {
      // Log for debugging
      console.log('Validation Middleware - Request body:', req.body);
      console.log('Validation Middleware - Schema:', schema);
      console.log('Validation Middleware - Redirect path:', redirectPath);

      // Ensure schema is valid and supports Zod
      if (!schema || typeof schema.safeParse !== 'function') {
        console.error('Invalid or missing Zod schema');
        return handleValidationError(req, res, redirectPath, { general: 'Invalid validation schema' });
      }

      // Perform Zod validation
      const validationResult = schema.safeParse(req.body);

      if (!validationResult.success) {
        const errors = {};
        // Safely handle validation errors
        if (validationResult.error?.issues && Array.isArray(validationResult.error.issues)) {
          validationResult.error.issues.forEach((err) => {
            errors[err.path[0]] = err.message;
          });
        } else {
          console.error('Unexpected Zod error structure:', validationResult.error);
          errors.general = 'Invalid input data';
        }

        console.log('Zod validation errors:', errors);
        return handleValidationError(req, res, redirectPath, errors);
      }

      next();
    } catch (error) {
      console.error('Validation Middleware Error:', error);
      return handleValidationError(req, res, redirectPath, { general: 'Validation error occurred' });
    }
  };
};

module.exports = validate;