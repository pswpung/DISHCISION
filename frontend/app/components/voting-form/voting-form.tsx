'use client'
import { useState, useEffect, useRef } from 'react';
import { useLiff } from '@/app/context/LiffContext';
import dynamic from 'next/dynamic';
import { TimeSlotSelector } from '@/app/components/time-slot-selector/time-slot-selector';
import { apiService } from '@/app/services/api';

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
    const [currentStep, setCurrentStep] = useState(1);
    const [rsvp, setRsvp] = useState<'yes' | 'no' | null>(null);
    const [availability, setAvailability] = useState<any>({}); // { date: [ {start, end} ] }

    // Preferences State
    const [priceRange, setPriceRange] = useState<string>('');
    const [preferredMealTime, setPreferredMealTime] = useState<string>('Any');

    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedGoodFors, setSelectedGoodFors] = useState<string[]>([]);
    const [avoidCategories, setAvoidCategories] = useState<string[]>([]);
    const [selectedAlcohols, setSelectedAlcohols] = useState(false);
    const [selectedParking, setSelectedParking] = useState(false);

    // Location State
    const [departureLocation, setDepartureLocation] = useState(meetingData?.fixLocation || 'Current Location');
    const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(
        meetingData?.lat && meetingData?.lng ? { lat: meetingData.lat, lng: meetingData.lng } : null
    );
    const [isLocating, setIsLocating] = useState(false);
    const [mapPickerTarget, setMapPickerTarget] = useState<'fix' | 'prefer'>('prefer');

    // Restaurant Search State
    const [preferredRestaurant, setPreferredRestaurant] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [priceFocused, setPriceFocused] = useState(false);
    const [cuisineFocused, setCuisineFocused] = useState(false);
    const [avoidCuisineFocused, setAvoidCuisineFocused] = useState(false);
    const [prioritiesMode, setPrioritiesMode] = useState<'normal' | 'advanced'>('normal');
    const [normalPriorities, setNormalPriorities] = useState<Record<string, 'high' | 'medium' | 'none'>>({
        'Price': 'none',
        'Category': 'none',
        'Vibe/Good For': 'none',
        'Distance from BTS': 'none',
        'Rating': 'none',
        'Parking': 'none',
        'Alcohol': 'none',
    });
    const [advancedPriorities, setAdvancedPriorities] = useState<string[][]>([]);
    const [maxWalkDistance, setMaxWalkDistance] = useState<number>(1000);
    const priorityFactors = ['Price', 'Category', 'Vibe/Good For', 'Distance from BTS', 'Rating', 'Parking', 'Alcohol'];

    const [isDragging, setIsDragging] = useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<{ index: number; type: 'tie' | 'insert' | 'pool' } | null>(null);

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

    // Geocode fixed location if coordinates are missing
    useEffect(() => {
        if (meetingData?.fixLocation && (!meetingData?.lat || !meetingData?.lng)) {
            const geocodeFixed = async () => {
                try {
                    const data = await apiService.searchLocation(meetingData.fixLocation);
                    if (data && data.length > 0) {
                        setLocationCoords({
                            lat: parseFloat(data[0].lat),
                            lng: parseFloat(data[0].lon)
                        });
                    }
                } catch (error) {
                    console.error("Geocoding fixed location failed:", error);
                }
            };
            geocodeFixed();
        }
    }, [meetingData?.fixLocation]);
    
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
                        console.warn("Geolocation failed, using fallback (Bangkok Center):", err);
                        // Fallback to Bangkok Center
                        setLocationCoords({ lat: 13.7563, lng: 100.5018 });
                        setIsLocating(false);
                    },
                    { 
                        enableHighAccuracy: false, 
                        timeout: 10000,
                        maximumAge: 60000 
                    }
                );
            } else {
                // Fallback if not supported
                setLocationCoords({ lat: 13.7563, lng: 100.5018 });
                setIsLocating(false);
            }
        }
    }, [departureLocation, locationCoords]);

    // Map picker state
    const [showMapPicker, setShowMapPicker] = useState(false);

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
        return distance <= 50;
    }

    const handleLocationBlur = async () => {
        if (departureLocation && departureLocation !== "Current Location") {
            try {
                const data = await apiService.searchLocation(departureLocation);
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);

                    if (!isLocationValid(lat, lng)) {
                        alert("Location is outside of available service area (Bangkok & Vicinity)");
                        setDepartureLocation("");
                        setLocationCoords(null);
                        return;
                    }

                    setLocationCoords({ lat, lng });
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

    const handleRSVP = (status: 'yes' | 'no') => {
        setRsvp(status);
        if (status === 'yes') {
            if (meetingData?.timingMode === 'fixed') {
                const fixedAvail = {
                    [meetingData.fixedDate]: [
                        { start: meetingData.fixedStartTime, end: meetingData.fixedEndTime }
                    ]
                };
                setAvailability(fixedAvail);
                if (meetingData?.allowOthersSuggest || meetingData?.allowSystemSuggest) {
                    setCurrentStep(3);
                } else {
                    onVoteSubmit({
                        status: 'yes',
                        availability: fixedAvail,
                        preferences: {}
                    });
                }
            } else {
                setCurrentStep(2);
            }
        } else {
            onVoteSubmit({
                status: 'no',
                availability: {},
                preferences: {}
            });
        }
    };

    const handleAvailabilitySubmit = (dates: any) => {
        const hasSlots = Object.values(dates).some((slots: any) => slots.length > 0);
        if (!hasSlots) {
            alert("Please select at least one available time slot.");
            return;
        }
        setAvailability(dates);

        if (!meetingData?.allowOthersSuggest && !meetingData?.allowSystemSuggest) {
            onVoteSubmit({
                status: 'yes',
                availability: dates,
                preferences: {}
            });
        } else {
            setCurrentStep(3);
        }
    };

    const getSerializedPriorities = (): string[][] => {
        if (prioritiesMode === 'normal') {
            const high: string[] = [];
            const medium: string[] = [];
            Object.entries(normalPriorities).forEach(([factor, level]) => {
                if (level === 'high') {
                    high.push(factor);
                } else if (level === 'medium') {
                    medium.push(factor);
                }
            });
            const result: string[][] = [];
            if (high.length > 0) result.push(high);
            if (medium.length > 0) result.push(medium);
            return result;
        } else {
            return advancedPriorities.filter(group => group.length > 0);
        }
    };

    const isFactorActive = (factor: string): boolean => {
        if (prioritiesMode === 'normal') {
            return normalPriorities[factor] === 'high' || normalPriorities[factor] === 'medium';
        } else {
            return advancedPriorities.some(group => group.includes(factor));
        }
    };

    const getActivePrioritiesCount = (): number => {
        if (prioritiesMode === 'normal') {
            return Object.values(normalPriorities).filter(val => val !== 'none').length;
        } else {
            return advancedPriorities.reduce((acc, group) => acc + group.length, 0);
        }
    };

    const toggleNormalPriority = (factor: string) => {
        setNormalPriorities(prev => {
            const current = prev[factor] || 'none';
            let next: 'high' | 'medium' | 'none' = 'none';
            if (current === 'none') next = 'high';
            else if (current === 'high') next = 'medium';
            else next = 'none';
            return { ...prev, [factor]: next };
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

        if (!departureLocation || departureLocation.trim() === "") {
            alert("Please provide a Departure Location.");
            return;
        }

        if (!locationCoords) {
            alert("Could not determine coordinates for the location. Please select a valid location from the search or map.");
            return;
        }

        const prefs = {
            meal_time: preferredMealTime,
            price: priceRange,
            category: selectedCategories,
            avoid_categories: avoidCategories,
            good_fors: selectedGoodFors,
            alcohols: selectedAlcohols ? true : null,
            parking: selectedParking ? true : null,
            departureLocation,
            lat: locationCoords?.lat || null,
            lng: locationCoords?.lng || null,
            preferredRestaurant,
            priorities: getSerializedPriorities(),
            max_walk_distance: maxWalkDistance
        };

        onVoteSubmit({
            status: 'yes',
            availability,
            preferences: prefs
        });
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

        const labelColor = variant === 'positive' ? 'text-emerald-500' : 'text-rose-500';

        return (
            <div className="space-y-2 relative" ref={wrapperRef}>
                <label className={`block text-sm font-medium uppercase tracking-wider ${labelColor}`}>{label}</label>

                <div className="flex flex-wrap gap-2 mb-2">
                    {selected.map((item) => (
                        <span key={item} className={`px-3 py-1.5 rounded-full text-[10px] font-bold border flex items-center gap-2 ${chipStyles}`}>
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
                    className="glass-input w-full p-3 rounded-xl text-sm font-medium transition-all"
                />

                {isFocused && filteredItems.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-dropdown-bg border border-dropdown-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        {filteredItems.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => {
                                    setSelected([...selected, item]);
                                    setSearchTerm('');
                                    setIsFocused(false);
                                }}
                                className="w-full text-left px-5 py-4 hover:bg-dropdown-hover border-b border-dropdown-border last:border-0 transition-colors group"
                            >
                                <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{item}</p>
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
                            : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-muted-foreground hover:bg-black/10 dark:bg-white/10'
                            }`}
                    >
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );

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
                        <p className="text-[10px] text-muted-foreground/80 italic">Tap chips to cycle: Unselected ➔ ⭐ High Priority ➔ 👍 Medium Priority</p>
                        <div className="flex flex-wrap gap-2">
                            {priorityFactors.map((factor) => {
                                const level = normalPriorities[factor] || 'none';
                                return (
                                    <button
                                        key={factor}
                                        type="button"
                                        onClick={() => toggleNormalPriority(factor)}
                                        className={`relative px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-300 flex items-center gap-1.5 ${
                                            level === 'high'
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105'
                                                : level === 'medium'
                                                ? 'bg-teal-600 border-teal-600 text-white shadow-md'
                                                : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20'
                                        }`}
                                    >
                                        {level === 'high' && <span>⭐ High:</span>}
                                        {level === 'medium' && <span>👍 Med:</span>}
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
                                                    ? 'opacity-40 bg-black/10 dark:bg-white/10 border-dashed border-black/10 dark:border-white/10 text-muted-foreground/60 cursor-default pointer-events-none'
                                                    : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 cursor-grab active:cursor-grabbing hover:scale-[1.02]'
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
                                            : 'border-black/10 dark:border-white/10 text-muted-foreground'
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
                                                                className="px-3 py-1.5 rounded-lg bg-black/10 hover:bg-red-500/20 hover:text-red-400 border border-black/10 text-xs font-bold flex items-center gap-1.5 cursor-grab active:cursor-grabbing transition-all hover:border-black/30"
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

    const categories = restaurantConfig?.category || ["Japanese", "Thai", "Italian", "Chinese", "Korean", "Buffet", "Cafe", "Izakaya"];
    const goodFors = restaurantConfig?.good_fors || ["Friends", "Business", "Date", "Family", "Party"];
    const prices = restaurantConfig?.price ? [...restaurantConfig.price, 'Any'] : ['< 500', '500-1000', '1000-2000', '> 2000', 'Any'];

    return (
        <div className="w-full max-w-lg mx-auto">
            <div className="mb-8 px-2">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        {currentStep === 1 && "Step 1: RSVP"}
                        {currentStep === 2 && "Step 2: Availability"}
                        {currentStep === 3 && "Step 3: Preferences"}
                    </span>
                    <span className="text-xs text-muted-foreground font-bold">{currentStep} / 3</span>
                </div>
                <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden backdrop-blur-sm">
                    <div
                        className="bg-primary h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                        style={{ width: `${(currentStep / 3) * 100}%` }}
                    ></div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl space-y-6 animate-in fade-in zoom-in duration-500">
                {/* STEP 1: RSVP */}
                {currentStep === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-500">
                        <div className="space-y-2 pb-4 border-b border-black/10 dark:border-white/10 text-center">
                            <h2 className="text-xl font-bold text-foreground tracking-tight">Will you join us?</h2>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Confirm attendance for <span className="text-primary">{meetingData?.name}</span></p>
                        </div>

                        <div className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl border border-black/5 dark:border-white/5 space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Meeting Topic</label>
                                <p className="text-xl font-black text-foreground tracking-tight">{meetingData?.name}</p>
                            </div>

                            <div className="py-4 border-y border-black/5 dark:border-white/5">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-primary">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                                        <label className="text-[10px] font-bold uppercase tracking-wider">When</label>
                                    </div>
                                    {meetingData?.timingMode === 'fixed' ? (
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-bold text-foreground">{meetingData.fixedDate}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium">{meetingData.fixedStartTime} - {meetingData.fixedEndTime}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-bold text-foreground">{meetingData?.startDate} - {meetingData?.endDate}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{meetingData?.mealTime}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {meetingData?.fixLocation && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5 text-primary">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                        <label className="text-[10px] font-bold uppercase tracking-wider">Where</label>
                                    </div>
                                    <p className="text-sm font-medium text-foreground bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/5 dark:border-white/5">{meetingData.fixLocation}</p>
                                </div>
                            )}

                            {meetingData?.fixedRestaurants && meetingData.fixedRestaurants.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5 text-primary">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.8V4a2 2 0 0 1 3.88-.68" /><path d="M13.9 6.2c.4-2 2.2-3.3 4.1-3.3v13.5" /><path d="M6 18c0 .5.5 1 1 1h10c.5 0 1-.5 1-1V8" /><path d="m9 14 3 3 3-3" /></svg>
                                        <label className="text-[10px] font-bold uppercase tracking-wider">Proposed Venues</label>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {meetingData.fixedRestaurants.map((rest: any, idx: number) => (
                                            <span key={idx} className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold">
                                                {rest.name || rest}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 pt-2">
                            <button
                                type="button"
                                onClick={() => handleRSVP('no')}
                                className="flex-1 py-4 rounded-xl border border-black/10 dark:border-white/10 text-muted-foreground font-bold text-sm hover:bg-black/5 dark:bg-white/5 hover:text-foreground transition-all active:scale-[0.98]"
                            >
                                Decline
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRSVP('yes')}
                                className="flex-[1.5] py-4 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] transition-all active:scale-[0.98]"
                            >
                                I'm Joining
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: AVAILABILITY */}
                {currentStep === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-500">
                        <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 uppercase tracking-wider transition-colors mb-2"
                        >
                            ← Back
                        </button>

                        <div className="space-y-2 pb-4 border-b border-black/10 dark:border-white/10">
                            <h2 className="text-xl font-bold text-foreground tracking-tight">Availability</h2>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Select the times you're free</p>
                        </div>

                        <div className="bg-black/5 dark:bg-white/5 rounded-2xl overflow-hidden border border-black/5 dark:border-white/5">
                            <TimeSlotSelector
                                startDate={meetingData?.startDate}
                                endDate={meetingData?.endDate}
                                value={availability}
                                onChange={setAvailability}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => handleAvailabilitySubmit(availability)}
                            className="glass-button w-full py-4 rounded-xl font-bold text-lg shadow-xl shadow-primary/10 active:scale-[0.98] transition-all"
                        >
                            {meetingData?.allowOthersSuggest && meetingData?.allowSystemSuggest
                                ? "Submit Vote"
                                : "Continue"}
                        </button>
                    </div>
                )}

                {/* STEP 3: PREFERENCES */}
                {currentStep === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-500">
                        <button
                            type="button"
                            onClick={() => setCurrentStep(meetingData?.timingMode === 'fixed' ? 1 : 2)}
                            className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 uppercase tracking-wider transition-colors mb-2"
                        >
                            ← Back
                        </button>

                        <div className="space-y-2 pb-4 border-b border-black/10 dark:border-white/10">
                            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tracking-tight">
                                {(!meetingData?.allowSystemSuggest && !meetingData?.allowOthersSuggest) ? "Ready to Go!" : "Your Preferences"}
                            </h2>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                {(!meetingData?.allowSystemSuggest && !meetingData?.allowOthersSuggest)
                                    ? "Everything is set for the meeting"
                                    : "Set your personal filter for this meeting"}
                            </p>
                        </div>

                        {(!meetingData?.allowSystemSuggest && !meetingData?.allowOthersSuggest) ? (
                            <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-700">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-4xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] border border-primary/20">
                                    ✨
                                </div>
                                <div className="text-center space-y-2">
                                    <h3 className="text-lg font-bold text-foreground">The meeting is ready!</h3>
                                    <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">
                                        Thank you for joining. All details have been finalized by the organizer.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {meetingData?.allowOthersSuggest || meetingData?.fixedRestaurants?.length === 0 ? (
                                    <div className="space-y-6 mt-4">
                                        {renderPrioritySelector()}

                                        {meetingData.allowSystemSuggest !== false && (
                                            <div className="space-y-6">
                                                {/* Meal Time Choice */}
                                                {meetingData.mealTime === 'Any' && meetingData.timingMode !== 'fixed' && (
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-medium text-foreground/80 uppercase tracking-wider">Preferred Meal Time</label>
                                                        <div className="flex bg-black/5 dark:bg-white/5 rounded-xl p-1 gap-1 border border-black/5 dark:border-white/5">
                                                            {['Lunch', 'Dinner', 'Any'].map((time) => (
                                                                <button
                                                                    key={time}
                                                                    type="button"
                                                                    onClick={() => setPreferredMealTime(time)}
                                                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${preferredMealTime === time ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:bg-black/5 dark:bg-white/5'}`}
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
                                                    prices,
                                                    priceFocused,
                                                    setPriceFocused,
                                                    priceRef
                                                )}

                                                {isFactorActive('Category') && (
                                                    <div className="space-y-5">
                                                        {renderSearchableChipGroup("Prefer Cuisine", categories, selectedCategories, setSelectedCategories, cuisineSearchTerm, setCuisineSearchTerm, "Search cuisines...", cuisineSearchRef, cuisineFocused, setCuisineFocused, avoidCategories)}
                                                        {renderSearchableChipGroup("Avoid Cuisine", categories, avoidCategories, setAvoidCategories, avoidCuisineSearchTerm, setAvoidCuisineSearchTerm, "Avoid cuisines...", avoidCuisineSearchRef, avoidCuisineFocused, setAvoidCuisineFocused, selectedCategories, 'negative')}
                                                    </div>
                                                )}

                                                {isFactorActive('Vibe/Good For') && renderChipGroup("Vibe / Good For", goodFors, selectedGoodFors, setSelectedGoodFors)}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {isFactorActive('Alcohol') && (
                                                        <div className="flex items-center justify-between glass-panel p-3 rounded-xl border border-black/5 dark:border-white/5">
                                                            <span className="text-sm font-medium uppercase tracking-wider text-primary dark:text-white">Alcohol</span>
                                                            <input type="checkbox" checked={selectedAlcohols} onChange={e => setSelectedAlcohols(e.target.checked)} className="toggle" />
                                                        </div>
                                                    )}
                                                    {isFactorActive('Parking') && (
                                                        <div className="flex items-center justify-between glass-panel p-3 rounded-xl border border-black/5 dark:border-white/5">
                                                            <span className="text-sm font-medium uppercase tracking-wider text-primary dark:text-white">Parking</span>
                                                            <input type="checkbox" checked={selectedParking} onChange={e => setSelectedParking(e.target.checked)} className="toggle" />
                                                        </div>
                                                    )}
                                                </div>

                                                {isFactorActive('Distance from BTS') && (
                                                    <div className="space-y-4">
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
                                                                        className="glass-button px-4 py-3 rounded-xl hover:bg-black/10 dark:bg-white/10 transition-all"
                                                                    >
                                                                        {isLocating ? (
                                                                            <div className="w-5 h-5 border-2 border-black/5 dark:bg-white/50 border-t-white rounded-full animate-spin" />
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

                                        {meetingData?.allowOthersSuggest && (
                                            <div className="space-y-4 pt-6 border-t border-black/10 dark:border-white/10">
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

                                                    {searchResults.length > 0 && (
                                                        <div className="absolute z-50 w-full mt-2 bg-dropdown-bg border border-dropdown-border rounded-xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                                                            {searchResults.map((place, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onClick={() => selectRestaurant(place)}
                                                                    className="w-full text-left px-4 py-3 hover:bg-dropdown-hover border-b border-dropdown-border last:border-0 transition-colors"
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
                            </div>
                        )}

                        <button type="submit" className="glass-button w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase shadow-lg shadow-primary/10 mt-6 active:scale-[0.98] transition-all">
                            Submit Vote
                        </button>
                    </div>
                )}
            </form>

            {showMapPicker && (
                <MapPicker
                    initialPosition={locationCoords || undefined}
                    onConfirm={(coords, address) => {
                        setLocationCoords(coords);
                        setDepartureLocation(address);
                    }}
                    onClose={() => setShowMapPicker(false)}
                />
            )}
        </div>
    );
}

export default VotingForm;
