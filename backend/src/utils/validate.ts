import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import ApiError from './ApiError';

export default function validate(req: Request, _res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, errors.array().map(e => `${e.param}: ${e.msg}`).join(', '));
  }
  next();
}
