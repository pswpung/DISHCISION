'use client'
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapPickerProps {
    initialPosition?: { lat: number; lng: number };
    onConfirm: (coords: { lat: number; lng: number }, address: string) => void;
    onClose: () => void;
}

// Component to handle map clicks and marker dragging
function DraggableMarker({ position, setPosition, setMapInstance }: any) {
    const map = useMapEvents({
        click(e) {
            setPosition(e.latlng);
        },
    });

    // Save map instance for programmatic control
    useEffect(() => {
        setMapInstance(map);
    }, [map, setMapInstance]);

    return (
        <Marker
            position={position}
            draggable={true}
            eventHandlers={{
                dragend(e) {
                    setPosition(e.target.getLatLng());
                },
            }}
        />
    );
}

export default function MapPicker({ initialPosition, onConfirm, onClose }: MapPickerProps) {
    // Default to Bangkok center
    const [position, setPosition] = useState(
        initialPosition || { lat: 13.7563, lng: 100.5018 }
    );
    const [address, setAddress] = useState('Loading address...');
    const [isClient, setIsClient] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [mapInstance, setMapInstance] = useState<any>(null);

    // Ensure component only renders on client
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Smart Default: If no initialPosition is provided, attempt to use the user's current location
    useEffect(() => {
        if (!initialPosition && navigator.geolocation && isClient) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const newPos = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    };
                    setPosition(newPos);
                    // Update map view if instance is ready
                    if (mapInstance) {
                        mapInstance.setView([newPos.lat, newPos.lng], 15);
                    }
                },
                (error) => {
                    // Gracefully fail and fallback to default Bangkok location
                    // Using warn instead of error to prevent dev overlay interruption
                    console.warn("Location detection failed (User denied or timeout). Using default center.");
                },
                { enableHighAccuracy: false, timeout: 10000 }
            );
        }
    }, [initialPosition, isClient, mapInstance]);

    // Reverse geocode to get address when position changes
    useEffect(() => {
        const reverseGeocode = async () => {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?` +
                    `format=json&lat=${position.lat}&lon=${position.lng}&` +
                    `countrycodes=th&accept-language=en`
                );
                const data = await response.json();
                setAddress(data.display_name || 'Unknown location');
            } catch (error) {
                console.error('Reverse geocoding failed:', error);
                setAddress('Unable to fetch address');
            }
        };

        reverseGeocode();
    }, [position]);

    // Search handler
    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `format=json&q=${encodeURIComponent(query)}` +
                `&countrycodes=th&bounded=1` +
                `&viewbox=100.3327,13.4949,100.9381,13.9555` +
                `&limit=5`
            );
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    // Select search result
    const selectSearchResult = (result: any) => {
        const newPosition = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
        setPosition(newPosition);
        setSearchQuery('');
        setSearchResults([]);

        // Pan map to new position
        if (mapInstance) {
            mapInstance.setView([newPosition.lat, newPosition.lng], 15);
        }
    };

    const handleConfirm = () => {
        onConfirm(position, address);
        onClose();
    };

    if (!isClient) {
        return null; // Don't render on server
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/10">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-primary/10 to-primary/5">
                    <h2 className="text-lg font-bold text-foreground">📍 Select Location</h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors text-2xl leading-none"
                    >
                        ×
                    </button>
                </div>

                {/* Search Box */}
                <div className="p-4 border-b border-white/10 bg-white/5">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search for a location in Bangkok..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-background border border-white/10 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {searchResults.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-y-auto bg-background border border-white/10 rounded-lg">
                            {searchResults.map((result, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => selectSearchResult(result)}
                                    className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                                >
                                    <p className="text-sm text-foreground font-medium truncate">{result.display_name}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Map */}
                <div className="h-96 w-full relative">
                    <MapContainer
                        center={[position.lat, position.lng]}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <DraggableMarker position={position} setPosition={setPosition} setMapInstance={setMapInstance} />
                    </MapContainer>

                    {/* Current Location Button Overlay */}
                    <button
                        type="button"
                        onClick={() => {
                            if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition((pos) => {
                                    const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                                    setPosition(newPos);
                                    if (mapInstance) mapInstance.setView([newPos.lat, newPos.lng], 15);
                                });
                            }
                        }}
                        className="absolute bottom-4 right-4 z-[1000] bg-background border border-white/10 p-3 rounded-full shadow-2xl hover:bg-white/10 text-primary transition-all active:scale-95"
                        title="Go to My Location"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                        </svg>
                    </button>
                </div>

                {/* Address Display */}
                <div className="p-4 bg-white/5 border-t border-white/10">
                    <p className="text-xs text-muted-foreground mb-1">Selected Address:</p>
                    <p className="text-sm text-foreground font-medium line-clamp-2">{address}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                        📌 {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                    </p>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-xl font-medium text-sm bg-white/5 hover:bg-white/10 text-foreground transition-all border border-white/10"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 px-4 py-3 rounded-xl font-medium text-sm bg-primary hover:bg-primary/90 text-white transition-all shadow-lg"
                    >
                        Confirm Location
                    </button>
                </div>
            </div>
        </div>
    );
}
