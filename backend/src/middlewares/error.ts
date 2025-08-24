import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError';

export const errorConverter = (err: any, _req: Request, _res: Response, next: NextFunction) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, err.stack);
  }
  next(error);
};

export const errorHandler = (err: ApiError, _req: Request, res: Response, _next: NextFunction) => {
  const { statusCode, message, stack } = err as any;
  const response: any = {
    code: statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack }),
  };
  res.status(statusCode).json(response);
};
