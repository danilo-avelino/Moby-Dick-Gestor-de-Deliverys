// Generic Open Delivery Adapter
// Used for platforms that follow Open Delivery standard (Neemo, Cardápio Web, AnotaAi, Consumer)

import { SalesIntegrationAdapter, registerAdapter } from '../base-adapter';
import {
    IntegrationConfig,
    NormalizedOrder,
    OrderStatus,
    OrderItem
} from '../types';

// Open Delivery standard order format
interface OpenDeliveryOrder {
    id: string;
    displayId: string;
    createdAt: string;
    orderType: string;
    customer: {
        id: string;
        name: string;
        phone: string;
        documentNumber?: string;
    };
    payments: {
        pending: number;
        methods: Array<{
            type: string;
            value: number;
        }>;
    };
    delivery?: {
        deliveryAddress: {
            streetName: string;
            streetNumber: string;
            formattedAddress?: string;
            neighborhood: string;
            city: string;
            state: string;
            postalCode: string;
            complement?: string;
            reference?: string;
            coordinates?: {
                latitude: number;
                longitude: number;
            };
        };
        estimatedDeliveryDateTime?: string;
    };
    items: Array<{
        id: string;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        observations?: string;
        subItems?: Array<{
            name: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
        }>;
    }>;
    total: {
        itemsPrice: number;
        deliveryFee: number;
        discount: number;
        orderAmount: number;
    };
    additionalInfo?: string;
}

export class OpenDeliveryAdapter extends SalesIntegrationAdapter {
    protected apiUrl: string;
    protected platformName: string;

    constructor(config: IntegrationConfig, apiUrl: string, platformName: string) {
        super(config);
        this.apiUrl = apiUrl;
        this.platformName = platformName;
    }

    getPlatformName(): string {
        return this.platformName;
    }

    getBaseUrl(): string {
        return this.apiUrl;
    }

    async authenticate(): Promise<void> {
        if (!this.credentials.apiToken) {
            throw new Error(`${this.platformName} API token is required`);
        }
    }

    async refreshToken(): Promise<void> { }

    isTokenValid(): boolean {
        return !!this.credentials.apiToken;
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.makeRequest('GET', '/merchants/me');
            return true;
        } catch {
            return false;
        }
    }

    protected async makeRequest<T>(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        endpoint: string,
        data?: unknown
    ): Promise<T> {
        const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
            method,
            headers: {
                'Authorization': `Bearer ${this.credentials.apiToken}`,
                'Content-Type': 'application/json',
            },
            body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
            throw new Error(`${this.platformName} API error: ${response.status}`);
        }

        return response.json();
    }

    async fetchOrders(_since?: Date): Promise<NormalizedOrder[]> {
        const response = await this.makeRequest<OpenDeliveryOrder[]>('GET', '/orders');
        return response.map(o => this.normalizeOrder(o));
    }

    async getOrderDetails(orderId: string): Promise<NormalizedOrder> {
        const order = await this.makeRequest<OpenDeliveryOrder>('GET', `/orders/${orderId}`);
        return this.normalizeOrder(order);
    }

    async confirmOrder(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/confirm`);
    }

    async rejectOrder(orderId: string, reason?: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/reject`, { reason });
    }

    async markOrderReady(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/readyToPickup`);
    }

    async dispatchOrder(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/dispatch`);
    }

    async cancelOrder(orderId: string, reason: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/cancel`, { reason });
    }

    protected normalizeOrder(order: OpenDeliveryOrder): NormalizedOrder {
        return {
            id: order.id,
            externalId: order.id,
            platform: this.platformName.toLowerCase().replace(/\s/g, '_'),
            restaurantId: '',
            status: 'pending',
            customer: {
                name: order.customer.name,
                phone: order.customer.phone,
                document: order.customer.documentNumber,
            },
            deliveryAddress: order.delivery?.deliveryAddress ? {
                street: order.delivery.deliveryAddress.streetName,
                number: order.delivery.deliveryAddress.streetNumber,
                complement: order.delivery.deliveryAddress.complement,
                neighborhood: order.delivery.deliveryAddress.neighborhood,
                city: order.delivery.deliveryAddress.city,
                state: order.delivery.deliveryAddress.state,
                zipCode: order.delivery.deliveryAddress.postalCode,
                reference: order.delivery.deliveryAddress.reference,
                coordinates: order.delivery.deliveryAddress.coordinates,
            } : undefined,
            items: order.items.map(this.normalizeItem.bind(this)),
            subtotal: order.total.itemsPrice,
            deliveryFee: order.total.deliveryFee,
            discount: order.total.discount,
            total: order.total.orderAmount,
            paymentMethod: order.payments.methods[0]?.type || 'unknown',
            paymentStatus: order.payments.pending > 0 ? 'pending' : 'paid',
            observations: order.additionalInfo,
            createdAt: new Date(order.createdAt),
        };
    }

    private normalizeItem(item: OpenDeliveryOrder['items'][0]): OrderItem {
        return {
            externalId: item.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            observations: item.observations,
            options: item.subItems?.map(s => ({
                name: s.name,
                value: s.name,
                price: s.unitPrice,
            })),
        };
    }

    protected mapStatusToPlatform(status: OrderStatus): string {
        const map: Record<OrderStatus, string> = {
            pending: 'PENDING',
            confirmed: 'CONFIRMED',
            preparing: 'IN_PREPARATION',
            ready: 'READY_TO_PICKUP',
            dispatched: 'DISPATCHED',
            delivered: 'CONCLUDED',
            cancelled: 'CANCELLED',
        };
        return map[status];
    }
}

// Platform-specific adapters using Open Delivery
export class NeemoAdapter extends OpenDeliveryAdapter {
    constructor(config: IntegrationConfig) {
        super(config, 'https://deliveryapp.neemo.com.br/api/connect', 'Neemo');
    }
}

export class CardapioWebAdapter extends OpenDeliveryAdapter {
    constructor(config: IntegrationConfig) {
        super(config, 'https://api.cardapioweb.com/v1', 'Cardápio Web');
    }
}

export class AnotaAiAdapter extends OpenDeliveryAdapter {
    constructor(config: IntegrationConfig) {
        super(config, 'https://api.anota.ai/v1', 'AnotaAi');
    }
}

export class ConsumerAdapter extends OpenDeliveryAdapter {
    constructor(config: IntegrationConfig) {
        super(config, 'https://api.programaconsumer.com.br/v1', 'Consumer');
    }
}

// Register all adapters
registerAdapter('neemo', NeemoAdapter);
registerAdapter('cardapio_web', CardapioWebAdapter);
registerAdapter('anotaai', AnotaAiAdapter);
registerAdapter('consumer', ConsumerAdapter);
