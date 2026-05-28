'use client'
import { useState, useEffect, useRef } from 'react';
import { useLiff } from '@/app/context/LiffContext';
import { TimeSlotSelector } from '@/app/components/time-slot-selector/time-slot-selector';
import dynamic from 'next/dynamic';
import { apiService } from '@/app/services/api';

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
        priorities?: string[];
    }
    // Location Data
    fixLocation?: string;
    fixLocationCoords?: { lat: number; lng: number };
    departureLocation: string;
    locationCoordinates?: { lat: number; lng: number };
    preferredRestaurant: any[];
    // Availability
    availability: any;
    keyDecisionRatio?: number;
    // New Timing Fields
    timingMode?: 'period' | 'fixed';
    fixedDate?: string;
    fixedStartTime?: string;
    fixedEndTime?: string;
    allowSystemSuggest?: boolean;
    requireAllJoin?: boolean;
    allowOthersSuggest?: boolean;
    suggest_per_time?: boolean;
    fixedRestaurants?: any[];
}

interface CreateMeetingFormProps {
    attendeeList: Attendee[];
    onDataSubmit: (data: MeetingData) => void;
    initialGroupId?: string;
    initialUserId?: string;
    restaurantConfig?: any;
}

const getRankLabel = (index: number): string => {
    const suffixes = ["st", "nd", "rd"];
    const v = index + 1;
    if (v >= 11 && v <= 13) return `${v}th`;
    const lastDigit = v % 10;
    const suffix = suffixes[lastDigit - 1] || "th";
    return `${v}${suffix}`;
};

const CreateMeetingForm = (props: CreateMeetingFormProps) => {
    const { attendeeList, onDataSubmit, initialGroupId, initialUserId } = props;
    
    useEffect(() => {
        console.log("CreateMeetingForm: Received attendeeList:", attendeeList.map(a => `${a.displayName} (${a.userId})`));
    }, [attendeeList]);

    const { profile } = useLiff();
    const [currentStep, setCurrentStep] = useState(0);
    const [meetingName, setMeetingName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [mealTime, setMealTime] = useState('Any');
    const [organizerMealTime, setOrganizerMealTime] = useState('Any');

    // Timing Mode
    const [timingMode, setTimingMode] = useState<'period' | 'fixed'>('period');
    const [fixedDate, setFixedDate] = useState('');
    const [fixedStartTime, setFixedStartTime] = useState('');
    const [fixedEndTime, setFixedEndTime] = useState('');

    // Group ID
    const [groupId, setGroupId] = useState(initialGroupId || 'group-1');

    // Sync organizer's preference with meeting's global meal time
    useEffect(() => {
        if (mealTime !== 'Any') {
            setOrganizerMealTime(mealTime);
        }
    }, [mealTime]);

    // Navigation Logic
    const handleNext = () => {
        if (currentStep === 0) {
            // Validate Step 0
            if (!meetingName.trim()) {
                alert("Please enter a meeting topic.");
                return;
            }
            if (selectedAttendees.length < 2) {
                alert("A meeting must have at least 2 participants (including yourself). Please invite at least one friend.");
                return;
            }
            if (timingMode === 'period') {
                if (!startDate || !endDate) {
                    alert("Please select start and end dates.");
                    return;
                }
                if (dateError) {
                    alert(dateError);
                    return;
                }
                setCurrentStep(1);
            } else {
                if (!fixedDate || !fixedStartTime || !fixedEndTime) {
                    alert("Please select date and time for the fixed meeting.");
                    return;
                }
                setCurrentStep(2); // Skip Step 1 for Fixed Mode
            }
        } else if (currentStep === 1) {
            // Validate Step 1: Availability
            const hasTimeSlots = Object.values(availability).some((slots: any) => slots.length > 0);
            if (!hasTimeSlots) {
                alert("Please select at least one available time slot.");
                return;
            }
            setCurrentStep(2);
        }
    };

    const handleBack = () => {
        if (currentStep === 2 && timingMode === 'fixed') {
            setCurrentStep(0);
        } else if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

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
    const [keyPersonRatio, setKeyPersonRatio] = useState<number>(70);

    // Sync effect to keep organizer in selectedAttendees
    useEffect(() => {
        if (initialUserId && !selectedAttendees.includes(initialUserId)) {
            setSelectedAttendees(prev => {
                if (!prev.includes(initialUserId)) {
                    return [...prev, initialUserId];
                }
                return prev;
            });
        }
    }, [initialUserId]);

    // Organizer Preferences
    const [priceRange, setPriceRange] = useState<string>(''); // Default to empty for selection
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [avoidCategories, setAvoidCategories] = useState<string[]>([]);
    const [selectedGoodFors, setSelectedGoodFors] = useState<string[]>([]);
    const [selectedAlcohols, setSelectedAlcohols] = useState<boolean>(false);
    const [selectedParking, setSelectedParking] = useState<boolean>(false);
    const [allowSystemSuggest, setAllowSystemSuggest] = useState<boolean>(true);
    const [requireAllJoin, setRequireAllJoin] = useState<boolean>(true);
    const [allowOthersSuggest, setAllowOthersSuggest] = useState<boolean>(true);
    const [suggest_per_time, setSuggestPerTime] = useState<boolean>(false);
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
    const [prioritiesMode, setPrioritiesMode] = useState<'normal' | 'advanced'>('normal');
    const [normalPriorities, setNormalPriorities] = useState<string[]>([]);
    const [advancedPriorities, setAdvancedPriorities] = useState<string[][]>([]);
    const [maxWalkDistance, setMaxWalkDistance] = useState<number>(1000);
    const priorityFactors = ['Price', 'Category', 'Vibe/Good For', 'Distance from BTS', 'Rating', 'Parking', 'Alcohol'];

    const [isDragging, setIsDragging] = useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<{ index: number; type: 'tie' | 'insert' | 'pool' } | null>(null);

    // Unused for now or could be text input
    const [fixLocation, setFixLocation] = useState('');
    const [departureLocation, setDepartureLocation] = useState('Current Location');

    // Changed to array of objects
    const [preferredRestaurant, setPreferredRestaurant] = useState<any[]>([]);
    const [fixedRestaurants, setFixedRestaurants] = useState<any[]>([]);

    // Location State
    const [fixLocationCoords, setFixLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [mapPickerTarget, setMapPickerTarget] = useState<'fix' | 'prefer'>('fix');
    const [isLocating, setIsLocating] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [searchTermFixed, setSearchTermFixed] = useState('');
    const [searchResultsFixed, setSearchResultsFixed] = useState<any[]>([]);
    const searchWrapperRefFixed = useRef<HTMLDivElement>(null);
    const [cuisineSearchTerm, setCuisineSearchTerm] = useState('');
    const [avoidCuisineSearchTerm, setAvoidCuisineSearchTerm] = useState('');
    const [cuisineFocused, setCuisineFocused] = useState(false);
    const [avoidCuisineFocused, setAvoidCuisineFocused] = useState(false);
    const [priceFocused, setPriceFocused] = useState(false);
    const cuisineSearchRef = useRef<HTMLDivElement>(null);
    const avoidCuisineSearchRef = useRef<HTMLDivElement>(null);
    const priceRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchWrapperRefFixed.current && !searchWrapperRefFixed.current.contains(event.target as Node)) {
                setSearchResultsFixed([]);
            }
            if (cuisineSearchRef.current && !cuisineSearchRef.current.contains(event.target as Node)) {
                setCuisineSearchTerm('');
                setCuisineFocused(false);
            }
            if (avoidCuisineSearchRef.current && !avoidCuisineSearchRef.current.contains(event.target as Node)) {
                setAvoidCuisineSearchTerm('');
                setAvoidCuisineFocused(false);
            }
            if (priceRef.current && !priceRef.current.contains(event.target as Node)) {
                setPriceFocused(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [searchWrapperRefFixed, cuisineSearchRef, avoidCuisineSearchRef]);

    // Availability
    const [availability, setAvailability] = useState<any>({});

    // Auto-fetch Current Location
    useEffect(() => {
        if (departureLocation === 'Current Location' && !locationCoords) {
            setIsLocating(true);
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        setLocationCoords({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude
                        });
                        setIsLocating(false);
                    },
                    (err) => {
                        console.warn("Location fetch failed, using default (Bangkok Center):", err);
                        // Fallback to Bangkok Center if fetch fails
                        setLocationCoords({ lat: 13.7563, lng: 100.5018 });
                        setIsLocating(false);
                    },
                    { 
                        enableHighAccuracy: false, // Better for LINE/Android
                        timeout: 15000, 
                        maximumAge: 60000 // Use cached location if available
                    }
                );
            } else {
                // Fallback if not supported
                setLocationCoords({ lat: 13.7563, lng: 100.5018 });
                setIsLocating(false);
            }
        }
    }, [departureLocation, locationCoords]);
    useEffect(() => {
        if (timingMode === 'fixed' && fixedDate && fixedStartTime && fixedEndTime) {
            setStartDate(fixedDate);
            setEndDate(fixedDate);
            setAvailability({
                [fixedDate]: [{ start: fixedStartTime, end: fixedEndTime }]
            });
        }
    }, [timingMode, fixedDate, fixedStartTime, fixedEndTime]);


    // Reset suggest_per_time when switching to fixed mode
    useEffect(() => {
        if (timingMode === 'fixed') {
            setSuggestPerTime(false);
        }
    }, [timingMode]);

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
        setFixedRestaurants([place]);
        setSearchTermFixed('');
        setSearchResultsFixed([]);
        setAllowOthersSuggest(false);
        setAllowSystemSuggest(false);
    };

    const removeFixedRestaurant = (name: string) => {
        setFixedRestaurants(fixedRestaurants.filter(r => r.name !== name));
        setAllowOthersSuggest(true);
        setAllowSystemSuggest(true);
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

    const handleClearLocation = (target: 'fix' | 'prefer' = 'prefer') => {
        if (target === 'fix') {
            setFixLocation("");
            setFixLocationCoords(null);
        } else {
            setDepartureLocation("");
            setLocationCoords(null);
        }
    };

    const handleLocationBlur = async (target: 'fix' | 'prefer' = 'prefer') => {
        const val = target === 'fix' ? fixLocation : departureLocation;
        if (val && val !== "Current Location") {
            // Geocoding using Nominatim
            try {
                const data = await apiService.searchLocation(val);
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);

                    if (!isLocationValid(lat, lng)) {
                        alert("Location is outside of available service area (Bangkok & Vicinity)");
                        if (target === 'fix') {
                            setFixLocation("");
                            setFixLocationCoords(null);
                        } else {
                            setDepartureLocation("");
                            setLocationCoords(null);
                        }
                        return;
                    }

                    if (target === 'fix') {
                        setFixLocationCoords({ lat, lng });
                    } else {
                        setLocationCoords({ lat, lng });
                    }
                    console.log("Geocoded:", lat, lng);
                }
            } catch (error) {
                console.error("Geocoding failed:", error);
            }
        }
    };


    const getSerializedPriorities = (): string[][] => {
        if (prioritiesMode === 'normal') {
            return normalPriorities.map(factor => [factor]);
        } else {
            return advancedPriorities.filter(group => group.length > 0);
        }
    };

    const isFactorActive = (factor: string): boolean => {
        if (prioritiesMode === 'normal') {
            return normalPriorities.includes(factor);
        } else {
            return advancedPriorities.some(group => group.includes(factor));
        }
    };

    const getActivePrioritiesCount = (): number => {
        if (prioritiesMode === 'normal') {
            return normalPriorities.length;
        } else {
            return advancedPriorities.reduce((acc, group) => acc + group.length, 0);
        }
    };

    const toggleNormalPriority = (factor: string) => {
        setNormalPriorities(prev => {
            if (prev.includes(factor)) {
                return prev.filter(f => f !== factor);
            } else {
                return [...prev, factor];
            }
        });
    };

    const toggleAdvancedPriority = (factor: string) => {
        const isSelected = advancedPriorities.some(group => group.includes(factor));
        if (isSelected) {
            setAdvancedPriorities(prev => 
                prev.map(group => group.filter(p => p !== factor)).filter(group => group.length > 0)
            );
        } else {
            setAdvancedPriorities(prev => [...prev, [factor]]);
        }
    };

    const removeAdvancedPriority = (factor: string) => {
        setAdvancedPriorities(prev => 
            prev.map(group => group.filter(p => p !== factor)).filter(group => group.length > 0)
        );
    };

    const handleDropFactor = (factor: string, targetIndex: number, type: 'tie' | 'insert' | 'remove') => {
        setAdvancedPriorities(prev => {
            const sourceGroupIndex = prev.findIndex(group => group.includes(factor));
            let adjustedTargetIndex = targetIndex;
            if (sourceGroupIndex !== -1 && prev[sourceGroupIndex].length === 1) {
                if (targetIndex > sourceGroupIndex) {
                    adjustedTargetIndex = targetIndex - 1;
                }
            }

            // Remove factor from all groups
            let cleaned = prev.map(group => group.filter(f => f !== factor)).filter(group => group.length > 0);
            
            if (type === 'remove') {
                return cleaned;
            }
            
            if (type === 'tie') {
                const next = [...cleaned];
                if (adjustedTargetIndex >= 0 && adjustedTargetIndex < next.length) {
                    next[adjustedTargetIndex] = [...next[adjustedTargetIndex], factor];
                } else {
                    next.push([factor]);
                }
                return next;
            }
            
            if (type === 'insert') {
                const next = [...cleaned];
                next.splice(adjustedTargetIndex, 0, [factor]);
                return next;
            }
            
            return cleaned;
        });
    };

    const handleDragStart = (e: React.DragEvent, factor: string) => {
        e.dataTransfer.setData("text/plain", factor);
        setIsDragging(factor);
    };

    const handleDragEnd = () => {
        setIsDragging(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e: React.DragEvent, index: number, type: 'tie' | 'insert' | 'pool') => {
        e.preventDefault();
        setDragOverIndex({ index, type });
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number, type: 'tie' | 'insert' | 'pool') => {
        e.preventDefault();
        const factor = e.dataTransfer.getData("text/plain");
        if (!factor) return;

        setDragOverIndex(null);
        setIsDragging(null);

        if (type === 'pool') {
            handleDropFactor(factor, -1, 'remove');
        } else {
            handleDropFactor(factor, targetIndex, type);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedAttendees.length < 2) {
            alert("A meeting must have at least 2 participants (including yourself). Please invite at least one friend.");
            return;
        }

        // 1. Validation: Mandatory Location (Only if no fixed restaurants)
        const activeLocation = fixLocation || departureLocation;
        const activeCoords = fixLocationCoords || locationCoords;

        if (fixedRestaurants.length === 0) {
            if (!activeLocation || activeLocation.trim() === "") {
                alert("Please provide a Meeting Location or Prefer Location.");
                return;
            }

            if (!activeCoords) {
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
            avoid_categories: avoidCategories,
            good_fors: selectedGoodFors,
            alcohols: selectedAlcohols,
            parking: selectedParking,
            priorities: getSerializedPriorities(),
            max_walk_distance: maxWalkDistance
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
            fixLocation,
            fixLocationCoords: fixLocationCoords || undefined,
            departureLocation,
            locationCoordinates: locationCoords || undefined,
            preferredRestaurant,
            availability,
            keyDecisionRatio: keyPersonRatio,
            // Timing Mode Fields
            timingMode,
            fixedDate,
            fixedStartTime,
            fixedEndTime,
            allowSystemSuggest: fixedRestaurants.length === 0 ? true : allowSystemSuggest,
            requireAllJoin: requireAllJoin,
            allowOthersSuggest: allowOthersSuggest,
            suggest_per_time: suggest_per_time
        };

        if (onDataSubmit) {
            onDataSubmit(meetingData);
        }
    };

    // Helper for rendering chip selections
    const renderDropdown = (
        label: string,
        value: string,
        onChange: (val: string) => void,
        items: string[],
        isOpen: boolean,
        setIsOpen: (val: boolean) => void,
        wrapperRef: React.RefObject<HTMLDivElement | null>
    ) => {
        return (
            <div className="space-y-2 relative" ref={wrapperRef}>
                <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">{label}</label>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="glass-input w-full p-3 rounded-xl text-left text-sm font-medium flex justify-between items-center"
                >
                    <span className={value && value !== "" ? "text-foreground" : "text-muted-foreground"}>
                        {value || "Select Budget..."}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-dropdown-bg border border-dropdown-border rounded-xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        {items.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => {
                                    onChange(item);
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-5 py-4 hover:bg-dropdown-hover border-b border-dropdown-border last:border-0 transition-colors group"
                            >
                                <p className={`font-bold text-sm ${value === item ? 'text-primary' : 'text-foreground'} group-hover:text-primary transition-colors`}>{item}</p>
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

    const renderSearchableChipGroup = (
        label: string,
        items: string[],
        selected: string[],
        setSelected: (val: string[]) => void,
        searchTerm: string,
        setSearchTerm: (val: string) => void,
        placeholder: string,
        wrapperRef: React.RefObject<HTMLDivElement | null>,
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
                    {selected.length > 0 && selected.map((item) => (
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
                    className="glass-input w-full p-4 rounded-xl text-sm font-medium"
                />

                {/* Search Results Dropdown */}
                {(searchTerm.length > 0 || isFocused) && filteredItems.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-dropdown-bg border border-dropdown-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        {filteredItems.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => {
                                    setSelected([...selected, item]);
                                    setSearchTerm('');
                                }}
                                className="w-full text-left px-5 py-4 hover:bg-dropdown-hover border-b border-dropdown-border last:border-0 transition-colors group"
                            >
                                <p className="font-bold text-sm text-primary dark:text-white transition-colors">{item}</p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderPrioritySelector = () => {
        const isDraggedFactorRanked = isDragging ? advancedPriorities.some(group => group.includes(isDragging)) : false;
        const isPoolHovered = dragOverIndex?.type === 'pool';

        const renderInsertDropZone = (targetIndex: number) => {
            const isHovered = dragOverIndex?.type === 'insert' && dragOverIndex?.index === targetIndex;
            return (
                <div
                    onDragOver={(e) => handleDragOver(e, targetIndex, 'insert')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, targetIndex, 'insert')}
                    className={`relative w-full transition-all duration-200 flex items-center justify-center ${
                        isHovered 
                            ? 'py-3.5 opacity-100' 
                            : isDragging 
                            ? 'py-2 opacity-50' 
                            : 'py-0 h-0.5 opacity-0 pointer-events-none'
                    }`}
                >
                    <div className={`w-full border-t-2 border-dashed rounded transition-colors ${
                        isHovered 
                            ? 'border-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]' 
                            : 'border-primary/20'
                    }`} />
                    {isHovered && (
                        <span className="absolute px-2.5 py-0.5 rounded-full bg-primary text-[8px] font-black text-white uppercase tracking-widest pointer-events-none shadow-md">
                            Insert Rank Level {targetIndex + 1}
                        </span>
                    )}
                </div>
            );
        };

        return (
            <div className="space-y-4 py-4 border-b border-black/5 dark:border-white/5">
                <div className="flex justify-between items-center pb-3 border-b border-black/5 dark:border-white/5">
                    <div className="space-y-1">
                        <label className="block text-sm font-bold text-primary uppercase tracking-wider">Focus Factors</label>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Rank or select what you care about</p>
                    </div>
                    {/* Mode Toggle Switch */}
                    <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl gap-1 border border-black/5 dark:border-white/5">
                        <button
                            type="button"
                            onClick={() => setPrioritiesMode('normal')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                prioritiesMode === 'normal'
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Normal
                        </button>
                        <button
                            type="button"
                            onClick={() => setPrioritiesMode('advanced')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                prioritiesMode === 'advanced'
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Advanced
                        </button>
                    </div>
                </div>

                {prioritiesMode === 'normal' ? (
                    /* Normal Mode UI */
                    <div className="space-y-3">
                        <p className="text-[10px] text-muted-foreground/80 italic">Tap factors in order of preference to rank them 1st, 2nd, 3rd, etc.</p>
                        <div className="flex flex-wrap gap-2">
                            {priorityFactors.map((factor) => {
                                const rankIndex = normalPriorities.indexOf(factor);
                                const isSelected = rankIndex !== -1;
                                return (
                                    <button
                                        key={factor}
                                        type="button"
                                        onClick={() => toggleNormalPriority(factor)}
                                        className={`relative px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-300 flex items-center gap-1.5 ${
                                            isSelected
                                                ? 'bg-primary border-primary text-white shadow-lg scale-105'
                                                : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        {isSelected && (
                                            <span className="flex items-center justify-center px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-black mr-0.5">
                                                {getRankLabel(rankIndex)}
                                            </span>
                                        )}
                                        {factor}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Advanced Mode UI */
                    <div className="space-y-4">
                        <p className="text-[10px] text-muted-foreground/80 italic">
                            Drag & drop chips to rank and tie them freely, or tap them in order.
                        </p>
                        
                        {/* Available Pool Wrapper with drag target for removing */}
                        <div
                            onDragOver={(e) => isDraggedFactorRanked ? handleDragOver(e, -1, 'pool') : undefined}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => isDraggedFactorRanked ? handleDrop(e, -1, 'pool') : undefined}
                            className={`p-3 rounded-2xl border transition-all duration-300 ${
                                isPoolHovered && isDraggedFactorRanked
                                    ? 'border-red-500/40 bg-red-500/5 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                                    : isDragging && isDraggedFactorRanked
                                    ? 'border-dashed border-red-500/30 bg-red-500/[0.02]'
                                    : 'border-transparent bg-transparent'
                            }`}
                        >
                            {isPoolHovered && isDraggedFactorRanked && (
                                <div className="text-center text-[10px] text-red-400 font-bold mb-2 uppercase tracking-wider animate-pulse">
                                    Drop here to remove from ranking
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {priorityFactors.map((factor) => {
                                    const isSelected = advancedPriorities.some(group => group.includes(factor));
                                    return (
                                        <button
                                            key={factor}
                                            type="button"
                                            disabled={isSelected}
                                            draggable={!isSelected}
                                            onDragStart={(e) => handleDragStart(e, factor)}
                                            onDragEnd={handleDragEnd}
                                            onClick={() => toggleAdvancedPriority(factor)}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-300 ${
                                                isSelected
                                                    ? 'opacity-40 bg-white/10 border-dashed border-white/10 text-muted-foreground/60 cursor-default pointer-events-none'
                                                    : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20 cursor-grab active:cursor-grabbing hover:scale-[1.02]'
                                            }`}
                                        >
                                            {factor}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Selected Sequence with drag and drop zones */}
                        <div className="glass-panel p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-2">
                            <label className="block text-[10px] uppercase font-black tracking-widest text-primary/80">Priority Ranking</label>
                            
                            {/* Top Drop Zone */}
                            {advancedPriorities.length > 0 && renderInsertDropZone(0)}

                            {advancedPriorities.length === 0 ? (
                                <div
                                    onDragOver={(e) => handleDragOver(e, 0, 'insert')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, 0, 'insert')}
                                    className={`py-12 border-2 border-dashed rounded-xl text-center transition-all ${
                                        dragOverIndex?.type === 'insert' && dragOverIndex?.index === 0
                                            ? 'border-primary bg-primary/5 text-primary scale-[0.99]'
                                            : 'border-white/10 text-muted-foreground'
                                    }`}
                                >
                                    <p className="text-xs uppercase tracking-wider font-bold">Drag and drop factors here to start ranking</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1 italic">Or tap factors from the pool above</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {advancedPriorities.map((group, index) => {
                                        const isTieHovered = dragOverIndex?.type === 'tie' && dragOverIndex?.index === index;
                                        return (
                                            <div key={index} className="flex flex-col space-y-1">
                                                {/* Group Row (Drop Target for Ties) */}
                                                <div
                                                    onDragOver={(e) => handleDragOver(e, index, 'tie')}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, index, 'tie')}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                                                        isTieHovered
                                                            ? 'bg-primary/10 border-primary scale-[1.01] shadow-[0_0_10px_rgba(var(--primary-rgb),0.15)]'
                                                            : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5'
                                                    }`}
                                                >
                                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[9px] font-black shrink-0">
                                                        {index + 1}
                                                    </span>
                                                    <div className="flex flex-wrap gap-2 flex-grow">
                                                        {group.map((factor) => (
                                                            <span
                                                                key={factor}
                                                                draggable
                                                                onDragStart={(e) => handleDragStart(e, factor)}
                                                                onDragEnd={handleDragEnd}
                                                                onClick={() => removeAdvancedPriority(factor)}
                                                                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 hover:text-red-400 border border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-grab active:cursor-grabbing transition-all hover:border-white/30"
                                                                title="Drag to reorder / Click to remove"
                                                            >
                                                                {factor}
                                                                <span className="text-[9px] opacity-60">×</span>
                                                            </span>
                                                        ))}
                                                        {isTieHovered && (
                                                            <span className="text-[10px] text-primary/80 font-bold border border-dashed border-primary/40 px-2 py-1 rounded bg-primary/5 animate-pulse">
                                                                + Drop to Tie
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Insert Spacer Zone below this group */}
                                                {renderInsertDropZone(index + 1)}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full max-w-lg mx-auto">
            {/* Progress Header */}
            <div className="mb-8 px-2">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        {currentStep === 0 && "Step 0: Meeting Details"}
                        {currentStep === 1 && "Step 1: Availability"}
                        {currentStep === 2 && "Step 2: Preferences"}
                    </span>
                    <span className="text-xs text-muted-foreground font-bold">
                        {currentStep + 1} / 3
                    </span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden backdrop-blur-sm">
                    <div
                        className="bg-primary h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                        style={{ width: `${((currentStep + 1) / 3) * 100}%` }}
                    ></div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl space-y-6 animate-in fade-in zoom-in duration-500">

                {/* STEP 0: MEETING DETAILS */}
                {currentStep === 0 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="space-y-2 pb-4 border-b border-white/10">
                            <h2 className="text-xl font-bold text-foreground tracking-tight">
                                Meeting Details
                            </h2>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Set the foundation for your gathering</p>
                        </div>

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

                        {/* Timing Mode Toggle */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Timing Mode</label>
                            <div className="flex bg-white/5 rounded-xl p-1 gap-1 border border-white/5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTimingMode('period');
                                        setFixedDate('');
                                        setFixedStartTime('');
                                        setFixedEndTime('');
                                        setAvailability({});
                                    }}
                                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all uppercase tracking-wider ${timingMode === 'period'
                                        ? 'bg-primary text-white shadow-lg'
                                        : 'text-muted-foreground hover:bg-white/5'
                                        }`}
                                >
                                    Voting
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTimingMode('fixed');
                                        setStartDate('');
                                        setEndDate('');
                                        setAvailability({});
                                    }}
                                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all uppercase tracking-wider ${timingMode === 'fixed'
                                        ? 'bg-primary text-white shadow-lg'
                                        : 'text-muted-foreground hover:bg-white/5'
                                        }`}
                                >
                                    Fixed Time
                                </button>
                            </div>
                        </div>

                        {timingMode === 'period' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Start Date</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            min={getTodayString()}
                                            required
                                            className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-primary transition-all text-sm font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">End Date</label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            min={startDate || getTodayString()}
                                            max={getMaxEndDate()}
                                            required
                                            className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-primary transition-all text-sm font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Meal Time</label>
                                    <div className="flex bg-white/5 rounded-xl p-1 gap-1 border border-white/5">
                                        {['Lunch', 'Dinner', 'Any'].map((time) => (
                                            <button
                                                key={time}
                                                type="button"
                                                onClick={() => setOrganizerMealTime(time)}
                                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${organizerMealTime === time ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:bg-white/5'}`}
                                            >
                                                {time}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Date</label>
                                    <input
                                        type="date"
                                        value={fixedDate}
                                        onChange={(e) => setFixedDate(e.target.value)}
                                        min={getTodayString()}
                                        required
                                        className="glass-input w-full p-3 rounded-xl text-sm font-medium"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">From</label>
                                        <input
                                            type="time"
                                            value={fixedStartTime}
                                            onChange={(e) => setFixedStartTime(e.target.value)}
                                            required
                                            className="glass-input w-full p-3 rounded-xl text-sm font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">To</label>
                                        <input
                                            type="time"
                                            value={fixedEndTime}
                                            onChange={(e) => setFixedEndTime(e.target.value)}
                                            required
                                            className="glass-input w-full p-3 rounded-xl text-sm font-medium"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {dateError && (
                            <div className="text-rose-400 text-xs font-bold p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 animate-pulse">
                                ⚠️ {dateError}
                            </div>
                        )}

                        {/* Attendees & Key Persons */}
                        <div className="space-y-4">
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
                                            <div className={`w-2 h-2 rounded-full ${selectedAttendees.includes(attendee.userId) ? 'bg-white' : 'bg-primary/50'}`}></div>
                                            {attendee.displayName}
                                        </button>
                                    ))}
                                </div>
                                {selectedAttendees.length < 2 && (
                                    <p className="text-amber-400 text-[11px] font-bold mt-1 animate-pulse">
                                        ⚠️ A meeting must have at least 2 participants (including yourself). Please invite at least one friend.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Key Decision Makers</label>
                                <div className="flex flex-wrap gap-2">
                                    {attendeeList.map((attendee) => (
                                        <button
                                            key={attendee.userId}
                                            type="button"
                                            onClick={() => handleToggleKeyPerson(attendee.userId)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${selectedKeyPersons.includes(attendee.userId)
                                                ? 'bg-amber-500 border-amber-500 text-white shadow-lg'
                                                : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'
                                                }`}
                                        >
                                            <div className={`w-2 h-2 rounded-full ${selectedKeyPersons.includes(attendee.userId) ? 'bg-white' : 'bg-amber-500/50'}`}></div>
                                            {attendee.displayName}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {selectedKeyPersons.length > 0 && (
                                <div className="space-y-3 pt-4 p-4 bg-white/5 rounded-xl border border-white/5 animate-in fade-in duration-300">
                                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                                        <span className="text-amber-500">Key Decision Makers: {keyPersonRatio}%</span>
                                        <span className="text-primary">General Attendees: {100 - keyPersonRatio}%</span>
                                    </div>
                                    
                                    <div className="relative w-full h-3 bg-white/10 rounded-full overflow-hidden flex">
                                        {/* Progress bar visual split */}
                                        <div 
                                            className="h-full bg-amber-500 transition-all duration-300"
                                            style={{ width: `${keyPersonRatio}%` }}
                                        />
                                        <div 
                                            className="h-full bg-primary/70 transition-all duration-300"
                                            style={{ width: `${100 - keyPersonRatio}%` }}
                                        />
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min="70"
                                            max="90"
                                            step="5"
                                            value={keyPersonRatio}
                                            onChange={(e) => setKeyPersonRatio(parseInt(e.target.value))}
                                            className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10 accent-amber-500 focus:outline-none"
                                            style={{
                                                background: `linear-gradient(to right, rgb(245, 158, 11) 0%, rgb(245, 158, 11) ${((keyPersonRatio - 70) / 20) * 100}%, rgba(255, 255, 255, 0.1) ${((keyPersonRatio - 70) / 20) * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                                        Adjust decision priority. Key person weight must be between 70% and 90%.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Meeting Location & Restaurants */}
                        <div className="space-y-4 pt-4 border-t border-white/10">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Meeting Location (optional)</label>
                                <div className="relative flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="e.g. Siam Paragon"
                                        value={fixLocation}
                                        onChange={(e) => setFixLocation(e.target.value)}
                                        onBlur={() => handleLocationBlur('fix')}
                                        className="glass-input w-full p-3 rounded-xl text-sm font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setMapPickerTarget('fix'); setShowMapPicker(true); }}
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
                                    {(fixLocation || fixLocationCoords) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFixLocation("");
                                                setFixLocationCoords(null);
                                            }}
                                            className="glass-button px-4 py-3 rounded-xl flex items-center justify-center hover:bg-rose-500/20 text-rose-400 border-rose-500/20"
                                            title="Clear Location"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 relative" ref={searchWrapperRefFixed}>
                                <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Fixed Restaurant (Optional)</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {fixedRestaurants.map((rest: any) => (
                                        <span key={rest.name} className="px-3 py-1 rounded-full text-[10px] font-bold bg-primary/10 border border-primary/20 text-primary flex items-center gap-2">
                                            {rest.name}
                                            <button type="button" onClick={() => removeFixedRestaurant(rest.name)} className="hover:text-white transition-colors">×</button>
                                        </span>
                                    ))}
                                </div>
                                {fixedRestaurants.length === 0 && (
                                    <>
                                        <input
                                            type="text"
                                            placeholder="Select required restaurant..."
                                            value={searchTermFixed}
                                            onChange={(e) => handleSearchFixed(e.target.value)}
                                            className="glass-input w-full p-3 rounded-xl text-sm font-medium"
                                        />
                                        {searchResultsFixed.length > 0 && (
                                            <div className="absolute z-50 w-full mt-2 bg-dropdown-bg border border-dropdown-border rounded-xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                                                {searchResultsFixed.map((place, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => selectFixedRestaurant(place)}
                                                        className="w-full text-left px-4 py-3 hover:bg-dropdown-hover border-b border-dropdown-border last:border-0 transition-colors"
                                                    >
                                                        <p className="font-bold text-sm text-primary dark:text-white">{place.name}</p>
                                                        <p className="text-[10px] text-gray-500 dark:text-black/80">{place.category?.[0]} • {place.price}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Advanced Settings */}
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center justify-between w-full p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all duration-300"
                            >
                                <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Advanced Settings</span>
                                <span className={`text-xs transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
                            </button>

                            {showAdvanced && (
                                <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    {[
                                        { label: "Suggest by group preferences", value: allowSystemSuggest, setter: setAllowSystemSuggest },
                                        { label: "Custom list per time slot", value: suggest_per_time, setter: setSuggestPerTime },
                                        { label: "Everyone must be available", value: requireAllJoin, setter: setRequireAllJoin },
                                        { label: "Let friends add restaurants", value: allowOthersSuggest, setter: setAllowOthersSuggest }
                                    ].filter(opt => {
                                        if (opt.label === "Custom list per time slot" && timingMode === 'fixed') return false;
                                        if (opt.label === "Let friends add restaurants" && fixedRestaurants.length > 0) return false;
                                        if (opt.label === "Suggest by group preferences" && fixedRestaurants.length > 0) return false;
                                        return true;
                                    })
                                        .map((opt, i) => (
                                            <div key={i} className="flex items-center justify-between glass-panel p-3 rounded-xl border border-white/5">
                                                <span className="text-xs font-medium text-foreground/80 uppercase tracking-wider">{opt.label}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={opt.value}
                                                    onChange={(e) => opt.setter(e.target.checked)}
                                                    className="toggle"
                                                />
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleNext}
                            className="glass-button w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase shadow-lg shadow-primary/10 mt-4 active:scale-[0.98] transition-all"
                        >
                            Next
                        </button>
                    </div>
                )}

                {/* STEP 1: AVAILABILITY */}
                {currentStep === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-500">
                        <button onClick={handleBack} className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 uppercase tracking-wider transition-colors mb-2">
                            ← Back
                        </button>

                        <div className="space-y-2 pb-4 border-b border-white/10">
                            <h2 className="text-xl font-bold text-foreground tracking-tight">Availability</h2>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Select the times you're free</p>
                        </div>

                        {startDate && endDate ? (
                            <TimeSlotSelector
                                startDate={startDate}
                                endDate={endDate}
                                value={availability}
                                onChange={setAvailability}
                            />
                        ) : (
                            <div className="text-sm font-bold text-amber-400 bg-amber-400/10 p-5 rounded-xl border border-amber-400/20 text-center">
                                Please select dates in Step 0 first!
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleNext}
                            className="glass-button w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase shadow-lg shadow-primary/10 mt-4 active:scale-[0.98] transition-all"
                        >
                            Next
                        </button>
                    </div>
                )}

                {/* STEP 2: PREFERENCE */}
                {currentStep === 2 && (
                    <div className="animate-in slide-in-from-right duration-500">
                        <button onClick={handleBack} className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 uppercase tracking-wider transition-colors mb-2">
                            ← Back
                        </button>

                        <div className="space-y-2 pb-4 border-b border-white/10">
                            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tracking-tight">
                                Your Preferences
                            </h2>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Set your personal filter for this meeting</p>
                        </div>

                        {allowOthersSuggest || fixedRestaurants.length === 0 ? (
                            <div className="space-y-6 mt-4">
                                {renderPrioritySelector()}

                                {fixedRestaurants.length === 0 && (
                                    <div className="space-y-5">
                                        {timingMode !== 'fixed' && organizerMealTime === 'Any' && (
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Preferred Meal Time</label>
                                                <div className="flex bg-white/5 rounded-xl p-1 gap-1 border border-white/5">
                                                    {['Lunch', 'Dinner', 'Any'].map((time) => (
                                                        <button
                                                            key={time}
                                                            type="button"
                                                            onClick={() => setMealTime(time)}
                                                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mealTime === time ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:bg-white/5'}`}
                                                        >
                                                            {time}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {isFactorActive('Price') && renderDropdown(
                                            "Budget / Person",
                                            priceRange,
                                            setPriceRange,
                                            props.restaurantConfig?.price ? [...props.restaurantConfig.price, 'Any'] : ['< 500', '500-1000', '1000-2000', '> 2000', 'Any'],
                                            priceFocused,
                                            setPriceFocused,
                                            priceRef
                                        )}

                                        {isFactorActive('Category') && (
                                            <div className="space-y-5">
                                                {renderSearchableChipGroup("Prefer Cuisine", props.restaurantConfig?.category || [], selectedCategories, setSelectedCategories, cuisineSearchTerm, setCuisineSearchTerm, "Search cuisines...", cuisineSearchRef, cuisineFocused, setCuisineFocused, avoidCategories)}
                                                {renderSearchableChipGroup("Avoid Cuisine", props.restaurantConfig?.category || [], avoidCategories, setAvoidCategories, avoidCuisineSearchTerm, setAvoidCuisineSearchTerm, "Avoid cuisines...", avoidCuisineSearchRef, avoidCuisineFocused, setAvoidCuisineFocused, selectedCategories, 'negative')}
                                            </div>
                                        )}

                                        {isFactorActive('Vibe/Good For') && renderChipGroup("Vibe / Good For", props.restaurantConfig?.good_fors || [], selectedGoodFors, setSelectedGoodFors)}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {isFactorActive('Alcohol') && (
                                                <div className="flex items-center justify-between glass-panel p-3 rounded-xl border border-white/5">
                                                    <span className="text-sm font-medium uppercase tracking-wider text-primary dark:text-white">Alcohol</span>
                                                    <input type="checkbox" checked={selectedAlcohols} onChange={e => setSelectedAlcohols(e.target.checked)} className="toggle" />
                                                </div>
                                            )}
                                            {isFactorActive('Parking') && (
                                                <div className="flex items-center justify-between glass-panel p-3 rounded-xl border border-white/5">
                                                    <span className="text-sm font-medium uppercase tracking-wider text-primary dark:text-white">Parking</span>
                                                    <input type="checkbox" checked={selectedParking} onChange={e => setSelectedParking(e.target.checked)} className="toggle" />
                                                </div>
                                            )}
                                        </div>

                                        {isFactorActive('Distance from BTS') && (
                                            <div className="space-y-4">
                                                {!fixLocation && (
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Prefer Location</label>
                                                        <div className="relative flex gap-2">
                                                            <input type="text" placeholder="e.g. Siam Paragon" value={departureLocation} onChange={(e) => setDepartureLocation(e.target.value)} onBlur={() => handleLocationBlur('prefer')} className="glass-input w-full p-3 rounded-xl text-sm font-medium" />
                                                            <button type="button" onClick={() => { setMapPickerTarget('prefer'); setShowMapPicker(true); }} className="glass-button px-4 py-3 rounded-xl hover:bg-white/10 transition-all">
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

                                                <div className="space-y-2">
                                                    <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Max Walk Distance</label>
                                                    <select
                                                        value={maxWalkDistance}
                                                        onChange={(e) => setMaxWalkDistance(Number(e.target.value))}
                                                        className="glass-input w-full p-3 rounded-xl text-sm font-medium bg-transparent border border-black/10 dark:border-white/10 text-primary dark:text-white"
                                                    >
                                                        <option value={500} className="bg-dropdown-bg dark:bg-neutral-900 text-black dark:text-white">500 m (approx. 5 mins walk)</option>
                                                        <option value={1000} className="bg-dropdown-bg dark:bg-neutral-900 text-black dark:text-white">1000 m (approx. 10 mins walk)</option>
                                                        <option value={1500} className="bg-dropdown-bg dark:bg-neutral-900 text-black dark:text-white">1500 m (approx. 15 mins walk)</option>
                                                        <option value={2000} className="bg-dropdown-bg dark:bg-neutral-900 text-black dark:text-white">2000 m (approx. 20 mins walk)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {allowOthersSuggest && fixedRestaurants.length === 0 && (
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
                                            <input type="text" placeholder="Search venues..." value={searchTerm} onChange={(e) => handleSearch(e.target.value)} className="glass-input w-full p-3 rounded-xl text-sm font-medium" />
                                            {searchResults.length > 0 && (
                                                <div className="absolute z-50 w-full mt-2 bg-dropdown-bg border border-dropdown-border rounded-xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                                                    {searchResults.map((place, idx) => (
                                                        <button key={idx} type="button" onClick={() => selectRestaurant(place)} className="w-full text-left px-4 py-3 hover:bg-dropdown-hover border-b border-dropdown-border last:border-0 transition-colors">
                                                            <p className="font-bold text-sm text-primary dark:text-white">{place.name}</p>
                                                            <p className="text-[10px] text-gray-500 dark:text-muted-foreground">{place.category?.[0]} • {place.price}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-8 text-center animate-in fade-in zoom-in duration-500">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-primary">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">Restaurant Fixed</h3>
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">The restaurant is fixed by the organizer. Personal preferences are disabled.</p>
                            </div>
                        )}

                        <button type="submit" className="glass-button w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase shadow-lg shadow-primary/10 mt-6 active:scale-[0.98] transition-all">
                            Create & Vote
                        </button>
                    </div>
                )}
            </form >

            {/* Map Picker Modal */}
            {
                showMapPicker && (
                    <MapPicker
                        initialPosition={(mapPickerTarget === 'fix' ? fixLocationCoords : locationCoords) || undefined}
                        onConfirm={(coords, address) => {
                            if (mapPickerTarget === 'fix') {
                                setFixLocationCoords(coords);
                                setFixLocation(address);
                            } else {
                                setLocationCoords(coords);
                                setDepartureLocation(address);
                            }
                        }}
                        onClose={() => setShowMapPicker(false)}
                    />
                )
            }
        </div>
    )
}

export default CreateMeetingForm
