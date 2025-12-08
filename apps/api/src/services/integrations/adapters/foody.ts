// Foody Delivery Logistics Adapter
// Documentation: foodydelivery.com/developers
// Uses Open Delivery standard

import { LogisticsIntegrationAdapter, registerAdapter } from '../base-adapter';
import {
    IntegrationConfig,
    DeliveryRequest,
    DeliveryQuote,
    DeliveryTracking,
    DeliveryStatus,
    DeliveryEvent
} from '../types';

interface FoodyAvailabilityResponse {
    available: boolean;
    price?: number;
    estimatedMinutes?: number;
    distance?: number;
    currency?: string;
}

interface FoodyDeliveryResponse {
    id: string;
    status: string;
    createdAt: string;
}

interface FoodyTrackingResponse {
    id: string;
    status: string;
    driver?: {
        name: string;
        phone: string;
        photoUrl?: string;
    };
    currentLocation?: {
        latitude: number;
        longitude: number;
        updatedAt: string;
    };
    route?: {
        pickupLocation: { lat: number; lng: number };
        deliveryLocation: { lat: number; lng: number };
        currentPosition?: number;
    };
    estimatedArrival?: string;
    events: Array<{
        status: string;
        timestamp: string;
        description?: string;
    }>;
}

export class FoodyAdapter extends LogisticsIntegrationAdapter {
    private readonly API_URL = 'https://api.foodydelivery.com';

    constructor(config: IntegrationConfig) {
        super(config);
    }

    getPlatformName(): string {
        return 'Foody Delivery';
    }

    getBaseUrl(): string {
        return this.API_URL;
    }

    async authenticate(): Promise<void> {
        // Foody uses static API token
        if (!this.credentials.apiToken) {
            throw new Error('Foody API token is required');
        }
    }

    async refreshToken(): Promise<void> {
        // Token doesn't expire for Foody
    }

    isTokenValid(): boolean {
        return !!this.credentials.apiToken;
    }

    async testConnection(): Promise<boolean> {
        try {
            // Try to get availability with a test address
            const testRequest: DeliveryRequest = {
                orderId: 'test',
                pickupAddress: {
                    street: 'Rua Teste',
                    number: '123',
                    neighborhood: 'Centro',
                    city: 'São Paulo',
                    state: 'SP',
                    zipCode: '01310-100',
                },
                deliveryAddress: {
                    street: 'Rua Destino',
                    number: '456',
                    neighborhood: 'Centro',
                    city: 'São Paulo',
                    state: 'SP',
                    zipCode: '01310-200',
                },
            };
            await this.getDeliveryQuote(testRequest);
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
            throw new Error(`Foody API error: ${response.status} - ${error}`);
        }

        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    async getDeliveryQuote(request: DeliveryRequest): Promise<DeliveryQuote> {
        const response = await this.makeRequest<FoodyAvailabilityResponse>(
            'POST',
            '/v1/logistics/availability',
            {
                pickupAddress: this.formatAddress(request.pickupAddress),
                deliveryAddress: this.formatAddress(request.deliveryAddress),
            }
        );

        return {
            available: response.available,
            price: response.price,
            estimatedMinutes: response.estimatedMinutes,
            distance: response.distance,
        };
    }

    async requestDelivery(request: DeliveryRequest): Promise<string> {
        const response = await this.makeRequest<FoodyDeliveryResponse>(
            'POST',
            '/v1/logistics/orders',
            {
                orderId: request.orderId,
                pickupAddress: this.formatAddress(request.pickupAddress),
                deliveryAddress: this.formatAddress(request.deliveryAddress),
                items: request.items,
                observations: request.observations,
            }
        );

        return response.id;
    }

    async cancelDelivery(deliveryId: string, reason?: string): Promise<void> {
        await this.makeRequest('POST', `/v1/logistics/orders/${deliveryId}/cancel`, {
            reason,
        });
    }

    async getDeliveryTracking(deliveryId: string): Promise<DeliveryTracking> {
        const response = await this.makeRequest<FoodyTrackingResponse>(
            'GET',
            `/v1/logistics/orders/${deliveryId}/tracking`
        );

        return {
            status: this.mapFoodyStatus(response.status),
            driverName: response.driver?.name,
            driverPhone: response.driver?.phone,
            coordinates: response.currentLocation ? {
                latitude: response.currentLocation.latitude,
                longitude: response.currentLocation.longitude,
            } : undefined,
            estimatedArrival: response.estimatedArrival ? new Date(response.estimatedArrival) : undefined,
            events: response.events.map(this.mapEvent.bind(this)),
        };
    }

    async markOrderReady(deliveryId: string): Promise<void> {
        await this.makeRequest('POST', `/v1/logistics/orders/${deliveryId}/ready`);
    }

    async confirmPickup(deliveryId: string): Promise<void> {
        await this.makeRequest('POST', `/v1/logistics/orders/${deliveryId}/pickup`);
    }

    async confirmDelivery(deliveryId: string): Promise<void> {
        await this.makeRequest('POST', `/v1/logistics/orders/${deliveryId}/complete`);
    }

    private formatAddress(address: DeliveryRequest['pickupAddress']) {
        return {
            street: address.street,
            number: address.number,
            complement: address.complement || '',
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            coordinates: address.coordinates,
        };
    }

    private mapFoodyStatus(status: string): DeliveryStatus {
        const statusMap: Record<string, DeliveryStatus> = {
            'PENDING': 'pending',
            'ACCEPTED': 'accepted',
            'GOING_TO_PICKUP': 'arriving_pickup',
            'AT_PICKUP': 'at_pickup',
            'PICKED_UP': 'picked_up',
            'IN_TRANSIT': 'in_transit',
            'GOING_TO_DELIVERY': 'arriving_delivery',
            'DELIVERED': 'delivered',
            'CANCELLED': 'cancelled',
        };
        return statusMap[status] || 'pending';
    }

    private mapEvent(event: { status: string; timestamp: string; description?: string }): DeliveryEvent {
        return {
            status: this.mapFoodyStatus(event.status),
            timestamp: new Date(event.timestamp),
            description: event.description,
        };
    }
}

// Register the adapter
registerAdapter('foody', FoodyAdapter);
