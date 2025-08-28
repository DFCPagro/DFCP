import { validationResult, FieldValidationError } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import ApiError from './ApiError';

export default function validate(req: Request, _res: Response, next: NextFunction) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    // keep only field errors; these have `.path`
    const fieldErrors = result.array().filter(
      (e): e is FieldValidationError => e.type === 'field'
    );

    const msg =
      fieldErrors.map(e => `${e.path}: ${e.msg}`).join(', ')
      || result.array().map(e => `${e.type}: ${e.msg}`).join(', '); // fallback for non-field errors

    throw new ApiError(400, msg || 'Validation failed');
  }

  next();
}
