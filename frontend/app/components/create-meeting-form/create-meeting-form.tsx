'use client'
import { useState, useEffect, useRef } from 'react';
import { useLiff } from '@/app/context/LiffContext';
import { TimeSlotSelector } from '@/app/components/time-slot-selector/time-slot-selector';
import dynamic from 'next/dynamic';

// Dynamically import MapPicker to avoid SSR issues with Leaflet
const MapPicker = dynamic(() => import('@/app/components/map-picker/map-picker'), {
    ssr: false,
});

interface Attendee {
    userId: string;
    displayName: string;
    pictureUrl?: string;
}

interface MeetingData {
    name: string;
    startDate: string;
    endDate: string;
    attendees: Attendee[];
    keyPersons: Attendee[];
    mealTime: string;
    organizerId: string;
    groupId: string;
    status: 'open' | 'closed';
    // Organizer preferences
    organizerPreferences: {
        priceRange: number;
        prioritizePrice: boolean; // Just in case we need it
        meal_time?: string;
    }
    // Location Data
    departureLocation: string;
    locationCoordinates?: { lat: number; lng: number };
    preferredRestaurant: any[];
    // Availability
    availability: any;
}

interface CreateMeetingFormProps {
    attendeeList: Attendee[];
    onDataSubmit: (data: MeetingData) => void;
    initialGroupId?: string;
    initialUserId?: string;
    restaurantConfig?: any;
}

const CreateMeetingForm = (props: CreateMeetingFormProps) => {
    const { attendeeList, onDataSubmit, initialGroupId, initialUserId, restaurantConfig } = props;
    const { profile } = useLiff();
    const [meetingName, setMeetingName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [mealTime, setMealTime] = useState('Any');
    const [organizerMealTime, setOrganizerMealTime] = useState('Any');

    // Group ID
    const [groupId, setGroupId] = useState(initialGroupId || 'group-1');

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

    const [selectedAttendees, setSelectedAttendees] = useState<string[]>(initialUserId ? [initialUserId] : []);
    const [selectedKeyPersons, setSelectedKeyPersons] = useState<string[]>([]);

    // Organizer Preferences
    const [priceRange, setPriceRange] = useState<string>(''); // Default to empty for selection
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedGoodFors, setSelectedGoodFors] = useState<string[]>([]);
    const [selectedAlcohols, setSelectedAlcohols] = useState<boolean>(false);
    const [selectedParking, setSelectedParking] = useState<boolean>(false);

    // Unused for now or could be text input
    const [departureLocation, setDepartureLocation] = useState('');
    const [preferredLocation, setPreferredLocation] = useState('');

    // Changed to array of objects
    const [preferredRestaurant, setPreferredRestaurant] = useState<any[]>([]);
    const [fixedRestaurants, setFixedRestaurants] = useState<any[]>([]);
    
    // Location State
    const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isLocating, setIsLocating] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [searchTermFixed, setSearchTermFixed] = useState('');
    const [searchResultsFixed, setSearchResultsFixed] = useState<any[]>([]);
    const searchWrapperRefFixed = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchWrapperRefFixed.current && !searchWrapperRefFixed.current.contains(event.target as Node)) {
                setSearchResultsFixed([]);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [searchWrapperRefFixed]);

    // Availability
    const [availability, setAvailability] = useState<any>({});

    // Date validation
    const [dateError, setDateError] = useState('');

    // Map picker state
    const [showMapPicker, setShowMapPicker] = useState(false);

    const handleSearch = async (keyword: string) => {
        setSearchTerm(keyword);
        if (keyword.length > 2) {
            setIsSearching(true);
            try {
                const { apiService } = await import('@/app/services/api');
                // Pass priceRange for filtering
                const results = await apiService.searchRestaurants(keyword, priceRange);
                setSearchResults(results);
            } catch (e) {
                console.error(e);
            }
            setIsSearching(false);
        } else {
            setSearchResults([]);
        }
    };

    // Store full object
    const selectRestaurant = (place: any) => {
        // Check duplication by name
        if (!preferredRestaurant.some(r => r.name === place.name)) {
            setPreferredRestaurant([...preferredRestaurant, place]);
        }
        setSearchTerm('');
        setSearchResults([]);
    };

    const removeRestaurant = (name: string) => {
        setPreferredRestaurant(preferredRestaurant.filter(r => r.name !== name));
    };

    const handleSearchFixed = async (keyword: string) => {
        setSearchTermFixed(keyword);
        if (keyword.length > 2) {
            try {
                const { apiService } = await import('@/app/services/api');
                const results = await apiService.searchRestaurants(keyword, priceRange);
                setSearchResultsFixed(results);
            } catch (e) {
                console.error(e);
            }
        } else {
            setSearchResultsFixed([]);
        }
    };

    const selectFixedRestaurant = (place: any) => {
        if (!fixedRestaurants.some(r => r.name === place.name)) {
            setFixedRestaurants([...fixedRestaurants, place]);
        }
        setSearchTermFixed('');
        setSearchResultsFixed([]);
    };

    const removeFixedRestaurant = (name: string) => {
        setFixedRestaurants(fixedRestaurants.filter(r => r.name !== name));
    };

    // Date validation helpers
    const getTodayString = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    const getMaxEndDate = () => {
        if (!startDate) return '';
        const start = new Date(startDate);
        const maxEnd = new Date(start);
        maxEnd.setDate(maxEnd.getDate() + 7);
        return maxEnd.toISOString().split('T')[0];
    };

    // Validate date range
    useEffect(() => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffMs = end.getTime() - start.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);

            if (diffDays > 7) {
                setDateError('Date range cannot exceed 7 days');
            } else if (diffDays < 0) {
                setDateError('End date must be after start date');
            } else {
                setDateError('');
            }
        } else {
            setDateError('');
        }
    }, [startDate, endDate]);

    const toggleSelection = (id: string, list: string[], setList: (val: string[]) => void) => {
        if (list.includes(id)) {
            setList(list.filter(item => item !== id));
        } else {
            setList([...list, id]);
        }
    };

    const handleToggleAttendee = (id: string) => {
        if (selectedAttendees.includes(id)) {
            // Un-inviting them also revokes key person status
            setSelectedAttendees(selectedAttendees.filter(item => item !== id));
            setSelectedKeyPersons(selectedKeyPersons.filter(item => item !== id));
        } else {
            setSelectedAttendees([...selectedAttendees, id]);
        }
    };

    const handleToggleKeyPerson = (id: string) => {
        if (selectedKeyPersons.includes(id)) {
            // Removing from key persons leaves them in attendees
            setSelectedKeyPersons(selectedKeyPersons.filter(item => item !== id));
        } else {
            // Adding as key person automatically invites them
            setSelectedKeyPersons([...selectedKeyPersons, id]);
            if (!selectedAttendees.includes(id)) {
                setSelectedAttendees([...selectedAttendees, id]);
            }
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
                    `&countrycodes=th` + // Removed strict bounding box to allow user input, validation happens after
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


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // 0. Validation: Date Range
        if (dateError) {
            alert(dateError);
            return;
        }

        // 1. Validation: Mandatory Location (Only if no fixed restaurants)
        if (fixedRestaurants.length === 0) {
            if (!departureLocation || departureLocation.trim() === "") {
                alert("Please provide a Departure Location.");
                return;
            }

            if (!locationCoords) {
                alert("Could not determine coordinates for the location. Please select a valid location from the search or map.");
                return;
            }
        }

        // 2. Validation: At least one time slot
        const hasTimeSlots = Object.values(availability).some((slots: any) => slots.length > 0);
        if (!hasTimeSlots) {
            alert("Please select at least one available time slot.");
            return;
        }

        // 3. Validation: Overlapping Time Slots
        for (const [date, slots] of Object.entries(availability)) {
            const sortedSlots = (slots as any[]).sort((a, b) => a.start.localeCompare(b.start));
            for (let i = 0; i < sortedSlots.length - 1; i++) {
                const currentEnd = sortedSlots[i].end;
                const nextStart = sortedSlots[i + 1].start;
                if (currentEnd > nextStart) {
                    alert(`Time slots overlap on ${date}: ${sortedSlots[i].start}-${currentEnd} overlaps with ${nextStart}-${sortedSlots[i + 1].end}`);
                    return;
                }
            }
        }

        const attendees = attendeeList.filter(a => selectedAttendees.includes(a.userId));
        const keyPersons = attendeeList.filter(a => selectedKeyPersons.includes(a.userId));

        // Construct Data matching valid JSON for "preference" as requested
        const organizerPreferences = {
            meal_time: organizerMealTime,
            price: priceRange || "Any", // Default or validation needed
            category: selectedCategories,
            good_fors: selectedGoodFors,
            alcohols: selectedAlcohols ? true : null,
            parking: selectedParking ? true : null,
        };

        const meetingData: MeetingData = {
            name: meetingName,
            startDate,
            endDate,
            attendees,
            keyPersons,
            mealTime,
            fixedRestaurants,
            organizerId: initialUserId || profile?.userId || 'guest-organizer',
            groupId: groupId,
            status: 'open',
            organizerPreferences: organizerPreferences as any,
            departureLocation,
            locationCoordinates: locationCoords || undefined,
            preferredRestaurant,
            availability
        };

        if (onDataSubmit) {
            onDataSubmit(meetingData);
        }
    };

    // Helper for rendering chip selections
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

    return (
        <>
            <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl w-full max-w-lg mx-auto space-y-6 animate-in fade-in zoom-in duration-300">

                {/* General Info Section */}
                <div className="space-y-4 pb-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                        1. Meeting Details
                    </h2>

                    {/* Meeting Name */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Topic</label>
                        <input
                            type="text"
                            placeholder="e.g. Friday Night Dinner"
                            value={meetingName}
                            onChange={(e) => setMeetingName(e.target.value)}
                            required
                            className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-primary transition-all"
                        />
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Start</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                min={getTodayString()}
                                required
                                className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-primary transition-all text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">End</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={startDate || getTodayString()}
                                max={getMaxEndDate()}
                                required
                                className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-primary transition-all text-sm"
                            />
                        </div>
                    </div>
                    {dateError && (
                        <div className="text-red-400 text-sm mt-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                            ⚠️ {dateError}
                        </div>
                    )}

                    {/* Meal Time */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Meal Time</label>
                        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                            {['Lunch', 'Dinner', 'Any'].map((time) => (
                                <button
                                    key={time}
                                    type="button"
                                    onClick={() => setMealTime(time)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mealTime === time
                                        ? 'bg-primary text-white shadow-lg'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/10'
                                        }`}
                                >
                                    {time}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Attendees */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Invite Friends</label>
                        <div className="flex flex-wrap gap-2">
                            {attendeeList.map((attendee) => (
                                <button
                                    key={attendee.userId}
                                    type="button"
                                    onClick={() => handleToggleAttendee(attendee.userId)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-2 ${selectedAttendees.includes(attendee.userId)
                                        ? 'bg-primary border-primary text-white shadow-md'
                                        : 'bg-transparent border-white/10 text-muted-foreground hover:border-white/30 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-purple-400 to-pink-400"></div>
                                    {attendee.displayName}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Key Persons */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Key Decision Makers</label>
                        <div className="flex flex-wrap gap-2">
                            {attendeeList.map((attendee) => (
                                <button
                                    key={attendee.userId}
                                    type="button"
                                    onClick={() => handleToggleKeyPerson(attendee.userId)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-2 ${selectedKeyPersons.includes(attendee.userId)
                                        ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                                        : 'bg-transparent border-white/10 text-muted-foreground hover:border-white/30 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-300 to-orange-400"></div>
                                    {attendee.displayName}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* List of Selected Restaurants */}
                    <div className="space-y-2 relative" ref={searchWrapperRefFixed}>
                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">List of Selected Restaurants (Optional)</label>

                        {/* Selected Restaurants Chips */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            {fixedRestaurants.length > 0 && fixedRestaurants.map((rest: any) => (
                                <span key={rest.name} className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-200 flex items-center gap-2">
                                    {rest.name}
                                    <button type="button" onClick={() => removeFixedRestaurant(rest.name)} className="hover:text-emerald-900 dark:hover:text-white transition-colors">×</button>
                                </span>
                            ))}
                        </div>

                        <input
                            type="text"
                            placeholder="Search & Add restaurants..."
                            value={searchTermFixed}
                            onChange={(e) => handleSearchFixed(e.target.value)}
                            className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-primary transition-all text-sm"
                        />

                        {/* Search Results Dropdown */}
                        {searchResultsFixed.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-black/90 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto backdrop-blur-md">
                                {searchResultsFixed.map((place, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => selectFixedRestaurant(place)}
                                        className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/10 border-b border-gray-100 dark:border-white/5 last:border-0 transition-colors"
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
                </div>

                {/* Availability Section (New) */}
                <div className="space-y-4 pb-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                        2. Availability
                    </h2>
                    <p className="text-sm text-muted-foreground">Select the times you are free.</p>

                    {startDate && endDate ? (
                        <TimeSlotSelector
                            startDate={startDate}
                            endDate={endDate}
                            value={availability}
                            onChange={setAvailability}
                        />
                    ) : (
                        <div className="text-sm text-yellow-500/80 bg-yellow-500/10 p-3 rounded-xl border border-yellow-500/20">
                            Please select Start and End dates first.
                        </div>
                    )}
                </div>

                {/* Organizer Preferences Section */}
                {fixedRestaurants.length === 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                        3. Your Preferences
                    </h2>

                    {/* Preferred Meal Time (If Meeting is Any) */}
                    {mealTime === 'Any' && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Preferred Meal Time</label>
                            <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                                {['Lunch', 'Dinner', 'Any'].map((time) => (
                                    <button
                                        key={time}
                                        type="button"
                                        onClick={() => setOrganizerMealTime(time)}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${organizerMealTime === time
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
                            {props.restaurantConfig?.price?.map((p: string) => (
                                <option key={p} value={p} className="text-black">{p}</option>
                            ))}
                        </select>
                    </div>

                    {/* Food Types / Categories */}
                    {renderChipGroup("Cuisine", props.restaurantConfig?.category || [], selectedCategories, setSelectedCategories)}

                    {/* Good Fors / Vibe */}
                    {renderChipGroup("Vibe / Good For", props.restaurantConfig?.good_fors || [], selectedGoodFors, setSelectedGoodFors)}


                    <div className="grid grid-cols-2 gap-4">
                        {/* Alcohols */}
                        <div className="flex items-center justify-between glass-panel p-3 rounded-xl">
                            <span className="text-sm font-medium">Alcohol</span>
                            <input type="checkbox" checked={selectedAlcohols} onChange={e => setSelectedAlcohols(e.target.checked)} className="toggle" />
                        </div>
                        {/* Parking */}
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
                                onBlur={handleLocationBlur} // Trigger geocoding when user leaves field
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


                    {/* Preferred Restaurant with Search */}
                    <div className="space-y-2 relative" ref={searchWrapperRef}>
                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Preferred Restaurants (Optional)</label>

                            {/* Selected Restaurants Chips */}
                            <div className="flex flex-wrap gap-2 mb-2">
                                {preferredRestaurant.length > 0 && preferredRestaurant.map((rest: any) => (
                                    <span key={rest.name} className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-200 flex items-center gap-2">
                                        {rest.name}
                                        <button type="button" onClick={() => removeRestaurant(rest.name)} className="hover:text-emerald-900 dark:hover:text-white transition-colors">×</button>
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
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-black/90 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto backdrop-blur-md">
                                    {searchResults.map((place, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => selectRestaurant(place)}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/10 border-b border-gray-100 dark:border-white/5 last:border-0 transition-colors"
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
                </div>
                )}

                <button type="submit" className="glass-button w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase mt-8">
                    Create & Vote
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
                )}
        </>
    )
}

export default CreateMeetingForm
