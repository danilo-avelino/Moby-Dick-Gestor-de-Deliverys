// 99Food Integration Adapter
// Documentation: developers.99app.com

import { SalesIntegrationAdapter, registerAdapter } from '../base-adapter';
import {
    IntegrationConfig,
    NormalizedOrder,
    OrderStatus,
    OrderItem
} from '../types';

interface NinetyNineOrder {
    id: string;
    code: string;
    status: string;
    createdAt: string;
    merchant: {
        id: string;
        name: string;
    };
    customer: {
        name: string;
        phone: string;
        cpf?: string;
    };
    delivery: {
        address: {
            street: string;
            number: string;
            complement?: string;
            neighborhood: string;
            city: string;
            state: string;
            zipCode: string;
            reference?: string;
            latitude?: number;
            longitude?: number;
        };
    };
    items: Array<{
        id: string;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        notes?: string;
        complements?: Array<{
            name: string;
            price: number;
        }>;
    }>;
    pricing: {
        subtotal: number;
        deliveryFee: number;
        discount: number;
        total: number;
    };
    payment: {
        method: string;
        status: string;
    };
    notes?: string;
}

export class NinetyNineFoodAdapter extends SalesIntegrationAdapter {
    private readonly API_URL = 'https://api.99app.com/food/v1';

    constructor(config: IntegrationConfig) {
        super(config);
    }

    getPlatformName(): string {
        return '99Food';
    }

    getBaseUrl(): string {
        return this.API_URL;
    }

    async authenticate(): Promise<void> {
        if (!this.credentials.apiToken) {
            throw new Error('99Food API token is required');
        }
    }

    async refreshToken(): Promise<void> {
        // Static token, no refresh needed
    }

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
            const error = await response.text();
            throw new Error(`99Food API error: ${response.status} - ${error}`);
        }

        return response.json();
    }

    async fetchOrders(since?: Date): Promise<NormalizedOrder[]> {
        const params = new URLSearchParams();
        if (since) {
            params.append('since', since.toISOString());
        }

        const response = await this.makeRequest<{ orders: NinetyNineOrder[] }>(
            'GET',
            `/orders?${params.toString()}`
        );

        return response.orders.map(order => this.normalizeOrder(order));
    }

    async getOrderDetails(orderId: string): Promise<NormalizedOrder> {
        const order = await this.makeRequest<NinetyNineOrder>(
            'GET',
            `/orders/${orderId}`
        );
        return this.normalizeOrder(order);
    }

    async confirmOrder(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/confirm`);
    }

    async rejectOrder(orderId: string, reason?: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/reject`, { reason });
    }

    async markOrderReady(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/ready`);
    }

    async dispatchOrder(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/dispatch`);
    }

    async cancelOrder(orderId: string, reason: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/cancel`, { reason });
    }

    protected normalizeOrder(order: NinetyNineOrder): NormalizedOrder {
        return {
            id: order.id,
            externalId: order.id,
            platform: '99food',
            restaurantId: order.merchant.id,
            status: this.mapPlatformStatus(order.status),
            customer: {
                name: order.customer.name,
                phone: order.customer.phone,
                document: order.customer.cpf,
            },
            deliveryAddress: {
                street: order.delivery.address.street,
                number: order.delivery.address.number,
                complement: order.delivery.address.complement,
                neighborhood: order.delivery.address.neighborhood,
                city: order.delivery.address.city,
                state: order.delivery.address.state,
                zipCode: order.delivery.address.zipCode,
                reference: order.delivery.address.reference,
                coordinates: order.delivery.address.latitude ? {
                    latitude: order.delivery.address.latitude,
                    longitude: order.delivery.address.longitude!,
                } : undefined,
            },
            items: order.items.map(this.normalizeItem),
            subtotal: order.pricing.subtotal,
            deliveryFee: order.pricing.deliveryFee,
            discount: order.pricing.discount,
            total: order.pricing.total,
            paymentMethod: order.payment.method,
            paymentStatus: order.payment.status === 'PAID' ? 'paid' : 'pending',
            observations: order.notes,
            createdAt: new Date(order.createdAt),
        };
    }

    private normalizeItem(item: NinetyNineOrder['items'][0]): OrderItem {
        return {
            externalId: item.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            observations: item.notes,
            options: item.complements?.map(c => ({
                name: c.name,
                value: c.name,
                price: c.price,
            })),
        };
    }

    private mapPlatformStatus(status: string): OrderStatus {
        const map: Record<string, OrderStatus> = {
            'PENDING': 'pending',
            'CONFIRMED': 'confirmed',
            'PREPARING': 'preparing',
            'READY': 'ready',
            'DISPATCHED': 'dispatched',
            'DELIVERED': 'delivered',
            'CANCELLED': 'cancelled',
        };
        return map[status] || 'pending';
    }

    protected mapStatusToPlatform(status: OrderStatus): string {
        const map: Record<OrderStatus, string> = {
            pending: 'PENDING',
            confirmed: 'CONFIRMED',
            preparing: 'PREPARING',
            ready: 'READY',
            dispatched: 'DISPATCHED',
            delivered: 'DELIVERED',
            cancelled: 'CANCELLED',
        };
        return map[status];
    }
}

registerAdapter('99food', NinetyNineFoodAdapter);
