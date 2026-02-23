
'use client';

export interface Location {
    latitude: number;
    longitude: number;
}

/**
 * Gets the user's current GPS position.
 * @returns A promise that resolves with the user's location or null if it fails.
 */
export function getCurrentPosition(): Promise<Location | null> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            console.warn("Geolocation is not supported by this browser.");
            return resolve(null);
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (err) => {
                console.error(`Geolocation error: ${err.message}`);
                // Instead of resolving null, we reject so the caller can catch it.
                reject(new Error(`Geolocation failed: ${err.message}`));
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    });
}

/**
 * Calculates the distance between two geographical points using the Haversine formula.
 * @param lat1 Latitude of the first point.
 * @param lon1 Longitude of the first point.
 * @param lat2 Latitude of the second point.
 * @param lon2 Longitude of the second point.
 * @returns The distance in meters.
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
}
