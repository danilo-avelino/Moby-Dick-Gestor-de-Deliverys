// Base Integration Adapter - Abstract class for all platform adapters

import {
    IntegrationConfig,
    IntegrationCredentials,
    NormalizedOrder,
    OrderStatus,
    DeliveryRequest,
    DeliveryQuote,
    DeliveryTracking,
    CatalogItem
} from './types';

export abstract class BaseIntegrationAdapter {
    protected config: IntegrationConfig;
    protected credentials: IntegrationCredentials;

    constructor(config: IntegrationConfig) {
        this.config = config;
        this.credentials = config.credentials;
    }

    // Authentication
    abstract authenticate(): Promise<void>;
    abstract refreshToken(): Promise<void>;
    abstract isTokenValid(): boolean;

    // Connection test
    abstract testConnection(): Promise<boolean>;

    // Get base URL based on sandbox/production mode
    abstract getBaseUrl(): string;

    // Make authenticated request
    protected abstract makeRequest<T>(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        endpoint: string,
        data?: unknown
    ): Promise<T>;

    // Platform name
    abstract getPlatformName(): string;
}

// Sales Integration Adapter
export abstract class SalesIntegrationAdapter extends BaseIntegrationAdapter {
    // Orders
    abstract fetchOrders(since?: Date): Promise<NormalizedOrder[]>;
    abstract getOrderDetails(orderId: string): Promise<NormalizedOrder>;
    abstract confirmOrder(orderId: string): Promise<void>;
    abstract rejectOrder(orderId: string, reason?: string): Promise<void>;
    abstract markOrderReady(orderId: string): Promise<void>;
    abstract dispatchOrder(orderId: string): Promise<void>;
    abstract cancelOrder(orderId: string, reason: string): Promise<void>;

    // Catalog (optional - not all platforms support)
    async syncCatalog?(items: CatalogItem[]): Promise<void>;
    async updateItemAvailability?(itemId: string, available: boolean): Promise<void>;
    async updateItemPrice?(itemId: string, price: number): Promise<void>;

    // Convert platform-specific order to normalized format
    protected abstract normalizeOrder(platformOrder: unknown): NormalizedOrder;

    // Convert normalized status to platform-specific status
    protected abstract mapStatusToPlatform(status: OrderStatus): string;
}

// Logistics Integration Adapter
export abstract class LogisticsIntegrationAdapter extends BaseIntegrationAdapter {
    // Quote and availability
    abstract getDeliveryQuote(request: DeliveryRequest): Promise<DeliveryQuote>;

    // Delivery management
    abstract requestDelivery(request: DeliveryRequest): Promise<string>; // Returns delivery ID
    abstract cancelDelivery(deliveryId: string, reason?: string): Promise<void>;

    // Tracking
    abstract getDeliveryTracking(deliveryId: string): Promise<DeliveryTracking>;

    // Status updates
    abstract markOrderReady(deliveryId: string): Promise<void>;
    abstract confirmPickup?(deliveryId: string): Promise<void>;
    abstract confirmDelivery?(deliveryId: string): Promise<void>;
}

// Helper function to create adapter instance
export type AdapterConstructor = new (config: IntegrationConfig) => BaseIntegrationAdapter;

const adapterRegistry: Map<string, AdapterConstructor> = new Map();

export function registerAdapter(platform: string, constructor: AdapterConstructor): void {
    adapterRegistry.set(platform.toLowerCase(), constructor);
}

export function createAdapter(config: IntegrationConfig): BaseIntegrationAdapter {
    const Constructor = adapterRegistry.get(config.platform.toLowerCase());
    if (!Constructor) {
        throw new Error(`No adapter registered for platform: ${config.platform}`);
    }
    return new Constructor(config);
}

export function getRegisteredAdapters(): string[] {
    return Array.from(adapterRegistry.keys());
}
