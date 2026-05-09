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
    const [avoidCategories, setAvoidCategories] = useState<string[]>([]);
    const [selectedAlcohols, setSelectedAlcohols] = useState(false);
    const [selectedParking, setSelectedParking] = useState(false);

    // Location State
    const [departureLocation, setDepartureLocation] = useState('');
    const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [mapPickerTarget, setMapPickerTarget] = useState<'fix' | 'prefer'>('fix');

    // Restaurant Search State
    const [preferredRestaurant, setPreferredRestaurant] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [priceFocused, setPriceFocused] = useState(false);
    const [cuisineFocused, setCuisineFocused] = useState(false);
    const [avoidCuisineFocused, setAvoidCuisineFocused] = useState(false);
    
    const priceRef = useRef<HTMLDivElement>(null);
    const cuisineSearchRef = useRef<HTMLDivElement>(null);
    const avoidCuisineSearchRef = useRef<HTMLDivElement>(null);

    // Search Terms
    const [cuisineSearchTerm, setCuisineSearchTerm] = useState('');
    const [avoidCuisineSearchTerm, setAvoidCuisineSearchTerm] = useState('');

    // Close search dropdown when clicking outside
    const searchWrapperRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
                setSearchResults([]);
            }
            if (priceRef.current && !priceRef.current.contains(event.target as Node)) {
                setPriceFocused(false);
            }
            if (cuisineSearchRef.current && !cuisineSearchRef.current.contains(event.target as Node)) {
                setCuisineFocused(false);
                setCuisineSearchTerm('');
            }
            if (avoidCuisineSearchRef.current && !avoidCuisineSearchRef.current.contains(event.target as Node)) {
                setAvoidCuisineFocused(false);
                setAvoidCuisineSearchTerm('');
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
            meal_time: preferredMealTime,
            price: priceRange,
            category: selectedCategories,
            avoid_categories: avoidCategories,
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

    // Helper for rendering dropdown selections
    const renderDropdown = (
        label: string,
        value: string,
        onChange: (val: string) => void,
        items: string[],
        isOpen: boolean,
        setIsOpen: (val: boolean) => void,
        wrapperRef: React.RefObject<HTMLDivElement>
    ) => {
        return (
            <div className="space-y-2 relative" ref={wrapperRef}>
                <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">{label}</label>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="glass-input w-full p-3 rounded-xl text-left text-sm font-medium flex justify-between items-center transition-all hover:bg-white/5"
                >
                    <span className={value && value !== "Any" ? "text-gray-800 dark:text-white" : "text-muted-foreground"}>
                        {value === "Any" ? "Select Budget..." : value}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        {items.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => {
                                    onChange(item);
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-5 py-4 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5 last:border-0 transition-colors group"
                            >
                                <p className={`font-bold text-sm ${value === item ? 'text-primary' : 'text-gray-800 dark:text-white'} group-hover:text-primary transition-colors`}>{item}</p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderSearchableChipGroup = (
        label: string,
        items: string[],
        selected: string[],
        setSelected: (val: string[]) => void,
        searchTerm: string,
        setSearchTerm: (val: string) => void,
        placeholder: string,
        wrapperRef: React.RefObject<HTMLDivElement>,
        isFocused: boolean,
        setIsFocused: (val: boolean) => void,
        forbiddenItems: string[] = [],
        variant: 'positive' | 'negative' = 'positive'
    ) => {
        const filteredItems = items.filter(item =>
            item.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !selected.includes(item) &&
            !forbiddenItems.includes(item)
        );

        const chipStyles = variant === 'positive'
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : "bg-rose-500/10 border-rose-500/20 text-rose-400";

        return (
            <div className="space-y-2 relative" ref={wrapperRef}>
                <label className={`block text-sm font-medium uppercase tracking-wider ${variant === 'positive' ? 'text-emerald-500' : 'text-rose-500'}`}>{label}</label>

                {/* Selected Chips */}
                <div className="flex flex-wrap gap-2 mb-2">
                    {selected.map((item) => (
                        <span key={item} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 ${chipStyles}`}>
                            {item}
                            <button type="button" onClick={() => setSelected(selected.filter(i => i !== item))} className="hover:text-white transition-colors">×</button>
                        </span>
                    ))}
                </div>

                <input
                    type="text"
                    placeholder={placeholder}
                    value={searchTerm}
                    onFocus={() => setIsFocused(true)}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="glass-input w-full p-4 rounded-xl text-sm font-medium transition-all focus:ring-2 focus:ring-primary/20"
                />

                {/* Search Results Dropdown */}
                {isFocused && filteredItems.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        {filteredItems.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => {
                                    setSelected([...selected, item]);
                                    setSearchTerm('');
                                    setIsFocused(false);
                                }}
                                className="w-full text-left px-5 py-4 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5 last:border-0 transition-colors group"
                            >
                                <p className="font-bold text-sm text-gray-800 dark:text-white group-hover:text-primary transition-colors">{item}</p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${selected.includes(item)
                            ? 'bg-primary border-primary text-white shadow-lg'
                            : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'
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
            <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto space-y-6">
                {/* Header (Optional, but keeping for standalone use) */}
                <div className="space-y-2 pb-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tracking-tight">
                        Your Preferences
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Set your personal filter for this meeting</p>
                </div>

                {/* Preferences Content - Only show if no fixed restaurants */}
                {meetingData?.fixedRestaurants?.length === 0 && (
                    <div className="space-y-6">
                        {/* System Suggestion Preferences (Hide if allowSystemSuggest is false) */}
                        {meetingData.allowSystemSuggest !== false && (
                            <>
                                {/* Meal Time (If Meeting is Any and Timing is not Fixed) */}
                                {meetingData.mealTime === 'Any' && meetingData.timingMode !== 'fixed' && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Preferred Meal Time</label>
                                        <div className="flex bg-white/5 rounded-xl p-1 gap-1 border border-white/5">
                                            {['Lunch', 'Dinner', 'Any'].map((time) => (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    onClick={() => setPreferredMealTime(time)}
                                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${preferredMealTime === time ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:bg-white/5'}`}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                        {/* Price Range */}
                        {renderDropdown(
                            "Budget / Person",
                            priceRange,
                            setPriceRange,
                            restaurantConfig?.price ? [...restaurantConfig.price, 'Any'] : ['< 500', '500-1000', '1000-2000', '> 2000', 'Any'],
                            priceFocused,
                            setPriceFocused,
                            priceRef
                        )}

                        <div className="space-y-5">
                            {renderSearchableChipGroup("Prefer Cuisine", categories, selectedCategories, setSelectedCategories, cuisineSearchTerm, setCuisineSearchTerm, "Search cuisines...", cuisineSearchRef, cuisineFocused, setCuisineFocused, avoidCategories)}
                            {renderSearchableChipGroup("Avoid Cuisine", categories, avoidCategories, setAvoidCategories, avoidCuisineSearchTerm, setAvoidCuisineSearchTerm, "Avoid cuisines...", avoidCuisineSearchRef, avoidCuisineFocused, setAvoidCuisineFocused, selectedCategories, 'negative')}
                        </div>

                        {renderChipGroup("Vibe / Good For", goodFors, selectedGoodFors, setSelectedGoodFors)}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center justify-between glass-panel p-3 rounded-xl border border-white/5">
                                <span className="text-sm font-medium uppercase tracking-wider">Alcohol</span>
                                <input type="checkbox" checked={selectedAlcohols} onChange={e => setSelectedAlcohols(e.target.checked)} className="toggle" />
                            </div>
                            <div className="flex items-center justify-between glass-panel p-3 rounded-xl border border-white/5">
                                <span className="text-sm font-medium uppercase tracking-wider">Parking</span>
                                <input type="checkbox" checked={selectedParking} onChange={e => setSelectedParking(e.target.checked)} className="toggle" />
                            </div>
                        </div>

                        {!meetingData?.fixLocation && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Prefer Location</label>
                                <div className="relative flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="e.g. Siam Paragon"
                                        value={departureLocation}
                                        onChange={(e) => setDepartureLocation(e.target.value)}
                                        onBlur={handleLocationBlur}
                                        className="glass-input w-full p-3 rounded-xl text-sm font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setMapPickerTarget('prefer'); setShowMapPicker(true); }}
                                        className="glass-button px-4 py-3 rounded-xl hover:bg-white/10 transition-all"
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
                                </div>
                            </div>
                        )}
                    </>
                )}
                    </div>
                )}


                {/* Preferred Restaurant */}
                {meetingData?.allowOthersSuggest && (
                    <div className="space-y-4 pt-6 border-t border-white/10">
                        <div className="space-y-3 relative" ref={searchWrapperRef}>
                            <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Add Suggested Restaurants (Optional)</label>

                            <div className="flex flex-wrap gap-2 mb-2">
                                {preferredRestaurant.map((rest: any) => (
                                    <span key={rest.name} className="px-3 py-1.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                                        {rest.name}
                                        <button type="button" onClick={() => removeRestaurant(rest.name)} className="text-xs hover:text-white transition-colors">×</button>
                                    </span>
                                ))}
                            </div>

                            <input
                                type="text"
                                placeholder="Search venues..."
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="glass-input w-full p-3 rounded-xl text-sm font-medium"
                            />

                            {/* Search Results Dropdown */}
                            {searchResults.length > 0 && (
                                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                                    {searchResults.map((place, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => selectRestaurant(place)}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5 last:border-0 transition-colors"
                                        >
                                            <p className="font-bold text-sm text-primary dark:text-white">{place.name}</p>
                                            <p className="text-[10px] text-gray-500 dark:text-muted-foreground">{place.category?.[0]} • {place.price}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}


                <button type="submit" className="glass-button w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase shadow-lg shadow-primary/10 mt-6 active:scale-[0.98] transition-all">
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
