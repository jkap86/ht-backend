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

      // For query params, we can't reassign req.query directly (it's a getter)
      // Instead, mutate the existing object or use body/params which are writable
      if (source === 'query') {
        // Clear existing keys and assign validated values
        Object.keys(req.query).forEach(key => delete req.query[key]);
        Object.assign(req.query, validated);
      } else {
        req[source] = validated;
      }

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

      console.error('Validation middleware error:', error);
      return res.status(500).json({
        error: 'Internal server error during validation',
      });
    }
  };
}
