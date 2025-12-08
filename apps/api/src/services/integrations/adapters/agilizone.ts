// Agilizone Logistics Adapter
// Receives orders via webhooks and manages delivery

import { LogisticsIntegrationAdapter, registerAdapter } from '../base-adapter';
import {
    IntegrationConfig,
    DeliveryRequest,
    DeliveryQuote,
    DeliveryTracking,
    DeliveryStatus
} from '../types';

export class AgiliZoneAdapter extends LogisticsIntegrationAdapter {
    private readonly API_URL = 'https://api.agilizone.com/v1';

    constructor(config: IntegrationConfig) {
        super(config);
    }

    getPlatformName(): string {
        return 'Agilizone';
    }

    getBaseUrl(): string {
        return this.API_URL;
    }

    async authenticate(): Promise<void> {
        // Agilizone uses Merchant ID + Client credentials
        if (!this.credentials.merchantId || !this.credentials.clientId) {
            throw new Error('Agilizone requires merchantId and clientId');
        }
    }

    async refreshToken(): Promise<void> {
        // No token refresh needed
    }

    isTokenValid(): boolean {
        return !!this.credentials.merchantId && !!this.credentials.clientId;
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.makeRequest('GET', '/merchant/status');
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
                'X-Merchant-ID': this.credentials.merchantId!,
                'X-Client-ID': this.credentials.clientId!,
                'X-Client-Secret': this.credentials.clientSecret!,
                'Content-Type': 'application/json',
            },
            body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
            throw new Error(`Agilizone API error: ${response.status}`);
        }

        return response.json();
    }

    async getDeliveryQuote(request: DeliveryRequest): Promise<DeliveryQuote> {
        const response = await this.makeRequest<{
            disponivel: boolean;
            preco?: number;
            tempoEstimado?: number;
            distancia?: number;
        }>('POST', '/cotacao', {
            enderecoColeta: {
                rua: request.pickupAddress.street,
                numero: request.pickupAddress.number,
                bairro: request.pickupAddress.neighborhood,
                cidade: request.pickupAddress.city,
                uf: request.pickupAddress.state,
                cep: request.pickupAddress.zipCode,
            },
            enderecoEntrega: {
                rua: request.deliveryAddress.street,
                numero: request.deliveryAddress.number,
                bairro: request.deliveryAddress.neighborhood,
                cidade: request.deliveryAddress.city,
                uf: request.deliveryAddress.state,
                cep: request.deliveryAddress.zipCode,
            },
        });

        return {
            available: response.disponivel,
            price: response.preco,
            estimatedMinutes: response.tempoEstimado,
            distance: response.distancia,
        };
    }

    async requestDelivery(request: DeliveryRequest): Promise<string> {
        const response = await this.makeRequest<{ id: string }>('POST', '/entregas', {
            pedidoId: request.orderId,
            enderecoColeta: {
                rua: request.pickupAddress.street,
                numero: request.pickupAddress.number,
                complemento: request.pickupAddress.complement,
                bairro: request.pickupAddress.neighborhood,
                cidade: request.pickupAddress.city,
                uf: request.pickupAddress.state,
                cep: request.pickupAddress.zipCode,
                coordenadas: request.pickupAddress.coordinates,
            },
            enderecoEntrega: {
                rua: request.deliveryAddress.street,
                numero: request.deliveryAddress.number,
                complemento: request.deliveryAddress.complement,
                bairro: request.deliveryAddress.neighborhood,
                cidade: request.deliveryAddress.city,
                uf: request.deliveryAddress.state,
                cep: request.deliveryAddress.zipCode,
                coordenadas: request.deliveryAddress.coordinates,
            },
            itens: request.items,
            observacoes: request.observations,
        });

        return response.id;
    }

    async cancelDelivery(deliveryId: string, reason?: string): Promise<void> {
        await this.makeRequest('POST', `/entregas/${deliveryId}/cancelar`, {
            motivo: reason,
        });
    }

    async getDeliveryTracking(deliveryId: string): Promise<DeliveryTracking> {
        const response = await this.makeRequest<{
            status: string;
            entregador?: {
                nome: string;
                telefone: string;
            };
            localizacao?: {
                latitude: number;
                longitude: number;
            };
            previsaoChegada?: string;
            historico: Array<{
                status: string;
                dataHora: string;
                descricao?: string;
            }>;
        }>('GET', `/entregas/${deliveryId}/rastreamento`);

        return {
            status: this.mapAgiliStatus(response.status),
            driverName: response.entregador?.nome,
            driverPhone: response.entregador?.telefone,
            coordinates: response.localizacao,
            estimatedArrival: response.previsaoChegada ? new Date(response.previsaoChegada) : undefined,
            events: response.historico.map(h => ({
                status: this.mapAgiliStatus(h.status),
                timestamp: new Date(h.dataHora),
                description: h.descricao,
            })),
        };
    }

    async markOrderReady(deliveryId: string): Promise<void> {
        await this.makeRequest('POST', `/entregas/${deliveryId}/pronto`);
    }

    async confirmPickup(deliveryId: string): Promise<void> {
        await this.makeRequest('POST', `/entregas/${deliveryId}/coletado`);
    }

    async confirmDelivery(deliveryId: string): Promise<void> {
        await this.makeRequest('POST', `/entregas/${deliveryId}/entregue`);
    }

    private mapAgiliStatus(status: string): DeliveryStatus {
        const map: Record<string, DeliveryStatus> = {
            'PENDENTE': 'pending',
            'ACEITO': 'accepted',
            'A_CAMINHO_COLETA': 'arriving_pickup',
            'NO_LOCAL_COLETA': 'at_pickup',
            'COLETADO': 'picked_up',
            'EM_TRANSITO': 'in_transit',
            'PROXIMO_ENTREGA': 'arriving_delivery',
            'ENTREGUE': 'delivered',
            'CANCELADO': 'cancelled',
        };
        return map[status] || 'pending';
    }
}

registerAdapter('agilizone', AgiliZoneAdapter);
