'use client'
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiff } from '@/app/context/LiffContext';
import { apiService } from '@/app/services/api';

const ResultPage = () => {
    const { isLoggedIn, profile } = useLiff();
    const router = useRouter();

    const [groupId, setGroupId] = useState<string | null>(null);
    const [meetingId, setMeetingId] = useState<string | null>(null);
    const [paramUserId, setParamUserId] = useState<string | null>(null);

    const searchParams = useSearchParams();

    // Initialization - listen to URL changes
    useEffect(() => {
        setGroupId(searchParams.get('group_id'));
        setMeetingId(searchParams.get('meeting_id'));
        setParamUserId(searchParams.get('user_id'));
    }, [searchParams]); // Re-run when URL params change

    // -------------------------------------------------------------------------
    // VIEW SELECTION LOGIC
    // -------------------------------------------------------------------------
    if (meetingId) {
        return <MeetingResultView groupId={groupId} meetingId={meetingId} paramUserId={paramUserId} profile={profile} isLoggedIn={isLoggedIn} />;
    }

    if (groupId) {
        return <GroupDashboardView groupId={groupId} />;
    }

    return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-background overflow-hidden relative">
            {/* Background elements for premium feel */}
            <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="glass-panel p-8 rounded-2xl w-full max-w-sm text-center space-y-6 border border-white/5 shadow-2xl backdrop-blur-xl relative z-10 animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10 shadow-inner">
                    <span className="text-4xl filter drop-shadow-md animate-pulse">❓</span>
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                        No Context Found
                    </h1>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        We couldn't find the meeting or group data.<br />
                        Please verify your link or create a new one.
                    </p>
                </div>

                <div className="pt-2">
                    <button
                        onClick={() => router.push('/create-meeting')}
                        className="w-full px-6 py-3.5 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-white font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <span>✨</span> Create New Meeting
                    </button>

                    <button
                        onClick={() => router.push('/')}
                        className="mt-6 text-xs text-muted-foreground hover:text-white transition-colors"
                    >
                        Return to Home
                    </button>
                </div>
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// SUB-COMPONENT: GROUP DASHBOARD
// -----------------------------------------------------------------------------
const GroupDashboardView = ({ groupId }: { groupId: string }) => {
    const router = useRouter();
    const [meetings, setMeetings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const data = await apiService.getMeetingsByGroup(groupId);
                const mapped = data.map((m: any) => ({
                    id: m.meeting_id,
                    name: m.meeting_name,
                    date: m.initial_data?.start_date || 'Unknown Date',
                    status: m.initial_data?.status || 'open'
                })).sort((a, b) => {
                    // Sort by date descending (newest first)
                    const dateA = new Date(a.date).getTime();
                    const dateB = new Date(b.date).getTime();
                    return dateB - dateA;
                });
                setMeetings(mapped);
            } catch (error) {
                console.error("Failed to fetch group meetings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMeetings();
    }, [groupId]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="h-[100dvh] flex flex-col bg-background overflow-hidden relative">
            <header className="flex-none pt-4 pb-2 text-center bg-background/95 backdrop-blur-md z-10">
                <h1 className="text-xl font-bold text-muted-foreground uppercase tracking-widest">
                    Group Dashboard
                </h1>
                {/* <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                    {groupId.toUpperCase()}
                </h2> */}
            </header>

            <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
                <div className="max-w-lg mx-auto grid gap-4">
                    {meetings.map((meeting) => {
                        const handleMeetingClick = () => {
                            const url = `/result?group_id=${groupId}&meeting_id=${meeting.id}`;
                            console.log('Navigating to:', url);
                            console.log('Meeting ID:', meeting.id);
                            console.log('Group ID:', groupId);
                            router.push(url);
                        };

                        return (
                            <div
                                key={meeting.id}
                                onClick={handleMeetingClick}
                                className="glass-panel p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all group"
                            >
                                <div>
                                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{meeting.name}</h3>
                                    <p className="text-sm text-muted-foreground">📅 {meeting.date}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${meeting.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {meeting.status}
                                    </span>
                                    <div className="text-muted-foreground text-xs mt-1">Tap to view</div>
                                </div>
                            </div>
                        );
                    })}

                    {meetings.length === 0 && (
                        <div className="text-center text-muted-foreground mt-10">
                            No meetings found for this group.
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={() => router.push('/create-meeting')}
                className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 hover:scale-110 transition-all z-20"
            >
                <span className="text-3xl text-white font-light mb-1">+</span>
            </button>
        </div>
    );
};

// -----------------------------------------------------------------------------
// SUB-COMPONENT: MEETING RESULT VIEW
// -----------------------------------------------------------------------------
const MeetingResultView = ({ groupId, meetingId, paramUserId, profile, isLoggedIn }: any) => {
    const router = useRouter();
    const [suggestionsMap, setSuggestionsMap] = useState<any>(null);
    const [preferredRestaurants, setPreferredRestaurants] = useState<any[]>([]);
    const [discoveryRestaurants, setDiscoveryRestaurants] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'slots' | 'favorites' | 'discovery'>('slots');
    const [meetingData, setMeetingData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('open'); // 'open' | 'closed'
    const [missingVoters, setMissingVoters] = useState<any[]>([]);

    // Auto-switch view mode for fixed timing
    useEffect(() => {
        const mode = meetingData?.initial_data?.timing_mode?.toLowerCase() || 'period';
        const allowSuggest = meetingData?.initial_data?.allow_system_suggest !== false;

        if (mode === 'fixed' && viewMode === 'slots') {
            setViewMode(allowSuggest ? 'discovery' : 'favorites');
        }
    }, [meetingData]);

    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [activeFilters, setActiveFilters] = useState<Record<string, number>>({});
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

    const [selectedDate, setSelectedDate] = useState<string>("");
    const [selectedTime, setSelectedTime] = useState<string>("");
    const [suggestions, setSuggestions] = useState<any[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const fetchingRef = useRef(false);

    const [expandedReasonIds, setExpandedReasonIds] = useState<Set<string>>(new Set());

    const [visibleDiscoveryCount, setVisibleDiscoveryCount] = useState(10);
    const [error, setError] = useState<string | null>(null);

    const filteredSuggestions = useMemo(() => {
        if (!suggestions) return [];
        return suggestions.filter(p => {
            const cats = typeof p.category === 'string'
                ? JSON.parse(p.category.replace(/'/g, '"'))
                : (Array.isArray(p.category) ? p.category : []);
            const categoryMatch = selectedCategory === 'All' || cats.includes(selectedCategory);

            const allCriteriaMatch = Object.entries(activeFilters).every(([criterion, threshold]) => {
                let scoreToFilter = 0;
                let reasonObj = p.reason;
                if (typeof reasonObj === 'string') {
                    try { reasonObj = JSON.parse(reasonObj.replace(/'/g, '"')); } catch (e) { }
                }

                if (criterion === 'Overall') {
                    scoreToFilter = p.score || 0;
                } else if (reasonObj && reasonObj[criterion]) {
                    const details = reasonObj[criterion];
                    const hasKeyPersons = (meetingData?.key_person?.length || 0) > 0;
                    scoreToFilter = details.weighted_score ?? (
                        hasKeyPersons
                            ? (details.key_ratio * 0.7 + details.attendee_ratio * 0.3)
                            : (details.attendee_ratio || details.key_ratio || 0)
                    );
                } else {
                    return false;
                }
                return scoreToFilter >= threshold;
            });

            return allCriteriaMatch && categoryMatch;
        });
    }, [suggestions, selectedCategory, activeFilters, meetingData]);

    const visibleSuggestions = useMemo(() => {
        return viewMode === 'discovery'
            ? filteredSuggestions.slice(0, visibleDiscoveryCount)
            : filteredSuggestions;
    }, [filteredSuggestions, viewMode, visibleDiscoveryCount]);

    useEffect(() => {
        if (meetingId && !fetchingRef.current) {
            fetchingRef.current = true;
            loadResultData().finally(() => {
                // In strict mode, we might want to allow refetching if something failed, 
                // but for now, to prevent double-notification race, we keep it true.
            });
        }
    }, [meetingId]);

    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        cats.add('All');

        const allSources = [
            ...(suggestionsMap ? Object.values(suggestionsMap).flatMap((times: any) =>
                Object.values(times).flatMap((slot: any) => Array.isArray(slot) ? slot : (slot.restaurants || []))
            ) : []),
            ...preferredRestaurants,
            ...discoveryRestaurants
        ];

        allSources.forEach((p: any) => {
            try {
                const pCats = typeof p.category === 'string'
                    ? JSON.parse(p.category.replace(/'/g, '"'))
                    : (Array.isArray(p.category) ? p.category : []);
                pCats.forEach((c: string) => cats.add(c));
            } catch (e) { }
        });
        return Array.from(cats);
    }, [suggestionsMap, preferredRestaurants, discoveryRestaurants]);

    const availableCriteria = useMemo(() => {
        const criteria = new Set<string>();
        criteria.add('Overall');

        const allSources = [
            ...(suggestionsMap ? Object.values(suggestionsMap).flatMap((times: any) =>
                Object.values(times).flatMap((slot: any) => Array.isArray(slot) ? slot : (slot.restaurants || []))
            ) : []),
            ...preferredRestaurants,
            ...discoveryRestaurants
        ];

        allSources.forEach((p: any) => {
            let reasonObj = p.reason;
            if (typeof reasonObj === 'string') {
                try { reasonObj = JSON.parse(reasonObj.replace(/'/g, '"')); } catch (e) { }
            }
            if (reasonObj && typeof reasonObj === 'object' && !Array.isArray(reasonObj)) {
                Object.keys(reasonObj).forEach(k => {
                    if (k !== 'Fixed') criteria.add(k);
                });
            }
        });
        return Array.from(criteria);
    }, [suggestionsMap, preferredRestaurants, discoveryRestaurants]);

    const searchParams = useSearchParams();
    const queryDate = searchParams?.get('date');
    const queryTime = searchParams?.get('time');

    useEffect(() => {
        if (suggestionsMap) {
            const availableDates = Object.keys(suggestionsMap).sort();

            // Priority 1: Use Date from URL if valid
            if (queryDate && availableDates.includes(queryDate)) {
                setSelectedDate(queryDate);

                const dateSlots = suggestionsMap[queryDate];
                const availableTimes = dateSlots ? Object.keys(dateSlots).sort() : [];

                // Priority 1.1: Use Time from URL if valid for this Date
                if (queryTime && availableTimes.includes(queryTime)) {
                    setSelectedTime(queryTime);
                } else if (availableTimes.length > 0) {
                    // Fallback: First time of the URL Date
                    setSelectedTime(availableTimes[0]);
                }

            } else if (availableDates.length > 0) {
                // Priority 2: Default to first available Date
                const firstDate = availableDates[0];
                setSelectedDate(firstDate);

                const times = Object.keys(suggestionsMap[firstDate]).sort();
                if (times.length > 0) setSelectedTime(times[0]);
            }
        }
    }, [suggestionsMap, queryDate, queryTime]);
    // Effect for updating suggestions list when selection changes
    useEffect(() => {
        if (viewMode === 'slots' && suggestionsMap && selectedDate && selectedTime) {
            const dateSlots = suggestionsMap[selectedDate];
            if (dateSlots && dateSlots[selectedTime]) {
                const slotData = dateSlots[selectedTime];
                if (Array.isArray(slotData)) {
                    setSuggestions(slotData);
                } else if (slotData && Array.isArray(slotData.restaurants)) {
                    setSuggestions(slotData.restaurants);
                } else {
                    setSuggestions([]);
                }
            } else {
                setSuggestions([]);
            }
        } else if (viewMode === 'favorites') {
            setSuggestions(preferredRestaurants);
        } else if (viewMode === 'discovery') {
            setSuggestions(discoveryRestaurants);
        }
    }, [suggestionsMap, selectedDate, selectedTime, viewMode, preferredRestaurants, discoveryRestaurants]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, []);

    const loadResultData = async () => {
        try {
            setError(null);
            const data = await apiService.getMeeting(meetingId);
            setMeetingData(data);
            // setStatus(data.status);

            const [attendees, groupUsers] = await Promise.all([
                apiService.getMeetingAttendees(meetingId),
                groupId ? apiService.getUsersByGroup(groupId) : Promise.resolve([])
            ]);

            const enrichedAttendees = attendees.map((att: any) => {
                const user = groupUsers.find((u: any) => u.user_id === att.user_id);
                return {
                    ...att,
                    displayName: user ? user.display_name || user.user_name : 'Unknown User',
                    pictureUrl: user?.pictureurl
                };
            });

            const missing = enrichedAttendees.filter((a: any) => !a.preference || Object.keys(a.preference).length === 0);
            setMissingVoters(missing);

            if (missing.length === 0) {
                const resultData = await apiService.getSuggestions(meetingId);

                // Extract grouped suggestions, favorites, and global rankings
                setSuggestionsMap(resultData.suggested_restaurants || {});
                setPreferredRestaurants(resultData.preferred_restaurants || []);
                setDiscoveryRestaurants(resultData.all_scored_restaurants || []);

                setLoading(false);
            } else {
                setLoading(false);
            }

        } catch (err: any) {
            console.error("Failed to load meeting data", err);
            setError(err.message || "Unknown error loading data");
            setLoading(false);
            fetchingRef.current = false; // Allow retry on error
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="glass-panel p-8 rounded-2xl flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-muted-foreground">Syncing with Group...</p>
                <p className="text-xs text-muted-foreground">ID: {meetingId?.slice(0, 8)}...</p>
            </div>
        </div>
    );

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-4">
                <div className="text-red-500 text-3xl">⚠️</div>
                <h1 className="text-xl font-bold">Error Loading Result</h1>
                <p className="text-muted-foreground text-sm">{error}</p>
                <div className="text-xs bg-black/20 p-2 rounded text-left">
                    <p>Group: {groupId}</p>
                    <p>Meeting: {meetingId}</p>
                </div>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white/10 rounded">Retry</button>
            </div>
        )
    }

    if (status === 'open' && missingVoters.length > 0) {
        return (
            <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-4">
                <div className="glass-panel p-8 rounded-2xl w-full max-w-md text-center space-y-6">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <span className="text-2xl">⏳</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground mb-2">Waiting for Group</h2>
                        <p className="text-muted-foreground text-sm">We need everyone's input to find the perfect spot.</p>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                        {missingVoters.map((voter: any) => (
                            <div key={voter.user_id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                                {voter.pictureUrl ? (
                                    <img
                                        src={voter.pictureUrl}
                                        alt={voter.displayName}
                                        className="w-8 h-8 rounded-full object-cover border border-white/10"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-[10px] text-white/50">
                                        {voter.displayName?.charAt(0) || '?'}
                                    </div>
                                )}
                                <span className="text-foreground/80 font-medium">{voter.displayName}</span>
                                <span className="ml-auto text-xs text-yellow-500 font-bold uppercase tracking-wider">Pending</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const availableDates = suggestionsMap ? Object.keys(suggestionsMap).sort() : [];
    const availableTimes = (suggestionsMap && selectedDate) ? Object.keys(suggestionsMap[selectedDate]).sort() : [];

    return (
        <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
            <div className="flex-none p-4 pb-2 z-10 bg-background/95 backdrop-blur-md border-b border-white/5 shadow-sm">
                <div className="mb-2">
                    <button
                        onClick={() => router.push(groupId ? `/result?group_id=${groupId}` : '/')}
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                        ← Back to Dashboard
                    </button>
                </div>

                <header className="space-y-4 mb-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                            Meeting Summary
                        </h1>
                        <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${(meetingData?.initial_data?.timing_mode || 'period') === 'fixed'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}>
                            {(meetingData?.initial_data?.timing_mode || 'period') === 'fixed' ? '⚡ Fixed Time' : '🗳️ Voting Mode'}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-foreground tracking-tight leading-tight">
                            {meetingData?.meeting_name || "Meeting Result"}
                        </h2>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            {(meetingData?.initial_data?.timing_mode || 'period') === 'fixed' ? (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <span>📅</span>
                                        <span className="font-medium text-foreground/80">{meetingData?.initial_data?.fixed_date}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span>🕒</span>
                                        <span className="font-medium text-foreground/80">
                                            {meetingData?.initial_data?.fixed_start_time} - {meetingData?.initial_data?.fixed_end_time}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <span>📅</span>
                                        <span className="font-medium text-foreground/80">
                                            {meetingData?.initial_data?.start_date} — {meetingData?.initial_data?.end_date}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span>🍽️</span>
                                        <span className="font-medium text-foreground/80">{meetingData?.initial_data?.meal_time}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {status === 'closed' && missingVoters.length > 0 &&
                        <span className="inline-block px-2 py-0.5 bg-red-500/10 text-red-300 text-[10px] rounded-md border border-red-500/20">
                            ⚠️ Vote closed early
                        </span>
                    }
                </header>

                {/* View Mode Selector */}
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                    {[
                        { id: 'slots', label: 'Slots', icon: '⏰' },
                        { id: 'favorites', label: 'Group Picks', icon: '🙋' },
                        { id: 'discovery', label: 'Discovery', icon: '🔍' }
                    ].filter(tab => {
                        const mode = meetingData?.initial_data?.timing_mode?.toLowerCase() || 'period';
                        const allowSuggest = meetingData?.initial_data?.allow_system_suggest !== false;

                        if (tab.id === 'slots' && mode === 'fixed') return false;
                        if (tab.id === 'discovery' && !allowSuggest) return false;
                        return true;
                    }).map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setViewMode(tab.id as any)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${viewMode === tab.id
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <span className="text-sm">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Filter & Cuisine Header Row */}
                <div className="mt-6 px-1 space-y-4">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Refine Search</span>
                            {Object.keys(activeFilters).length > 0 && (
                                <span className="bg-primary text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                                    {Object.keys(activeFilters).length}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setIsFilterDrawerOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-tight hover:bg-primary/20 transition-all active:scale-95"
                        >
                            <span>⚡ Filter Results</span>
                        </button>
                    </div>

                    {/* Cuisine Filter (Keep horizontal for quick access) */}
                    {/* <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {availableCategories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`flex-shrink-0 px-4 py-2 rounded-xl text-[11px] font-black transition-all border whitespace-nowrap ${selectedCategory === cat
                                    ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20 scale-105'
                                    : 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                {cat.toUpperCase()}
                            </button>
                        ))}
                    </div> */}
                </div>
            </div>

            {/* Advanced Filter Drawer Overlay */}
            {isFilterDrawerOpen && (
                <div
                    className="fixed inset-0 z-[100] flex flex-col justify-end animate-in fade-in duration-300"
                    style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
                    onClick={() => setIsFilterDrawerOpen(false)}
                >
                    <div
                        className="bg-zinc-900 border-t border-white/10 rounded-t-[32px] p-6 pb-12 w-full max-h-[85vh] overflow-y-auto space-y-6 animate-in slide-in-from-bottom duration-300 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <h2 className="text-xl font-black text-foreground">Advanced Filters</h2>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">Set Minimum Score Requirements</p>
                            </div>
                            <button
                                onClick={() => setIsFilterDrawerOpen(false)}
                                className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full border border-white/10 text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-6 pt-4">
                            {availableCriteria.map((c) => {
                                const threshold = activeFilters[c] || 0;

                                // Find Max Score
                                let maxScore = 5;
                                if (c === 'Overall') maxScore = 100;
                                else if (c === 'Category') maxScore = 15;
                                else if (c === 'Price' || c === 'Vibe') maxScore = 10;
                                else {
                                    for (const p of suggestions) {
                                        if (p.reason?.[c]?.max_score) {
                                            maxScore = p.reason[c].max_score;
                                            break;
                                        }
                                    }
                                }

                                return (
                                    <div key={c} className="space-y-3">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-xs font-black uppercase tracking-tight text-foreground/80">{c}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-muted-foreground italic">Min:</span>
                                                <span className={`text-sm font-black ${threshold > 0 ? 'text-purple-500' : 'text-muted-foreground'}`}>
                                                    {threshold}/{maxScore}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="px-1">
                                            <input
                                                type="range"
                                                min="0"
                                                max={maxScore}
                                                step={maxScore > 5 ? 0.5 : 0.1}
                                                value={threshold}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    const newFilters = { ...activeFilters };
                                                    if (val === 0) delete newFilters[c];
                                                    else newFilters[c] = val;
                                                    setActiveFilters(newFilters);
                                                }}
                                                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 transition-all"
                                                style={{
                                                    background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${(threshold / maxScore) * 100}%, rgba(255,255,255,0.05) ${(threshold / maxScore) * 100}%, rgba(255,255,255,0.05) 100%)`
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <style jsx global>{`
                            input[type='range']::-webkit-slider-thumb {
                                -webkit-appearance: none;
                                appearance: none;
                                width: 18px;
                                height: 18px;
                                background: #a855f7;
                                border: 3px solid #18181b;
                                border-radius: 50%;
                                cursor: pointer;
                                box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
                            }
                            input[type='range']::-moz-range-thumb {
                                width: 18px;
                                height: 18px;
                                background: #a855f7;
                                border: 3px solid #18181b;
                                border-radius: 50%;
                                cursor: pointer;
                                box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
                            }
                            @keyframes bounce-slow {
                                0%, 100% { transform: translateY(0); }
                                50% { transform: translateY(-5px); }
                            }
                            .animate-bounce-slow {
                                animation: bounce-slow 2s infinite ease-in-out;
                            }
                        `}</style>

                        <div className="pt-8 flex gap-3">
                            <button
                                onClick={() => {
                                    setActiveFilters({});
                                    setIsFilterDrawerOpen(false);
                                }}
                                className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-wider text-muted-foreground hover:bg-white/10 transition-all"
                            >
                                Reset All
                            </button>
                            <button
                                onClick={() => setIsFilterDrawerOpen(false)}
                                className="flex-1 py-4 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'slots' && (meetingData?.initial_data?.timing_mode || 'period') === 'fixed' && (
                <div className="flex-none px-4 pt-4 space-y-3 z-10">
                    {availableDates.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                            {availableDates.map(date => (
                                <button
                                    key={date}
                                    onClick={() => {
                                        setSelectedDate(date);
                                        const times = Object.keys(suggestionsMap[date]).sort();
                                        if (times.length > 0) setSelectedTime(times[0]);
                                    }}
                                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedDate === date
                                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                                        }`}
                                >
                                    {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', weekday: 'short' })}
                                </button>
                            ))}
                        </div>
                    )}

                    {availableTimes.length > 0 && (
                        <div className="pb-4 border-b border-white/5">
                            <label className="text-xs text-muted-foreground mb-1.5 block font-medium ml-1">Select Time Slot</label>
                            <div className="relative">
                                <select
                                    value={selectedTime || ''}
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                    className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground transition-all"
                                >
                                    {availableTimes.map(time => {
                                        const score = suggestionsMap[selectedDate][time]?.final_score || 0;
                                        return (
                                            <option key={time} value={time} className="text-black bg-white dark:bg-zinc-900 dark:text-white">
                                                {time}
                                            </option>
                                        );
                                    })}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* {viewMode !== 'slots' && (
                <div className="flex-none px-4 pt-4 z-10">
                    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
                        <span className="text-2xl">{viewMode === 'favorites' ? '🙋' : '🔍'}</span>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">
                                {viewMode === 'favorites' ? 'Group Suggested' : 'Discovery Ranking'}
                            </h3>
                            <p className="text-[10px] text-muted-foreground">
                                {viewMode === 'favorites'
                                    ? 'Restaurants explicitly suggested by group members.'
                                    : 'System recommendations based on group preferences.'}
                            </p>
                        </div>
                    </div>
                </div>
            )} */}

            <div ref={scrollRef} className="flex-1 overflow-y-auto pb-8 no-scrollbar scroll-smooth">
                {/* Sticky Results Header */}
                {suggestions.length > 0 && filteredSuggestions.length > 0 && (
                    <div className="sticky top-0 z-40 px-4 py-3 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                            <span className="text-[10px] font-black text-foreground/90 uppercase tracking-[0.2em]">
                                Showing {visibleSuggestions.length} of {filteredSuggestions.length} options
                            </span>
                        </div>
                        {Object.keys(activeFilters).length > 0 && (
                            <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                                <span className="text-[8px] font-black text-primary uppercase tracking-wider">Filtered</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="px-4 pt-4 space-y-4">
                    {suggestions.length === 0 && (
                        <div className="max-w-md mx-auto text-center py-16 px-6 glass-panel rounded-3xl border border-white/5 animate-in fade-in zoom-in duration-700">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-inner">
                                <span className="text-4xl">🍽️</span>
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-2">
                                {viewMode === 'slots'
                                    ? 'No Suggestions Found'
                                    : viewMode === 'favorites'
                                        ? 'No Friend Recommends'
                                        : 'No Discovery Results'}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {viewMode === 'slots'
                                    ? 'We couldn\'t find any restaurants open at this time that match your group\'s preferences.'
                                    : viewMode === 'favorites'
                                        ? 'It looks like no one has suggested a specific restaurant for this meeting yet.'
                                        : 'Our discovery engine is still warming up. Try checking back after more members have voted.'}
                            </p>
                            <button
                                onClick={() => setViewMode('slots')}
                                className="mt-8 text-xs font-bold text-primary uppercase tracking-widest hover:underline"
                            >
                                Explore other options
                            </button>
                        </div>
                    )}

                    <div className="max-w-lg mx-auto space-y-4">
                        {filteredSuggestions.length === 0 && suggestions.length > 0 ? (
                            <div className="bg-white/5 rounded-3xl p-12 text-center border border-dashed border-white/10 mt-4">
                                <div className="text-4xl mb-4">🔍</div>
                                <h3 className="text-sm font-bold text-foreground mb-1">No matches found</h3>
                                <p className="text-[11px] text-muted-foreground">Try adjusting your filters to see more options.</p>
                                <button
                                    onClick={() => {
                                        setActiveFilters({});
                                        setSelectedCategory('All');
                                    }}
                                    className="mt-4 text-[11px] font-bold text-primary hover:underline"
                                >
                                    Reset all filters
                                </button>
                            </div>
                        ) : (
                            <>
                                {visibleSuggestions.map((place, index) => {
                                    let locationName = "Bangkok";
                                    try {
                                        const validJson = place.address.replace(/'/g, '"');
                                        const addrObj = JSON.parse(validJson);
                                        locationName = addrObj.subDistrict?.name || addrObj.district?.name || locationName;
                                    } catch (e) { }

                                    return (
                                        <a
                                            key={place.id}
                                            href={`https://${place.wongnai_link}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block glass-panel overflow-hidden rounded-2xl animate-in slide-in-from-bottom-4 duration-500 shadow-lg border border-white/5 hover:border-primary/40 hover:bg-white/5 transition-all cursor-pointer group"
                                            style={{ animationDelay: `${index * 100}ms` }}
                                        >
                                            <div className="h-32 w-full relative bg-gradient-to-r from-gray-700 to-gray-600">
                                                {viewMode === 'discovery' && index < 3 && (
                                                    <div className="absolute top-2 left-2 w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full border border-white/10 z-20 shadow-xl overflow-hidden group/medal">
                                                        <div className={`text-2xl ${index === 0 ? 'animate-bounce-slow' : ''}`}>
                                                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                                        </div>
                                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-50 group-hover:scale-110 transition-transform duration-300">
                                                    🍽️
                                                </div>
                                                <div
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const newExpanded = new Set(expandedReasonIds);
                                                        if (newExpanded.has(place.id)) newExpanded.delete(place.id);
                                                        else newExpanded.add(place.id);
                                                        setExpandedReasonIds(newExpanded);
                                                    }}
                                                    className={`absolute top-2 right-2 glass-panel px-3 py-1 rounded-full border transition-all z-20 cursor-pointer active:scale-95 ${expandedReasonIds.has(place.id) ? 'border-primary bg-primary/20' : 'border-white/10 backdrop-blur-md'}`}
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <span className={`font-black text-[10px] ${place.score >= 80 ? 'text-green-400' : place.score >= 50 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                                            Match: {place.score}/100
                                                        </span>
                                                        <span className="text-[7px] font-bold uppercase tracking-tighter opacity-70">
                                                            {expandedReasonIds.has(place.id) ? 'Hide Scores' : 'View Scores'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{place.name}</h3>
                                                        <p className="text-xs text-muted-foreground">
                                                            {(() => {
                                                                try {
                                                                    const categories = typeof place.category === 'string'
                                                                        ? JSON.parse(place.category.replace(/'/g, '"'))
                                                                        : (Array.isArray(place.category) ? place.category : []);
                                                                    return categories.length > 0
                                                                        ? `${categories.join(' • ')} • ${locationName}`
                                                                        : locationName;
                                                                } catch {
                                                                    return `${place.category?.[0] || ''} • ${locationName}`;
                                                                }
                                                            })()}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-2">
                                                        <p className="text-sm font-medium text-primary">{place.price}</p>
                                                        <p className="text-[10px] text-muted-foreground">⭐ {place.rating ? place.rating.toFixed(1) : '-'}</p>
                                                    </div>
                                                </div>

                                                {expandedReasonIds.has(place.id) && (
                                                    <div className="grid grid-cols-2 gap-2 mb-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        {Array.isArray(place.reason) ? (
                                                            place.reason.slice(0, 4).map((r: string, i: number) => (
                                                                <div key={i} className="bg-white/5 rounded-xl p-2 border border-white/10 flex items-center justify-center text-center">
                                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight line-clamp-2">{r}</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            Object.entries(place.reason || {})
                                                                .filter(([key]) => key !== 'Fixed')
                                                                .sort(([keyA, detailsA]: [any, any], [keyB, detailsB]: [any, any]) => {
                                                                    const maxA = detailsA.max_score || 0;
                                                                    const maxB = detailsB.max_score || 0;
                                                                    if (maxB !== maxA) return maxB - maxA;
                                                                    return keyA.localeCompare(keyB);
                                                                })
                                                                .map(([key, details]: [string, any], i: number) => {
                                                                    const score = details.weighted_score
                                                                    const max = details.max_score || 1;
                                                                    return (
                                                                        <div key={i} className="bg-white/5 rounded-xl p-2 border border-white/10 hover:bg-white/5 transition-colors">
                                                                            <div className="flex justify-between items-center mb-1.5">
                                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider line-clamp-1">{key}</span>
                                                                                <span className="text-[10px] font-black text-primary shrink-0">
                                                                                    {typeof score === 'number' ? parseFloat(score.toFixed(1)) : score}/{max}
                                                                                </span>
                                                                            </div>
                                                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                                                <div
                                                                                    className="h-full bg-primary/60"
                                                                                    style={{ width: `${(score / max) * 100}%` }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                        )}
                                                    </div>
                                                )}

                                                <div className="text-xs text-center text-primary/50 mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Tap to view on Wongnai →
                                                </div>
                                            </div>
                                        </a>
                                    );
                                })}

                                {viewMode === 'discovery' && filteredSuggestions.length > visibleDiscoveryCount && (
                                    <div className="pt-2 pb-6 flex justify-center">
                                        <button
                                            onClick={() => setVisibleDiscoveryCount(prev => prev + 10)}
                                            className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-primary hover:bg-white/10 active:scale-95 transition-all shadow-lg"
                                        >
                                            See More (+10)
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultPage;
