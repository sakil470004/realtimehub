/**
 * Input Validation Schemas
 * ========================
 * 
 * Uses Zod for runtime validation of user input.
 * 
 * Why Zod?
 * --------
 * - TypeScript-first: Infers types automatically
 * - Runtime validation: Catches bad data at runtime (not just compile time)
 * - Descriptive errors: Clear messages for users
 * - Chainable API: Easy to compose complex validations
 * 
 * Usage Pattern:
 * --------------
 * 1. Define schema with rules
 * 2. Parse input data through schema
 * 3. If valid, get typed data
 * 4. If invalid, get detailed errors
 * 
 * Example:
 * --------
 * const result = signupSchema.safeParse(userInput);
 * if (!result.success) {
 *   // result.error.errors contains validation errors
 * }
 * // result.data contains validated & typed data
 */

import { z } from 'zod';

/**
 * Signup Validation Schema
 * ------------------------
 * Validates new user registration data
 * 
 * Rules:
 * - username: 3-30 characters, alphanumeric + underscores
 * - email: Valid email format
 * - password: Minimum 6 characters
 */
export const signupSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores'
    )
    .transform((val) => val.toLowerCase()),  // Convert to lowercase

  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((val) => val.toLowerCase()),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password cannot exceed 100 characters'),
});

// TypeScript type inferred from schema
// Use this type when working with validated signup data
export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Login Validation Schema
 * -----------------------
 * Validates login credentials
 * 
 * Note: We don't need strict validation here since we'll
 * check against the database anyway. Basic format check is enough.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((val) => val.toLowerCase()),

  password: z
    .string()
    .min(1, 'Password is required'),  // Just check it's not empty
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Post Creation Schema
 * --------------------
 * Validates new post content
 * 
 * Rules:
 * - Required: Cannot be empty
 * - Max 500 characters (as per requirements)
 * - Trimmed: Remove leading/trailing whitespace
 */
export const createPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Post content cannot be empty')
    .max(500, 'Post cannot exceed 500 characters')
    .transform((val) => val.trim()),  // Remove whitespace
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

/**
 * Comment Creation Schema
 * -----------------------
 * Validates comment text
 * 
 * Similar to posts but with smaller limit (300 chars)
 */
export const createCommentSchema = z.object({
  text: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(300, 'Comment cannot exceed 300 characters')
    .transform((val) => val.trim()),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/**
 * Pagination Schema
 * -----------------
 * Validates query parameters for paginated API endpoints
 * 
 * Provides defaults if not specified:
 * - page: 1 (first page)
 * - limit: 10 (10 items per page)
 * 
 * Transforms string query params to numbers (URL params are always strings)
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '1', 10);
      return isNaN(num) || num < 1 ? 1 : num;  // Default to 1, min 1
    }),

  limit: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '10', 10);
      // Clamp between 1 and 50 to prevent abuse
      if (isNaN(num) || num < 1) return 10;
      if (num > 50) return 50;
      return num;
    }),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * MongoDB ObjectId Schema
 * -----------------------
 * Validates that a string is a valid MongoDB ObjectId
 * ObjectIds are 24 character hex strings
 */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

/**
 * Helper: Format Zod Errors
 * -------------------------
 * Converts Zod's error format to a simple key-value object
 * 
 * Example:
 * formatZodErrors(error) 
 * // Returns: { username: 'Username must be at least 3 characters' }
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  
  for (const issue of error.issues) {
    // Get the field name (first path element)
    const field = issue.path[0]?.toString() || 'unknown';
    // Only keep the first error per field
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  
  return errors;
}
