import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation middleware factory that validates request data against a Zod schema
 * @param schema - Zod schema to validate against
 * @param source - Which part of the request to validate ('body', 'query', 'params')
 */
export function validateRequest(
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validated = await schema.parseAsync(data);

      // Replace the request data with validated data
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }

      return res.status(500).json({
        error: 'Internal server error during validation',
      });
    }
  };
}
