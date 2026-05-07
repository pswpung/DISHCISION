'use client'
import { useState, useEffect, useRef } from 'react';
import { useLiff } from '@/app/context/LiffContext';
import dynamic from 'next/dynamic';

// Dynamically import MapPicker to avoid SSR issues with Leaflet
const MapPicker = dynamic(() => import('@/app/components/map-picker/map-picker'), {
    ssr: false,
});

interface VotingFormProps {
    meetingData: any;
    restaurantConfig?: any;
    onVoteSubmit: (data: any) => void;
}

const VotingForm = ({ meetingData, restaurantConfig, onVoteSubmit }: VotingFormProps) => {
    const { profile } = useLiff();

    // Preferences State
    const [priceRange, setPriceRange] = useState<string>('Any');
    const [preferredMealTime, setPreferredMealTime] = useState<string>('Any');

    // START RESTORED CODE
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedGoodFors, setSelectedGoodFors] = useState<string[]>([]);
    const [selectedAlcohols, setSelectedAlcohols] = useState(false);
    const [selectedParking, setSelectedParking] = useState(false);

    // Location State
    const [departureLocation, setDepartureLocation] = useState('');
    const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isLocating, setIsLocating] = useState(false);

    // Restaurant Search State
    const [preferredRestaurant, setPreferredRestaurant] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Close search dropdown when clicking outside
    const searchWrapperRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
                setSearchResults([]);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [searchWrapperRef]);

    // Map picker state
    const [showMapPicker, setShowMapPicker] = useState(false);

    // Init from Config if available (optional)
    useEffect(() => {
        if (restaurantConfig) {
            // Pre-select defaults if needed, or just let user choose
        }
    }, [restaurantConfig]);

    // --- Helpers ---
    const toggleSelection = (id: string, list: string[], setList: (val: string[]) => void) => {
        if (list.includes(id)) {
            setList(list.filter(item => item !== id));
        } else {
            setList([...list, id]);
        }
    };

    // Geocoding Logic
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d;
    }

    const isLocationValid = (lat: number, lng: number) => {
        const bangkokCenter = { lat: 13.7563, lng: 100.5018 };
        const distance = calculateDistance(lat, lng, bangkokCenter.lat, bangkokCenter.lng);
        // Approx 50km radius covers Bangkok and vicinity
        return distance <= 50;
    }

    const handleCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                if (!isLocationValid(lat, lng)) {
                    alert("Location is outside of available service area (Bangkok & Vicinity)");
                    setDepartureLocation("");
                    setLocationCoords(null);
                    setIsLocating(false);
                    return;
                }

                setLocationCoords({
                    lat: lat,
                    lng: lng
                });
                setDepartureLocation("Current Location");
                setIsLocating(false);
            },
            (error) => {
                console.error("Error getting location:", error);
                alert("Unable to retrieve your location");
                setIsLocating(false);
            }
        );
    };

    const handleLocationBlur = async () => {
        if (departureLocation && departureLocation !== "Current Location") {
            // Geocoding using Nominatim
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?` +
                    `format=json&q=${encodeURIComponent(departureLocation)}` +
                    `&countrycodes=th` + // Removed strict bounding box
                    `&limit=5`
                );
                const data = await response.json();
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);

                    if (!isLocationValid(lat, lng)) {
                        alert("Location is outside of available service area (Bangkok & Vicinity)");
                        setDepartureLocation("");
                        setLocationCoords(null);
                        return;
                    }

                    setLocationCoords({
                        lat: lat,
                        lng: lng
                    });
                    console.log("Geocoded:", lat, lng);
                }
            } catch (error) {
                console.error("Geocoding failed:", error);
            }
        }
    };

    // --- Restaurant Search ---
    const handleSearch = async (keyword: string) => {
        setSearchTerm(keyword);
        if (keyword.length > 2) {
            setIsSearching(true);
            try {
                // Dynamic import to avoid circular dependency issues if any, or just direct import
                const { apiService } = await import('@/app/services/api');
                const results = await apiService.searchRestaurants(keyword);
                setSearchResults(results);
            } catch (e) {
                console.error(e);
            }
            setIsSearching(false);
        } else {
            setSearchResults([]);
        }
    };

    const selectRestaurant = (place: any) => {
        if (!preferredRestaurant.some(r => r.name === place.name)) {
            setPreferredRestaurant([...preferredRestaurant, place]);
        }
        setSearchTerm('');
        setSearchResults([]);
    };

    const removeRestaurant = (name: string) => {
        setPreferredRestaurant(preferredRestaurant.filter(r => r.name !== name));
    };
    // END RESTORED CODE

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate Location
        if (!departureLocation || departureLocation.trim() === "") {
            alert("Please provide a Departure Location.");
            return;
        }

        if (!locationCoords) {
            alert("Could not determine coordinates for the location. Please select a valid location from the search or map.");
            return;
        }

        const voteData = {
            userId: profile?.userId || 'guest',
            userName: profile?.displayName || 'Guest',

            // Preference Object matching Creator's Structure
            meal_time: preferredMealTime, // Added
            price: priceRange,
            category: selectedCategories,
            good_fors: selectedGoodFors,
            alcohols: selectedAlcohols ? true : null,
            parking: selectedParking ? true : null,

            // Location
            departureLocation,
            lat: locationCoords?.lat || null,
            lng: locationCoords?.lng || null,

            // Restaurants
            preferredRestaurant // Array of objects
        };
        onVoteSubmit(voteData);
    };

    const renderChipGroup = (label: string, items: string[], selected: string[], setSelected: (val: string[]) => void) => (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">{label}</label>
            <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                    <button
                        key={item}
                        type="button"
                        onClick={() => toggleSelection(item, selected, setSelected)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${selected.includes(item)
                            ? 'bg-primary border-primary text-white shadow-lg'
                            : 'bg-transparent border-white/10 text-muted-foreground hover:bg-white/5'
                            }`}
                    >
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );

    // Fallbacks if config not loaded
    const categories = restaurantConfig?.category || ["Japanese", "Thai", "Italian", "Chinese", "Korean", "Buffet", "Cafe", "Izakaya"];
    const goodFors = restaurantConfig?.good_fors || ["Friends", "Business", "Date", "Family", "Party"];
    const prices = restaurantConfig?.price ? [...restaurantConfig.price, 'Any'] : ['< 500', '500-1000', '1000-2000', '> 2000', 'Any'];

    return (
        <>
            <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl w-full max-w-lg mx-auto space-y-6 animate-in fade-in zoom-in duration-300">

                <div className="text-center space-y-2 pb-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                        Your Preferences
                    </h2>
                    <p className="text-xs text-muted-foreground">Tell us what you like!</p>
                </div>

                {/* Meal Time (If Meeting is Any) */}
                {meetingData.mealTime === 'Any' && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Preferred Meal Time</label>
                        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                            {['Lunch', 'Dinner', 'Any'].map((time) => (
                                <button
                                    key={time}
                                    type="button"
                                    onClick={() => setPreferredMealTime(time)}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${preferredMealTime === time
                                        ? 'bg-primary text-white shadow-lg'
                                        : 'text-muted-foreground hover:bg-white/5'
                                        }`}
                                >
                                    {time}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Price Range */}

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Budget / Person</label>
                    <select
                        value={priceRange}
                        onChange={(e) => setPriceRange(e.target.value)}
                        className="glass-input w-full p-3 rounded-xl"
                    >
                        <option value="" disabled>Select Budget...</option>
                        {prices.map((p: string) => (
                            <option key={p} value={p} className="text-black">{p}</option>
                        ))}
                    </select>
                </div>

                {/* Chips */}
                {renderChipGroup("Cuisines", categories, selectedCategories, setSelectedCategories)}
                {renderChipGroup("Good For", goodFors, selectedGoodFors, setSelectedGoodFors)}

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between glass-panel p-3 rounded-xl">
                        <span className="text-sm font-medium">Alcohol</span>
                        <input type="checkbox" checked={selectedAlcohols} onChange={e => setSelectedAlcohols(e.target.checked)} className="toggle" />
                    </div>
                    <div className="flex items-center justify-between glass-panel p-3 rounded-xl">
                        <span className="text-sm font-medium">Parking</span>
                        <input type="checkbox" checked={selectedParking} onChange={e => setSelectedParking(e.target.checked)} className="toggle" />
                    </div>
                </div>

                {/* Departure Location */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Departure Location</label>
                    <div className="relative flex gap-2">
                        <input
                            type="text"
                            placeholder="e.g. Siam Paragon (or click icon)"
                            value={departureLocation}
                            onChange={(e) => setDepartureLocation(e.target.value)}
                            onBlur={handleLocationBlur}
                            className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-primary transition-all text-sm"
                        />
                        <button
                            type="button"
                            onClick={handleCurrentLocation}
                            className="glass-button p-3 rounded-xl flex items-center justify-center hover:bg-white/10"
                            title="Use Current Location"
                        >
                            {isLocating ? (
                                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                                </svg>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowMapPicker(true)}
                            className="glass-button px-4 py-3 rounded-xl flex items-center gap-2 hover:bg-white/10 whitespace-nowrap"
                            title="Use Map"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                            </svg>
                            <span className="text-sm">Map</span>
                        </button>
                    </div>
                    {locationCoords && (
                        <p className="text-xs text-emerald-400 font-medium">
                            ✓ Coordinates set ({locationCoords.lat.toFixed(4)}, {locationCoords.lng.toFixed(4)})
                        </p>
                    )}
                </div>

                {/* Preferred Restaurant */}
                <div className="space-y-2 relative" ref={searchWrapperRef}>
                    <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Preferred Restaurants (Optional)</label>

                    <div className="flex flex-wrap gap-2 mb-2">
                        {preferredRestaurant.map((rest: any) => (
                            <span key={rest.name} className="px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-200 flex items-center gap-2">
                                {rest.name}
                                <button type="button" onClick={() => removeRestaurant(rest.name)} className="hover:text-white">×</button>
                            </span>
                        ))}
                    </div>

                    <input
                        type="text"
                        placeholder="Search & Add restaurants..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-primary transition-all text-sm"
                    />

                    {/* Search Results Dropdown */}
                    {searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-black/90 border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto backdrop-blur-md">
                            {searchResults.map((place, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => selectRestaurant(place)}
                                    className="w-full text-left px-4 py-3 hover:bg-white/10 border-b border-white/5 last:border-0 transition-colors"
                                >
                                    <p className="font-bold text-sm text-foreground">{place.name}</p>
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs text-muted-foreground truncate">
                                            {place.category?.[0]} • {place.price}
                                            {place.rating > 0 && (
                                                <span className="text-amber-500"> • ★ {Number(place.rating).toFixed(1)}</span>
                                            )}
                                        </p>
                                    </div>
                                    {place.breadcrumbs && place.breadcrumbs.length > 0 && (
                                        <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                                            📍 {place.breadcrumbs[place.breadcrumbs.length - 1]}
                                        </p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>


                <button type="submit" className="glass-button w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase mt-4">
                    Submit Preferences
                </button>
            </form>

            {/* Map Picker Modal */}
            {
                showMapPicker && (
                    <MapPicker
                        initialPosition={locationCoords || undefined}
                        onConfirm={(coords, address) => {
                            setLocationCoords(coords);
                            setDepartureLocation(address);
                        }}
                        onClose={() => setShowMapPicker(false)}
                    />
                )
            }
        </>
    )
}

export default VotingForm
