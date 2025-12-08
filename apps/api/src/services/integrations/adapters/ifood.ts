// iFood Integration Adapter
// Documentation: https://developer.ifood.com.br

import { SalesIntegrationAdapter, registerAdapter } from '../base-adapter';
import {
    IntegrationConfig,
    NormalizedOrder,
    OrderStatus,
    OrderItem,
    CatalogItem
} from '../types';

interface IFoodTokenResponse {
    accessToken: string;
    type: string;
    expiresIn: number;
}

interface IFoodOrder {
    id: string;
    reference: string;
    shortReference: string;
    createdAt: string;
    type: string;
    merchant: {
        id: string;
        name: string;
    };
    customer: {
        id: string;
        name: string;
        phone: {
            number: string;
        };
        documentNumber?: string;
    };
    deliveryAddress?: {
        streetName: string;
        streetNumber: string;
        complement?: string;
        neighborhood: string;
        city: string;
        state: string;
        postalCode: string;
        reference?: string;
        coordinates?: {
            latitude: number;
            longitude: number;
        };
    };
    items: IFoodOrderItem[];
    total: {
        subTotal: number;
        deliveryFee: number;
        benefits: number;
        orderAmount: number;
    };
    payments: {
        methods: Array<{
            method: string;
            type: string;
        }>;
        pending: number;
    };
    preparationStartDateTime?: string;
    additionalInfo?: string;
}

interface IFoodOrderItem {
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    observations?: string;
    options?: Array<{
        name: string;
        unitPrice: number;
    }>;
}

export class IFoodAdapter extends SalesIntegrationAdapter {
    private readonly API_URL_PROD = 'https://merchant-api.ifood.com.br';
    private readonly API_URL_SANDBOX = 'https://merchant-api.ifood.com.br'; // Same, uses test credentials
    private tokenExpiresAt: Date | null = null;

    constructor(config: IntegrationConfig) {
        super(config);
    }

    getPlatformName(): string {
        return 'iFood';
    }

    getBaseUrl(): string {
        return this.config.sandboxMode ? this.API_URL_SANDBOX : this.API_URL_PROD;
    }

    async authenticate(): Promise<void> {
        const response = await fetch(`${this.getBaseUrl()}/authentication/v1.0/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grantType: 'client_credentials',
                clientId: this.credentials.clientId!,
                clientSecret: this.credentials.clientSecret!,
            }),
        });

        if (!response.ok) {
            throw new Error(`iFood authentication failed: ${response.statusText}`);
        }

        const data: IFoodTokenResponse = await response.json();
        this.credentials.accessToken = data.accessToken;
        this.tokenExpiresAt = new Date(Date.now() + data.expiresIn * 1000);
    }

    async refreshToken(): Promise<void> {
        // iFood uses client_credentials, so just re-authenticate
        await this.authenticate();
    }

    isTokenValid(): boolean {
        if (!this.credentials.accessToken || !this.tokenExpiresAt) {
            return false;
        }
        // Consider token invalid if it expires in less than 5 minutes
        return this.tokenExpiresAt.getTime() - Date.now() > 5 * 60 * 1000;
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.ensureAuthenticated();
            await this.makeRequest('GET', '/merchant/v1.0/merchants');
            return true;
        } catch {
            return false;
        }
    }

    private async ensureAuthenticated(): Promise<void> {
        if (!this.isTokenValid()) {
            await this.authenticate();
        }
    }

    protected async makeRequest<T>(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        endpoint: string,
        data?: unknown
    ): Promise<T> {
        await this.ensureAuthenticated();

        const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
            method,
            headers: {
                'Authorization': `Bearer ${this.credentials.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`iFood API error: ${response.status} - ${error}`);
        }

        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    // Orders
    async fetchOrders(since?: Date): Promise<NormalizedOrder[]> {
        const params = new URLSearchParams();
        if (since) {
            params.append('createdAtStart', since.toISOString());
        }

        const orders = await this.makeRequest<IFoodOrder[]>(
            'GET',
            `/order/v1.0/orders?${params.toString()}`
        );

        return orders.map(order => this.normalizeOrder(order));
    }

    async getOrderDetails(orderId: string): Promise<NormalizedOrder> {
        const order = await this.makeRequest<IFoodOrder>(
            'GET',
            `/order/v1.0/orders/${orderId}`
        );
        return this.normalizeOrder(order);
    }

    async confirmOrder(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/order/v1.0/orders/${orderId}/confirm`);
    }

    async rejectOrder(orderId: string, reason?: string): Promise<void> {
        await this.makeRequest('POST', `/order/v1.0/orders/${orderId}/reject`, {
            reason: reason || 'Pedido rejeitado pelo restaurante',
        });
    }

    async markOrderReady(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/order/v1.0/orders/${orderId}/readyToPickup`);
    }

    async dispatchOrder(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/order/v1.0/orders/${orderId}/dispatch`);
    }

    async cancelOrder(orderId: string, reason: string): Promise<void> {
        await this.makeRequest('POST', `/order/v1.0/orders/${orderId}/requestCancellation`, {
            reason,
        });
    }

    async syncCatalog(items: CatalogItem[]): Promise<void> {
        // iFood catalog sync - implementation depends on merchant setup
        console.log(`iFood: Syncing ${items.length} catalog items`);
        // This would use the Catalog API
    }

    async updateItemAvailability(itemId: string, available: boolean): Promise<void> {
        await this.makeRequest('PATCH', `/catalog/v2.0/items/${itemId}`, {
            available,
        });
    }

    protected normalizeOrder(order: IFoodOrder): NormalizedOrder {
        return {
            id: order.id,
            externalId: order.id,
            platform: 'ifood',
            restaurantId: order.merchant.id,
            status: this.mapPlatformStatus(order),
            customer: {
                name: order.customer.name,
                phone: order.customer.phone?.number,
                document: order.customer.documentNumber,
            },
            deliveryAddress: order.deliveryAddress ? {
                street: order.deliveryAddress.streetName,
                number: order.deliveryAddress.streetNumber,
                complement: order.deliveryAddress.complement,
                neighborhood: order.deliveryAddress.neighborhood,
                city: order.deliveryAddress.city,
                state: order.deliveryAddress.state,
                zipCode: order.deliveryAddress.postalCode,
                reference: order.deliveryAddress.reference,
                coordinates: order.deliveryAddress.coordinates,
            } : undefined,
            items: order.items.map(this.normalizeOrderItem),
            subtotal: order.total.subTotal,
            deliveryFee: order.total.deliveryFee,
            discount: order.total.benefits,
            total: order.total.orderAmount,
            paymentMethod: order.payments.methods[0]?.method || 'unknown',
            paymentStatus: order.payments.pending > 0 ? 'pending' : 'paid',
            observations: order.additionalInfo,
            createdAt: new Date(order.createdAt),
            confirmedAt: order.preparationStartDateTime ? new Date(order.preparationStartDateTime) : undefined,
        };
    }

    private normalizeOrderItem(item: IFoodOrderItem): OrderItem {
        return {
            externalId: item.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            observations: item.observations,
            options: item.options?.map(opt => ({
                name: opt.name,
                value: opt.name,
                price: opt.unitPrice,
            })),
        };
    }

    private mapPlatformStatus(_order: IFoodOrder): OrderStatus {
        // This would need to check the order's current status from polling events
        return 'pending';
    }

    protected mapStatusToPlatform(status: OrderStatus): string {
        const statusMap: Record<OrderStatus, string> = {
            pending: 'PLACED',
            confirmed: 'CONFIRMED',
            preparing: 'PREPARATION_STARTED',
            ready: 'READY_TO_PICKUP',
            dispatched: 'DISPATCHED',
            delivered: 'CONCLUDED',
            cancelled: 'CANCELLED',
        };
        return statusMap[status];
    }
}

// Register the adapter
registerAdapter('ifood', IFoodAdapter);
