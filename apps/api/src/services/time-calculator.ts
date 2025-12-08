/**
 * Time Calculator Service
 * Calculates time differences between order events in minutes
 */

export interface OrderTimes {
    prepTime: number | null;     // ready - order (minutes)
    pickupTime: number | null;   // outForDelivery - ready (minutes)
    deliveryTime: number | null; // delivered - outForDelivery (minutes)
    totalTime: number | null;    // delivered - order (minutes)
}

export interface OrderTimestamps {
    orderDatetime: Date;
    readyDatetime: Date | null;
    outForDeliveryDatetime: Date | null;
    deliveredDatetime: Date | null;
}

/**
 * Calculate difference between two dates in minutes
 * Returns null if either date is null
 */
export function diffMinutes(start: Date | null, end: Date | null): number | null {
    if (!start || !end) return null;
    const diffMs = end.getTime() - start.getTime();
    return Math.round((diffMs / 1000 / 60) * 100) / 100; // 2 decimal places
}

/**
 * Calculate all order times from timestamps
 */
export function calculateOrderTimes(timestamps: OrderTimestamps): OrderTimes {
    return {
        prepTime: diffMinutes(timestamps.orderDatetime, timestamps.readyDatetime),
        pickupTime: diffMinutes(timestamps.readyDatetime, timestamps.outForDeliveryDatetime),
        deliveryTime: diffMinutes(timestamps.outForDeliveryDatetime, timestamps.deliveredDatetime),
        totalTime: diffMinutes(timestamps.orderDatetime, timestamps.deliveredDatetime),
    };
}

/**
 * Format minutes to human-readable string (MM:SS or HH:MM)
 */
export function formatMinutes(minutes: number | null): string {
    if (minutes === null) return '-';

    if (minutes < 60) {
        const mins = Math.floor(minutes);
        const secs = Math.round((minutes - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    }
}

/**
 * Calculate average of an array of numbers, ignoring nulls
 */
export function calculateAverage(values: (number | null)[]): number | null {
    const validValues = values.filter((v): v is number => v !== null);
    if (validValues.length === 0) return null;
    return validValues.reduce((a, b) => a + b, 0) / validValues.length;
}
