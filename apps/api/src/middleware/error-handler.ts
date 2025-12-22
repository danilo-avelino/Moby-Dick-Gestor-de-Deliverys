import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from 'database';
import type { ApiResponse, ApiError } from 'types';

export function errorHandler(
    error: FastifyError,
    request: FastifyRequest, // Changed _request to request to use request.log
    reply: FastifyReply
) {
    const response: ApiResponse = {
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        },
    };

    // Zod validation errors
    if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};
        error.errors.forEach((err) => {
            const path = err.path.join('.');
            if (!details[path]) {
                details[path] = [];
            }
            details[path].push(err.message);
        });

        response.error = {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details,
        };
        return reply.status(400).send(response);
    }

    // Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002':
                response.error = {
                    code: 'DUPLICATE_ERROR',
                    message: 'A record with this value already exists',
                };
                return reply.status(409).send(response);

            case 'P2025':
                response.error = {
                    code: 'NOT_FOUND',
                    message: 'Record not found',
                };
                return reply.status(404).send(response);

            case 'P2003':
                response.error = {
                    code: 'FOREIGN_KEY_ERROR',
                    message: 'Related record not found',
                };
                return reply.status(400).send(response);

            default:
                response.error = {
                    code: 'DATABASE_ERROR',
                    message: 'Database operation failed',
                };
                return reply.status(500).send(response);
        }
    }

    // JWT errors
    if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        response.error = {
            code: 'UNAUTHORIZED',
            message: 'Authorization header is required',
        };
        return reply.status(401).send(response);
    }

    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
        response.error = {
            code: 'TOKEN_EXPIRED',
            message: 'Access token has expired',
        };
        return reply.status(401).send(response);
    }

    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
        response.error = {
            code: 'INVALID_TOKEN',
            message: 'Invalid access token',
        };
        return reply.status(401).send(response);
    }

    // Rate limit errors
    if (error.statusCode === 429) {
        response.error = {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
        };
        return reply.status(429).send(response);
    }

    // Custom application errors
    if ((error as any).isAppError) {
        response.error = {
            code: (error as any).code || 'APP_ERROR',
            message: error.message,
        };
        return reply.status((error as any).statusCode || 400).send(response);
    }

    // Log unexpected errors
    console.error('Unexpected error:', error);
    try {
        const fs = require('fs');
        const path = require('path');
        // Hardcode path to project root to avoid CWD ambiguity
        const logPath = 'D:\\Moby Dick Project\\GLOBAL_ERROR.log';
        const logContent = `[${new Date().toISOString()}] ${error.name}: ${error.message}\nSTACK: ${error.stack}\nREQ_ID: ${request.id}\nURL: ${request.url}\n\n`;
        fs.appendFileSync(logPath, logContent);
    } catch (e) {
        console.error('Failed to write to error log:', e);
    }

    // Generic error response for production
    if (process.env.NODE_ENV === 'production') {
        return reply.status(500).send(response);
    }

    // Include error details in development
    response.error = {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
        // @ts-ignore
        stack: error.stack
    };
    return reply.status(500).send(response);
}

// Custom error class for application errors
export class AppError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly isAppError = true;

    constructor(code: string, message: string, statusCode: number = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}

// Common error shortcuts
export const errors = {
    unauthorized: (message = 'Unauthorized') => new AppError('UNAUTHORIZED', message, 401),
    forbidden: (message = 'Forbidden') => new AppError('FORBIDDEN', message, 403),
    notFound: (message = 'Not found') => new AppError('NOT_FOUND', message, 404),
    conflict: (message = 'Conflict') => new AppError('CONFLICT', message, 409),
    badRequest: (message = 'Bad request') => new AppError('BAD_REQUEST', message, 400),
    internal: (message = 'Internal server error') => new AppError('INTERNAL_ERROR', message, 500),
};
