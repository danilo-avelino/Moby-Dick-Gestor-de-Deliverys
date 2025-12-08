// Integration Service Index - Exports all adapters and utilities

// Types
export * from './types';

// Base Adapter
export * from './base-adapter';

// Sales Adapters
export * from './adapters/ifood';
export * from './adapters/99food';
export * from './adapters/saipos';
export * from './adapters/open-delivery';

// Logistics Adapters
export * from './adapters/foody';
export * from './adapters/agilizone';

// Integration Manager
export { IntegrationManager } from './integration-manager';
