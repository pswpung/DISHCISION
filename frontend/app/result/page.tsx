'use client'
import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
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
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                        meeting.status === 'open'
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-white/10 text-muted-foreground'
                                        }`}>
                                        {meeting.status === 'open' ? 'Vote Now' : 'Closed'}
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
// SUB-COMPONENT: SPIN WHEEL
// -----------------------------------------------------------------------------
interface SpinWheelProps {
    options: Array<{ key: string; label: string; weight: number }>;
    targetAngle: number | null;
    spinAt: number | null;
    isSpinning: boolean;
    onComplete: () => void;
}

const SpinWheel = ({ options, targetAngle, spinAt, isSpinning, onComplete }: SpinWheelProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const requestRef = useRef<number | null>(null);
    const completeTriggeredRef = useRef<boolean>(false);

    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const drawWheel = useCallback((currentAngle: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const r = Math.min(cx, cy) - 15;

        ctx.clearRect(0, 0, width, height);

        const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
        if (totalWeight === 0 || options.length === 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, 2 * Math.PI);
            ctx.fillStyle = '#1c1917';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText("No options selected", cx, cy);
            return;
        }

        let startAngle = currentAngle;
        const colors = [
            '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
            '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#eab308'
        ];

        options.forEach((opt, idx) => {
            const angleVal = (opt.weight / totalWeight) * 2 * Math.PI;
            const endAngle = startAngle + angleVal;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = colors[idx % colors.length];
            ctx.fill();

            ctx.strokeStyle = 'rgba(24, 24, 27, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(startAngle + angleVal / 2);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            const labelText = opt.label.length > 15 ? opt.label.slice(0, 12) + '...' : opt.label;
            ctx.fillText(labelText, r - 10, 0);
            ctx.restore();

            startAngle = endAngle;
        });

        // Center Pin
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
        ctx.fillStyle = '#18181b';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#a855f7';
        ctx.fill();

        // Arrow Pointer
        ctx.beginPath();
        ctx.moveTo(cx, 8);
        ctx.lineTo(cx - 10, 22);
        ctx.lineTo(cx + 10, 22);
        ctx.closePath();
        ctx.fillStyle = '#f43f5e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }, [options]);

    useEffect(() => {
        if (!isSpinning || spinAt === null || targetAngle === null) {
            drawWheel(0);
            completeTriggeredRef.current = false;
            return;
        }

        const duration = 5000;
        const animate = () => {
            const now = Date.now();
            const elapsed = now - spinAt;

            if (elapsed < duration) {
                const t = elapsed / duration;
                const easedT = easeOutQuart(t);
                const currentAngle = easedT * targetAngle;
                drawWheel(currentAngle);
                requestRef.current = requestAnimationFrame(animate);
            } else {
                drawWheel(targetAngle);
                if (!completeTriggeredRef.current) {
                    completeTriggeredRef.current = true;
                    onComplete();
                }
            }
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isSpinning, spinAt, targetAngle, drawWheel, onComplete]);

    return (
        <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
            <canvas ref={canvasRef} width={256} height={256} className="rounded-full shadow-2xl bg-zinc-950 border border-white/10" />
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
    const [viewMode, setViewMode] = useState<'slots' | 'restaurants' | 'decision'>('decision');
    // Sub-tab inside the Restaurants tab: 'friends' (suggested by attendees) | 'suggested' (by system)
    const [restaurantSubTab, setRestaurantSubTab] = useState<'friends' | 'suggested'>('friends');
    const [meetingData, setMeetingData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('open'); // 'open' | 'closed'
    const [missingVoters, setMissingVoters] = useState<any[]>([]);

    const [confirmedTimeSlot, setConfirmedTimeSlot] = useState<string>("");
    const [confirmedRestaurant, setConfirmedRestaurant] = useState<string>("");

    const searchParams = useSearchParams();

    const currentUserId = useMemo(() => {
        return profile?.userId || paramUserId || 'mock-user-id';
    }, [profile, paramUserId]);

    const votingState = useMemo(() => {
        return meetingData?.voting_state || {};
    }, [meetingData]);

    const isOrganizer = useMemo(() => {
        return meetingData?.initial_data?.organizer_id === currentUserId;
    }, [meetingData, currentUserId]);

    const isSpinningTime = useMemo(() => {
        return votingState.wheel_state?.status === 'spinning' && votingState.wheel_state?.target_type === 'time';
    }, [votingState]);

    const isSpinningRestaurant = useMemo(() => {
        return votingState.wheel_state?.status === 'spinning' && votingState.wheel_state?.target_type === 'restaurant';
    }, [votingState]);

    const liveVenueCandidates = useMemo(() => {
        let list = [...preferredRestaurants];

        const votedNames = new Set(Object.keys(votingState.restaurant_preferences || {}).filter(name => {
            return (votingState.restaurant_preferences[name]?.length || 0) > 0;
        }));

        votedNames.forEach(name => {
            if (!list.some(r => r.name === name)) {
                const found = discoveryRestaurants.find(r => r.name === name);
                if (found) {
                    list.push(found);
                } else {
                    list.push({
                        name: name,
                        score: 50,
                        address: "Bangkok",
                        category: []
                    });
                }
            }
        });

        return list.map(place => {
            const prefCount = votingState.restaurant_preferences?.[place.name]?.length || 0;
            const vetoCount = votingState.restaurant_vetoes?.[place.name]?.length || 0;
            const netVotes = prefCount - vetoCount;
            return {
                ...place,
                prefCount,
                vetoCount,
                netVotes
            };
        }).sort((a, b) => {
            if (b.netVotes !== a.netVotes) {
                return b.netVotes - a.netVotes;
            }
            return (b.score || 0) - (a.score || 0);
        });
    }, [preferredRestaurants, discoveryRestaurants, votingState]);



    // Pre-fill confirmed options from spin results or database
    useEffect(() => {
        if (votingState.wheel_state?.status === 'spinning') return;

        if (votingState.wheel_state?.target_type === 'time' && votingState.wheel_state?.landed_key) {
            setConfirmedTimeSlot(votingState.wheel_state.landed_key);
        }
        if (votingState.wheel_state?.target_type === 'restaurant' && votingState.wheel_state?.landed_key) {
            setConfirmedRestaurant(votingState.wheel_state.landed_key);
        }
        if (votingState.final_decision?.time_slot) {
            setConfirmedTimeSlot(votingState.final_decision.time_slot);
        }
        if (votingState.final_decision?.restaurant_id) {
            setConfirmedRestaurant(votingState.final_decision.restaurant_id);
        }
    }, [votingState.wheel_state, votingState.final_decision]);

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
    const [allAttendees, setAllAttendees] = useState<any[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const fetchingRef = useRef(false);

    const [expandedReasonIds, setExpandedReasonIds] = useState<Set<string>>(new Set());

    const [visibleDiscoveryCount, setVisibleDiscoveryCount] = useState(10);
    const [error, setError] = useState<string | null>(null);

    const filterRestaurants = useCallback((restaurantList: any[]) => {
        if (!restaurantList) return [];
        return restaurantList.filter(p => {
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
                    const keyRatioVal = meetingData?.initial_data?.key_decision_ratio !== undefined
                        ? (meetingData.initial_data.key_decision_ratio / 100.0)
                        : 0.7;
                    scoreToFilter = details.weighted_score ?? (
                        hasKeyPersons
                            ? (details.key_ratio * keyRatioVal + details.attendee_ratio * (1.0 - keyRatioVal))
                            : (details.attendee_ratio || details.key_ratio || 0)
                    );
                } else {
                    return false;
                }
                return scoreToFilter >= threshold;
            });

            return allCriteriaMatch && categoryMatch;
        });
    }, [selectedCategory, activeFilters, meetingData]);

    const filteredSuggestions = useMemo(() => {
        return filterRestaurants(suggestions);
    }, [suggestions, filterRestaurants]);

    const visibleSuggestions = useMemo(() => {
        return viewMode === 'restaurants' && restaurantSubTab === 'suggested'
            ? filteredSuggestions.slice(0, visibleDiscoveryCount)
            : filteredSuggestions;
    }, [filteredSuggestions, viewMode, restaurantSubTab, visibleDiscoveryCount]);

    const [slotSortKey, setSlotSortKey] = useState<'score' | 'attendees'>('score');

    const allSlots = useMemo(() => {
        if (!suggestionsMap) return [];
        const slots: any[] = [];
        Object.entries(suggestionsMap).forEach(([date, times]: [string, any]) => {
            Object.entries(times).forEach(([timeKey, slotData]: [string, any]) => {
                slots.push({ date, time: timeKey, ...slotData });
            });
        });
        return slots;
    }, [suggestionsMap]);

    const sortedSlots = useMemo(() => {
        const copy = [...allSlots];
        const count = (s: any) => (s.full_join?.length ?? 0) + (s.partial_join?.length ?? 0);
        if (slotSortKey === 'score') {
            copy.sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0) || count(b) - count(a));
        } else {
            copy.sort((a, b) => count(b) - count(a) || (b.final_score ?? 0) - (a.final_score ?? 0));
        }
        return copy;
    }, [allSlots, slotSortKey]);

    const timeSlotTies = useMemo(() => {
        if (sortedSlots.length < 2) return [];
        const votesList = sortedSlots.map(slot => {
            const key = `${slot.date}_${slot.time}`;
            return {
                key,
                slot,
                votes: votingState.time_votes?.[key]?.length || 0
            };
        });
        const maxVotes = Math.max(...votesList.map(v => v.votes));
        if (maxVotes === 0) return [];
        const tied = votesList.filter(v => v.votes === maxVotes);
        return tied.length > 1 ? tied.map(t => t.slot) : [];
    }, [sortedSlots, votingState.time_votes]);

    const restaurantTies = useMemo(() => {
        if (suggestions.length < 2) return [];
        const maxScore = Math.max(...suggestions.map(p => p.score || 0));
        if (maxScore === 0) return [];
        const tied = suggestions.filter(p => p.score === maxScore);
        return tied.length > 1 ? tied : [];
    }, [suggestions]);

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
        } else if (viewMode === 'restaurants') {
            if (restaurantSubTab === 'friends') {
                setSuggestions(preferredRestaurants);
            } else {
                setSuggestions(discoveryRestaurants);
            }
        } else if (viewMode === 'decision' && suggestionsMap) {
            let activeDate = selectedDate;
            let activeTime = selectedTime;

            if ((meetingData?.initial_data?.timing_mode || 'period') === 'fixed') {
                activeDate = meetingData?.initial_data?.fixed_date || '';
                activeTime = meetingData?.initial_data?.fixed_start_time || '';
            } else if (confirmedTimeSlot) {
                const parts = confirmedTimeSlot.split('_');
                if (parts.length === 2) {
                    activeDate = parts[0];
                    activeTime = parts[1];
                }
            } else if (sortedSlots.length > 0) {
                activeDate = sortedSlots[0].date;
                activeTime = sortedSlots[0].time;
            }

            if (activeDate && activeTime) {
                const dateSlots = suggestionsMap[activeDate];
                if (dateSlots && dateSlots[activeTime]) {
                    const slotData = dateSlots[activeTime];
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
            } else {
                setSuggestions([]);
            }
        }
    }, [suggestionsMap, selectedDate, selectedTime, viewMode, restaurantSubTab, preferredRestaurants, discoveryRestaurants, confirmedTimeSlot, sortedSlots, meetingData]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, []);

    const loadResultData = async () => {
        try {
            setError(null);
            const data = await apiService.getMeeting(meetingId, currentUserId);
            setMeetingData(data);
            setStatus(data.initial_data?.status || 'open');

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

            setAllAttendees(enrichedAttendees);

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

    // Smart polling loop
    useEffect(() => {
        if (!meetingId) return;
        const interval = setInterval(async () => {
            try {
                const data = await apiService.getMeeting(meetingId, currentUserId);
                setMeetingData(data);
                setStatus(data.initial_data?.status || 'open');

                // If suggestionsMap is null, check if we need to load full suggestions
                if (!suggestionsMap) {
                    const attendees = await apiService.getMeetingAttendees(meetingId);
                    const missing = attendees.filter((a: any) => !a.preference || Object.keys(a.preference).length === 0);
                    if (missing.length === 0) {
                        loadResultData();
                    }
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [meetingId, currentUserId, suggestionsMap]);

    const handleToggleTimeVote = async (date: string, time: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const slotKey = `${date}_${time}`;
            const updated = await apiService.voteTimeSlot(meetingId, currentUserId, slotKey);
            setMeetingData(updated);
        } catch (err) {
            console.error("Toggle time vote failed:", err);
        }
    };

    const handleToggleTailIn = async (restaurantName: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const updated = await apiService.toggleTailIn(meetingId, currentUserId, restaurantName);
            setMeetingData(updated);
        } catch (err) {
            console.error("Toggle prefer failed:", err);
        }
    };

    const handleToggleTailOut = async (restaurantName: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const updated = await apiService.toggleTailOut(meetingId, currentUserId, restaurantName);
            setMeetingData(updated);
        } catch (err) {
            console.error("Toggle veto failed:", err);
        }
    };

    const handleToggleReady = async () => {
        try {
            const updated = await apiService.toggleReady(meetingId, currentUserId);
            setMeetingData(updated);
        } catch (err) {
            console.error("Toggle ready failed:", err);
        }
    };

    const handleSetDecisionMethod = async (targetType: 'time' | 'restaurant', method: string) => {
        try {
            const updated = await apiService.setDecisionMethod(meetingId, targetType, method);
            setMeetingData(updated);
        } catch (err) {
            console.error("Failed to set decision method:", err);
        }
    };

    const handleSelectWheelRestaurants = async (names: string[]) => {
        try {
            const updated = await apiService.selectWheelRestaurants(meetingId, names);
            setMeetingData(updated);
        } catch (err) {
            console.error("Failed to select wheel restaurants:", err);
        }
    };

    const handleToggleRestaurantForWheel = async (name: string) => {
        const currentList = votingState.selected_restaurants || [];
        const updatedList = currentList.includes(name)
            ? currentList.filter((n: string) => n !== name)
            : [...currentList, name];
        await handleSelectWheelRestaurants(updatedList);
    };

    const handleConfirmFinal = async () => {
        const timeVal = ((meetingData?.initial_data?.timing_mode || 'period') === 'fixed')
            ? `${meetingData?.initial_data?.fixed_date}_${meetingData?.initial_data?.fixed_start_time}`
            : confirmedTimeSlot;

        if (!timeVal) {
            alert("Please confirm a time slot first.");
            return;
        }
        if (!confirmedRestaurant) {
            alert("Please confirm a restaurant first.");
            return;
        }
        try {
            const updated = await apiService.confirmFinalMeetingPlan(meetingId, timeVal, confirmedRestaurant);
            setMeetingData(updated);
            setStatus('closed');
        } catch (err) {
            console.error("Failed to lock final meeting plan:", err);
        }
    };

    const handleTriggerSpin = async (targetType: 'time' | 'restaurant') => {
        let candidates: Array<{ key: string; label: string; weight: number }> = [];
        if (targetType === 'time') {
            sortedSlots.forEach(slot => {
                const key = `${slot.date}_${slot.time}`;
                const votes = votingState.time_votes?.[key]?.length || 0;
                candidates.push({
                    key,
                    label: `${slot.date.slice(5)} ${slot.time}`,
                    weight: Math.max(1, votes)
                });
            });
        } else {
            let names = votingState.selected_restaurants || [];
            if (names.length === 0) {
                names = liveVenueCandidates.slice(0, 5).map(r => r.name);
            }
            names.forEach((name: string) => {
                const place = liveVenueCandidates.find(r => r.name === name);
                if (place) {
                    candidates.push({
                        key: name,
                        label: name,
                        weight: Math.max(1, Math.round((place.score || 50) / 10 + place.prefCount * 5))
                    });
                }
            });
        }

        if (candidates.length === 0) return;

        const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
        let rand = Math.random() * totalWeight;
        let winner = candidates[0];
        for (let c of candidates) {
            rand -= c.weight;
            if (rand <= 0) {
                winner = c;
                break;
            }
        }

        let startDeg = 0;
        let minDeg = 0;
        let maxDeg = 0;
        candidates.forEach(c => {
            const sliceDeg = (c.weight / totalWeight) * 360;
            if (c.key === winner.key) {
                minDeg = startDeg;
                maxDeg = startDeg + sliceDeg;
            }
            startDeg += sliceDeg;
        });

        const padding = Math.min(3, (maxDeg - minDeg) / 3);
        const targetDeg = minDeg + padding + Math.random() * (maxDeg - minDeg - 2 * padding);

        let stopAngle = (270 - targetDeg) + 360 * 5;
        if (stopAngle < 360 * 5) {
            stopAngle += 360;
        }

        try {
            const updated = await apiService.saveSpinResult(
                meetingId,
                targetType,
                winner.key,
                stopAngle,
                candidates.map(c => c.key)
            );
            setMeetingData(updated);
        } catch (err) {
            console.error("Failed to start spin:", err);
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
                        <h2 className="text-2xl font-black text-foreground tracking-tight leading-tight flex items-center flex-wrap gap-2">
                            {meetingData?.meeting_name || "Meeting Result"}
                            {isOrganizer && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-black uppercase tracking-wider shadow-md shadow-amber-500/10">
                                    👑 Organizer
                                </span>
                            )}
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
                    {((): { id: string; label: string }[] => {
                        const mode = meetingData?.initial_data?.timing_mode?.toLowerCase() || 'period';
                        const allowSuggest = meetingData?.initial_data?.allow_system_suggest !== false;
                        const isFixedRestaurant = (meetingData?.initial_data?.fixed_restaurants?.length || 0) > 0;
                        const hasRestaurants = (preferredRestaurants.length > 0) || (allowSuggest && discoveryRestaurants.length > 0);

                        const tabs: { id: string; label: string }[] = [];
                        if (mode !== 'fixed') tabs.push({ id: 'slots', label: 'Slots' });
                        if (!isFixedRestaurant && hasRestaurants) tabs.push({ id: 'restaurants', label: 'Restaurants' });
                        tabs.push({ id: 'decision', label: 'Decision' });
                        return tabs;
                    })().map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setViewMode(tab.id as any)}
                            className={`flex-1 flex items-center justify-center py-2.5 px-2 rounded-xl text-xs font-bold text-center transition-all ${viewMode === tab.id
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Filter & Cuisine Header Row */}
                {viewMode !== 'decision' && (
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
                    </div>
                )}
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

            {viewMode === 'slots' && (meetingData?.initial_data?.timing_mode || 'period') !== 'fixed' && (
                <div className="flex-none px-4 pt-4 z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Sort by</span>
                        <button
                            onClick={() => setSlotSortKey('score')}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${slotSortKey === 'score'
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/10'
                                }`}
                        >
                            🏆 Score
                        </button>
                        <button
                            onClick={() => setSlotSortKey('attendees')}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${slotSortKey === 'attendees'
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/10'
                                }`}
                        >
                            👥 Attendees
                        </button>
                        <span className="ml-auto text-[9px] text-muted-foreground">{sortedSlots.length} slots</span>
                    </div>
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

            {/* Restaurants sub-tab switcher */}
            {viewMode === 'restaurants' && (() => {
                const hasFriends = preferredRestaurants.length > 0;
                const hasSuggested = (meetingData?.initial_data?.allow_system_suggest !== false) && discoveryRestaurants.length > 0;
                const showSubTabs = hasFriends && hasSuggested;
                return showSubTabs ? (
                    <div className="flex-none px-4 pt-3">
                        <div className="flex p-0.5 bg-white/5 rounded-xl border border-white/5">
                            <button
                                onClick={() => setRestaurantSubTab('friends')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                    restaurantSubTab === 'friends'
                                        ? 'bg-white/10 text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Friends ({preferredRestaurants.length})
                            </button>
                            <button
                                onClick={() => setRestaurantSubTab('suggested')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                    restaurantSubTab === 'suggested'
                                        ? 'bg-white/10 text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Suggested ({discoveryRestaurants.length})
                            </button>
                        </div>
                    </div>
                ) : null;
            })()}

            <div ref={scrollRef} className="flex-1 overflow-y-auto pb-8 no-scrollbar scroll-smooth">
                {/* Sticky Results Header */}
                {viewMode !== 'decision' && suggestions.length > 0 && filteredSuggestions.length > 0 && (
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
                    {suggestions.length === 0 && viewMode === 'restaurants' && (
                        <div className="max-w-md mx-auto text-center py-16 px-6 glass-panel rounded-3xl border border-white/5 animate-in fade-in zoom-in duration-700">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-inner">
                                <span className="text-4xl">🍽️</span>
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-2">
                                {restaurantSubTab === 'friends'
                                    ? 'No Friend Suggestions'
                                    : 'No Suggested Restaurants'}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {restaurantSubTab === 'friends'
                                    ? 'No one has suggested a specific restaurant yet.'
                                    : 'System recommendations are still being generated. Check back soon.'}
                            </p>
                            <button
                                onClick={() => setViewMode('decision')}
                                className="mt-8 text-xs font-bold text-primary uppercase tracking-widest hover:underline"
                            >
                                Go to Decision
                            </button>
                        </div>
                    )}

                    <div className="max-w-lg mx-auto space-y-4">
                        {viewMode === 'decision' ? (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {/* Guidance banner — shown when user hasn't voted on anything yet */}
                                {status === 'open' && (() => {
                                    const hasVotedTime = Object.values(votingState.time_votes || {}).some(
                                        (voters: any) => voters.includes(currentUserId)
                                    );
                                    const hasVotedRestaurant =
                                        (votingState.restaurant_preferences?.[currentUserId]?.length || 0) > 0 ||
                                        Object.values(votingState.restaurant_vetoes || {}).some(
                                            (voters: any) => voters.includes(currentUserId)
                                        );
                                    const showBanner = !hasVotedTime && !hasVotedRestaurant;
                                    return showBanner ? (
                                        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 space-y-1">
                                            <p className="text-xs font-black text-foreground uppercase tracking-wider">What to do next</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                {(meetingData?.initial_data?.timing_mode || 'period') !== 'fixed' && (
                                                    <>
                                                        Go to <button onClick={() => setViewMode('slots')} className="text-primary font-bold hover:underline">Slots</button> to vote for your preferred time, then{' '}
                                                    </>
                                                )}
                                                Go to <button onClick={() => setViewMode('restaurants')} className="text-primary font-bold hover:underline">Restaurants</button> to mark the ones you like or want to avoid.
                                            </p>
                                        </div>
                                    ) : null;
                                })()}

                                {/* Final Decision Ticket (if closed) */}
                                {status === 'closed' && votingState.final_decision && (
                                    <div className="px-4 pt-2 max-w-lg mx-auto">
                                        <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-6 text-center space-y-4 shadow-2xl border border-white/10">
                                            {/* Decorative ticket punches */}
                                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#09090b] rounded-full border border-white/5" />
                                            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#09090b] rounded-full border border-white/5" />

                                            <div className="text-3xl animate-bounce">🎉</div>
                                            <div>
                                                <h2 className="text-lg font-black text-white uppercase tracking-tight">Meeting Plan Locked!</h2>
                                                <p className="text-[10px] text-white/70 uppercase tracking-widest font-black mt-1">Confirmed details sent to LINE</p>
                                            </div>

                                            <div className="border-t border-dashed border-white/30 pt-4 space-y-3 text-left">
                                                <div>
                                                    <span className="text-[9px] uppercase font-black text-white/50 tracking-widest block">Date & Time Slot</span>
                                                    <p className="text-sm font-bold text-white mt-0.5">
                                                        {votingState.final_decision.time_slot.replace("_", " • ")}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] uppercase font-black text-white/50 tracking-widest block">Confirmed Venue</span>
                                                    <p className="text-sm font-bold text-white mt-0.5">
                                                        {votingState.final_decision.restaurant_id}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Open State panels */}
                                {status === 'open' && (
                                    <>
                                        {/* Readiness Tracker */}
                                        <div className="glass-panel p-5 rounded-3xl border border-white/5 space-y-4 shadow-lg text-left">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h3 className="text-sm font-bold text-foreground">Readiness Tracker</h3>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                                                        {votingState.ready_users?.length || 0} of {allAttendees.length} friends ready
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handleToggleReady}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 duration-200 ${votingState.ready_users?.includes(currentUserId)
                                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                        : 'bg-primary text-white shadow-lg shadow-primary/20'
                                                        }`}
                                                >
                                                    {votingState.ready_users?.includes(currentUserId) ? '✓ Ready' : 'I\'m Ready'}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {allAttendees.map(att => {
                                                    const isReady = votingState.ready_users?.includes(att.user_id);
                                                    return (
                                                        <div key={att.user_id} className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/5">
                                                            {att.pictureUrl ? (
                                                                <img src={att.pictureUrl} alt={att.displayName} className="w-6 h-6 rounded-full object-cover" />
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                                                                    {att.displayName?.slice(0, 1)}
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[11px] font-semibold truncate text-foreground/80">{att.displayName}</p>
                                                            </div>
                                                            <span className={`text-[10px] ${isReady ? 'text-green-400 font-black' : 'text-zinc-500'}`}>
                                                                {isReady ? 'Ready' : 'Pending'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Time Decision Card (Only show if period mode) */}
                                        {(meetingData?.initial_data?.timing_mode || 'period') !== 'fixed' && (
                                            <div className="glass-panel p-5 rounded-3xl border border-white/5 space-y-4 shadow-lg text-left">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h3 className="text-sm font-bold text-foreground">Time Slot Decision</h3>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                                                            Method: {votingState.time_decision_method === 'wheel' ? 'Spin Wheel' : 'Majority Vote'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {isOrganizer && (
                                                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 text-[11px]">
                                                        <button
                                                            onClick={() => handleSetDecisionMethod('time', 'majority')}
                                                            className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${votingState.time_decision_method !== 'wheel'
                                                                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                                                : 'text-muted-foreground hover:text-foreground'
                                                                }`}
                                                        >
                                                            Majority Vote
                                                        </button>
                                                        <button
                                                            onClick={() => handleSetDecisionMethod('time', 'wheel')}
                                                            className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${votingState.time_decision_method === 'wheel'
                                                                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                                                : 'text-muted-foreground hover:text-foreground'
                                                                }`}
                                                        >
                                                            Spin Wheel
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Time slot tie warning banner */}
                                                {timeSlotTies.length > 1 && (
                                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-amber-200 text-xs animate-in fade-in duration-300">
                                                        <span className="text-lg">🤝</span>
                                                        <div className="space-y-1">
                                                            <p className="font-black uppercase tracking-wider">Tie Detected!</p>
                                                            <p className="leading-relaxed opacity-90">
                                                                There is a tie between the top time slot options ({timeSlotTies.map(s => `${s.date.slice(5)} ${s.time}`).join(' vs ')}).
                                                                Discuss with your friends to decide, or let the organizer use the **Spin Wheel** to make the final decision.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {votingState.time_decision_method === 'wheel' ? (
                                                    <div className="space-y-4 pt-2">
                                                        <SpinWheel
                                                            options={sortedSlots.map(slot => {
                                                                const key = `${slot.date}_${slot.time}`;
                                                                const votes = votingState.time_votes?.[key]?.length || 0;
                                                                return {
                                                                    key,
                                                                    label: `${slot.date.slice(5)} ${slot.time}`,
                                                                    weight: Math.max(1, votes)
                                                                };
                                                            })}
                                                            targetAngle={votingState.wheel_state?.target_type === 'time' ? votingState.wheel_state.stop_angle : null}
                                                            spinAt={votingState.wheel_state?.target_type === 'time' ? votingState.wheel_state.spin_at : null}
                                                            isSpinning={isSpinningTime}
                                                            onComplete={() => {
                                                                if (votingState.wheel_state?.landed_key) {
                                                                    setConfirmedTimeSlot(votingState.wheel_state.landed_key);
                                                                }
                                                            }}
                                                        />
                                                        {isOrganizer && (
                                                            <button
                                                                disabled={isSpinningTime || sortedSlots.length === 0}
                                                                onClick={() => handleTriggerSpin('time')}
                                                                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                                            >
                                                                {isSpinningTime ? 'Spinning...' : 'Spin Time Slot Wheel'}
                                                            </button>
                                                        )}
                                                        {!isOrganizer && (
                                                            <div className="text-center text-xs text-muted-foreground italic animate-pulse">
                                                                {isSpinningTime ? '🎡 The wheel is spinning!' : 'Waiting for organizer to spin...'}
                                                            </div>
                                                        )}
                                                        {confirmedTimeSlot && (
                                                            <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-2xl text-center text-xs font-semibold text-purple-400">
                                                                Selected Time Slot: <span className="font-bold text-foreground">{confirmedTimeSlot.replace('_', ' • ')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2 pt-2">
                                                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Top Time Slots</h4>
                                                        <div className="space-y-1.5">
                                                            {sortedSlots.slice(0, 3).map((slot, i) => {
                                                                const key = `${slot.date}_${slot.time}`;
                                                                const votes = votingState.time_votes?.[key]?.length || 0;
                                                                const isTop = i === 0;
                                                                return (
                                                                    <div
                                                                        key={key}
                                                                        onClick={() => {
                                                                            if (isOrganizer) setConfirmedTimeSlot(key);
                                                                        }}
                                                                        className={`flex justify-between items-center p-3 rounded-2xl border text-xs cursor-pointer transition-all ${confirmedTimeSlot === key
                                                                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                                                                            : 'bg-white/5 border-white/5 hover:border-white/10'
                                                                            }`}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span>{isTop ? '🏆' : '⏰'}</span>
                                                                            <div>
                                                                                <p className="font-bold text-foreground">{slot.time}</p>
                                                                                <p className="text-[10px] text-muted-foreground">{slot.date}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="font-black text-primary">{votes} {votes === 1 ? 'vote' : 'votes'}</span>
                                                                            {isOrganizer && confirmedTimeSlot === key && (
                                                                                <span className="text-[9px] bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded font-black uppercase">Confirmed</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Restaurant Decision Card */}
                                        <div className="glass-panel p-5 rounded-3xl border border-white/5 space-y-4 shadow-lg text-left">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h3 className="text-sm font-bold text-foreground">Venue Decision</h3>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                                                        Method: {votingState.restaurant_decision_method === 'wheel' ? 'Spin Wheel' : 'Scoring List'}
                                                    </p>
                                                </div>
                                            </div>

                                            {isOrganizer && (
                                                <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 text-[11px]">
                                                    <button
                                                        onClick={() => handleSetDecisionMethod('restaurant', 'list')}
                                                        className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${votingState.restaurant_decision_method !== 'wheel'
                                                            ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                            }`}
                                                    >
                                                        Scoring List
                                                    </button>
                                                    <button
                                                        onClick={() => handleSetDecisionMethod('restaurant', 'wheel')}
                                                        className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${votingState.restaurant_decision_method === 'wheel'
                                                            ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                            }`}
                                                    >
                                                        Spin Wheel
                                                    </button>
                                                </div>
                                            )}

                                            {/* Restaurant tie warning banner */}
                                            {restaurantTies.length > 1 && (
                                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-amber-200 text-xs animate-in fade-in duration-300">
                                                    <span className="text-lg">🤝</span>
                                                    <div className="space-y-1">
                                                        <p className="font-black uppercase tracking-wider">Tie Detected!</p>
                                                        <p className="leading-relaxed opacity-90">
                                                            There is a tie between the top venues ({restaurantTies.map(r => r.name).join(' vs ')}).
                                                            Discuss with your friends to decide, or let the organizer use the **Spin Wheel** to make the final decision.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {votingState.restaurant_decision_method === 'wheel' ? (
                                                <div className="space-y-4 pt-2">
                                                    {isOrganizer && (
                                                        <div className="space-y-3">
                                                            <div className="space-y-2">
                                                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Include in Spin Wheel</h4>
                                                                <div className="max-h-32 overflow-y-auto bg-black/10 rounded-2xl p-2.5 border border-white/5 space-y-1.5 custom-scrollbar">
                                                                    {liveVenueCandidates.map(place => {
                                                                        const isChecked = votingState.selected_restaurants?.includes(place.name) || false;
                                                                        const vetoCount = place.vetoCount;
                                                                        return (
                                                                            <label key={place.name} className="flex items-center gap-2 text-[11px] font-semibold text-foreground/80 cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={() => handleToggleRestaurantForWheel(place.name)}
                                                                                    className="rounded border-white/10 accent-primary"
                                                                                />
                                                                                <span className="truncate flex-1">{place.name}</span>
                                                                                {vetoCount > 0 && <span className="text-[9px] text-red-400 font-bold shrink-0">⚠️ {vetoCount} veto</span>}
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                            <div className="bg-primary/5 border border-dashed border-primary/20 rounded-2xl p-4 text-[11px] text-muted-foreground space-y-1.5">
                                                                <span className="font-bold text-primary block">🎡 Organizer Guide: Restaurant Spin Wheel</span>
                                                                <ul className="list-disc pl-4 space-y-1">
                                                                    <li>Use the checkboxes above to choose which restaurants to include.</li>
                                                                    <li>Slice sizes are dynamically weighted by match score and friends' preferences.</li>
                                                                    <li>Tap <strong>Spin Restaurant Wheel</strong> to let fortune decide!</li>
                                                                    <li>Locks in the choice and notifies the LINE group upon confirmation.</li>
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <SpinWheel
                                                        options={liveVenueCandidates.filter(r => (votingState.selected_restaurants || []).length === 0 || votingState.selected_restaurants.includes(r.name)).map(place => {
                                                            return {
                                                                key: place.name,
                                                                label: place.name,
                                                                weight: Math.max(1, Math.round((place.score || 50) / 10 + (place.prefCount || 0) * 5))
                                                            };
                                                        })}
                                                        targetAngle={votingState.wheel_state?.target_type === 'restaurant' ? votingState.wheel_state.stop_angle : null}
                                                        spinAt={votingState.wheel_state?.target_type === 'restaurant' ? votingState.wheel_state.spin_at : null}
                                                        isSpinning={isSpinningRestaurant}
                                                        onComplete={() => {
                                                            if (votingState.wheel_state?.landed_key) {
                                                                setConfirmedRestaurant(votingState.wheel_state.landed_key);
                                                            }
                                                        }}
                                                    />
                                                    {isOrganizer && (
                                                        <button
                                                            disabled={isSpinningRestaurant || liveVenueCandidates.length === 0}
                                                            onClick={() => handleTriggerSpin('restaurant')}
                                                            className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                                        >
                                                            {isSpinningRestaurant ? 'Spinning...' : 'Spin Restaurant Wheel'}
                                                        </button>
                                                    )}
                                                    {!isOrganizer && (
                                                        <div className="text-center text-xs text-muted-foreground italic animate-pulse">
                                                            {isSpinningRestaurant ? '🎡 The wheel is spinning!' : 'Waiting for organizer to spin...'}
                                                        </div>
                                                    )}
                                                    {confirmedRestaurant && (
                                                        <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-2xl text-center text-xs font-semibold text-purple-400">
                                                            Selected Venue: <span className="font-bold text-foreground">{confirmedRestaurant}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-2 pt-2">
                                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Top Venues</h4>
                                                    <div className="space-y-1.5">
                                                        {liveVenueCandidates.slice(0, 3).map((place, i) => {
                                                            const isTop = i === 0;
                                                            const vetoCount = place.vetoCount;
                                                            return (
                                                                <div
                                                                    key={place.name}
                                                                    onClick={() => {
                                                                        if (isOrganizer) setConfirmedRestaurant(place.name);
                                                                    }}
                                                                    className={`flex justify-between items-center p-3 rounded-2xl border text-xs cursor-pointer transition-all ${confirmedRestaurant === place.name
                                                                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                                                                        : 'bg-white/5 border-white/5 hover:border-white/10'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span>{isTop ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                                                                        <div className="truncate">
                                                                            <p className="font-bold text-foreground truncate">{place.name}</p>
                                                                            {vetoCount > 0 && <p className="text-[9px] text-red-400 font-semibold">⚠️ {vetoCount} vetoes</p>}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 shrink-0 ml-2">
                                                                        <span className="font-black text-primary" title={`Match Score: ${place.score}`}>
                                                                            👍 {place.prefCount} {place.vetoCount > 0 ? `• 👎 ${place.vetoCount}` : ''}
                                                                        </span>
                                                                        {isOrganizer && confirmedRestaurant === place.name && (
                                                                            <span className="text-[9px] bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded font-black uppercase">Confirmed</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Organizer Final Locking Box */}
                                        {isOrganizer && (
                                            <div className="glass-panel p-5 rounded-3xl border border-white/5 space-y-4 shadow-lg text-left pt-4">
                                                <div className="space-y-2">
                                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Organizer Final Action</h4>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                                                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block mb-1">Time Slot</span>
                                                            <span className="font-bold truncate block">{((meetingData?.initial_data?.timing_mode || 'period') === 'fixed') ? meetingData?.initial_data?.fixed_date + ' ' + meetingData?.initial_data?.fixed_start_time : confirmedTimeSlot ? confirmedTimeSlot.replace('_', ' • ') : 'Not selected'}</span>
                                                        </div>
                                                        <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                                                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block mb-1">Restaurant</span>
                                                            <span className="font-bold truncate block">{confirmedRestaurant || 'Not selected'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleConfirmFinal}
                                                    disabled={(!confirmedTimeSlot && ((meetingData?.initial_data?.timing_mode || 'period') !== 'fixed')) || !confirmedRestaurant}
                                                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg hover:shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                                                >
                                                    Lock Meeting Plan & Notify Group
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : viewMode === 'slots' ? (
                            sortedSlots.length === 0 ? (
                                <div className="text-center text-muted-foreground py-12">
                                    No available time slots found.
                                </div>
                            ) : (
                                sortedSlots.map((slot: any) => {
                                    const filteredRestaurants = filterRestaurants(slot.restaurants || []);
                                    const totalAttendees = (slot.full_join?.length ?? 0) + (slot.partial_join?.length ?? 0);
                                    const dateLabel = new Date(slot.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                                    return (
                                        <div key={`${slot.date}-${slot.time}`} className="glass-panel p-5 rounded-3xl border border-white/5 space-y-4 shadow-lg text-left">
                                            {/* Header: Time slot and score badge */}
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">📅</span>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-foreground">{slot.time}</h3>
                                                        <span className="text-[10px] text-muted-foreground">{dateLabel}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {status === 'open' && (
                                                        <button
                                                            onClick={(e) => handleToggleTimeVote(slot.date, slot.time, e)}
                                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 duration-200 ${votingState.time_votes?.[`${slot.date}_${slot.time}`]?.includes(currentUserId)
                                                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-sm'
                                                                : 'bg-white/5 text-muted-foreground border-white/10 hover:border-white/20'
                                                                }`}
                                                        >
                                                            <span>👍 {votingState.time_votes?.[`${slot.date}_${slot.time}`]?.includes(currentUserId) ? 'Voted' : 'Vote'}</span>
                                                            {(votingState.time_votes?.[`${slot.date}_${slot.time}`]?.length || 0) > 0 && (
                                                                <span className={`text-[8px] font-black px-1 rounded-full ${votingState.time_votes?.[`${slot.date}_${slot.time}`]?.includes(currentUserId)
                                                                    ? 'bg-purple-500/30 text-purple-200'
                                                                    : 'bg-white/10 text-muted-foreground'
                                                                    }`}>
                                                                    {votingState.time_votes?.[`${slot.date}_${slot.time}`]?.length}
                                                                </span>
                                                            )}
                                                        </button>
                                                    )}
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/5 text-muted-foreground border border-white/10">
                                                        👥 {totalAttendees}
                                                    </span>
                                                    <span className="px-3 py-1 rounded-full text-[10px] font-black bg-primary/20 text-primary border border-primary/30">
                                                        Score: {typeof slot.final_score === 'number' ? parseFloat(slot.final_score.toFixed(1)) : (slot.final_score ?? 10)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Full Attendees Section */}
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                                    Can Join Full Duration
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {slot.full_join && slot.full_join.length > 0 ? (
                                                        slot.full_join.map((userId: string) => {
                                                            const user = allAttendees.find(a => a.user_id === userId);
                                                            return (
                                                                <div key={userId} className="flex items-center gap-1.5 bg-green-100 dark:bg-green-500/10 border border-green-300 dark:border-green-500/20 px-2.5 py-1.5 rounded-full" title={user?.displayName || 'Unknown'}>
                                                                    {user?.pictureUrl ? (
                                                                        <img src={user.pictureUrl} alt={user.displayName} className="w-5 h-5 rounded-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                                                                            {user?.displayName?.slice(0, 1) || '?'}
                                                                        </div>
                                                                    )}
                                                                    <span className="text-[11px] font-semibold text-green-700 dark:text-green-400 max-w-[80px] truncate">
                                                                        {user?.displayName || 'Unknown'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">None</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Partial Attendees Section */}
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                                    Partially Available
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {slot.partial_join && slot.partial_join.length > 0 ? (
                                                        slot.partial_join.map((pJoin: any) => {
                                                            const user = allAttendees.find(a => a.user_id === pJoin.user_id);
                                                            return (
                                                                <div key={pJoin.user_id} className="flex items-center gap-1.5 bg-amber-100 dark:bg-yellow-500/10 border border-amber-300 dark:border-yellow-500/20 px-2.5 py-1.5 rounded-full" title={user?.displayName || 'Unknown'}>
                                                                    {user?.pictureUrl ? (
                                                                        <img src={user.pictureUrl} alt={user.displayName} className="w-5 h-5 rounded-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                                                                            {user?.displayName?.slice(0, 1) || '?'}
                                                                        </div>
                                                                    )}
                                                                    <span className="text-[11px] font-semibold text-amber-700 dark:text-yellow-400 max-w-[80px] truncate">
                                                                        {user?.displayName || 'Unknown'}
                                                                    </span>
                                                                    <span className="text-[9px] bg-amber-200 dark:bg-yellow-500/20 text-amber-800 dark:text-yellow-300 px-1.5 py-0.5 rounded-md font-bold">
                                                                        {pJoin.overlap_text}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">None</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Suggested Restaurants Section – collapsible */}
                                            {filteredRestaurants.length > 0 && (
                                                <details className="pt-2 border-t border-white/5 group">
                                                    <summary className="flex items-center justify-between cursor-pointer list-none py-1">
                                                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                                            🍽️ Suggested Restaurants ({filteredRestaurants.length})
                                                        </h4>
                                                        <span className="text-[10px] text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                                                    </summary>
                                                    <div className="grid gap-2 mt-2">
                                                        {filteredRestaurants.map((place: any) => (
                                                            <a
                                                                key={place.id}
                                                                href={`https://${place.wongnai_link}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 hover:bg-white/10 transition-all group"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-lg">🍱</span>
                                                                    <div className="text-left">
                                                                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                                                            {place.name}
                                                                        </span>
                                                                        {place.category && (
                                                                            <p className="text-[9px] text-muted-foreground">
                                                                                {Array.isArray(place.category) ? place.category.slice(0, 2).join(', ') : ''}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-[10px] font-black text-primary">
                                                                        Match: {typeof place.score === 'number' ? parseFloat(place.score.toFixed(1)) : place.score}/100
                                                                    </span>
                                                                </div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    );
                                })
                            )
                        ) : (
                            filteredSuggestions.length === 0 && suggestions.length > 0 ? (
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

                                        const vetoCount = votingState.restaurant_vetoes?.[place.name] || 0;
                                        const prefCount = votingState.restaurant_preferences?.[place.name]?.length || 0;
                                        const isPreferredByMe = votingState.restaurant_preferences?.[place.name]?.includes(currentUserId) || false;
                                        const isVetoedByMe = votingState.user_vetoed?.includes(place.name) || false;

                                        return (
                                            <div
                                                key={place.id}
                                                onClick={() => window.open(`https://${place.wongnai_link}`, '_blank', 'noopener,noreferrer')}
                                                className={`block glass-panel overflow-hidden rounded-2xl animate-in slide-in-from-bottom-4 duration-500 shadow-lg border transition-all cursor-pointer group ${vetoCount > 0
                                                    ? 'opacity-60 saturate-[0.2] border-red-500/10'
                                                    : 'border-white/5 hover:border-primary/40 hover:bg-white/5'
                                                    }`}
                                                style={{ animationDelay: `${index * 100}ms` }}
                                            >
                                                <div className="h-32 w-full relative bg-gradient-to-r from-gray-700 to-gray-600">
                                                    {viewMode === 'restaurants' && restaurantSubTab === 'suggested' && index < 3 && (
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
                                                    {vetoCount > 0 && (
                                                        <div className="absolute bottom-2 left-2 glass-panel px-2 py-0.5 rounded-md border border-red-500/30 bg-red-950/40 z-20">
                                                            <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">⚠️ Tailed Out</span>
                                                        </div>
                                                    )}
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

                                                    <div className="flex flex-wrap gap-1 mb-3">
                                                        {(() => {
                                                            try {
                                                                const cats = typeof place.category === 'string'
                                                                    ? JSON.parse(place.category.replace(/'/g, '"'))
                                                                    : (Array.isArray(place.category) ? place.category : []);
                                                                return cats.slice(0, 3).map((c: string) => (
                                                                    <span key={c} className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] font-bold text-muted-foreground">
                                                                        {c}
                                                                    </span>
                                                                ));
                                                            } catch (e) {
                                                                return null;
                                                            }
                                                        })()}
                                                    </div>

                                                    {expandedReasonIds.has(place.id) && (
                                                        <div className="mt-3 pt-3 border-t border-white/5 space-y-2 animate-in fade-in duration-300">
                                                            {(() => {
                                                                let reasonObj = place.reason;
                                                                if (typeof reasonObj === 'string') {
                                                                    try { reasonObj = JSON.parse(reasonObj.replace(/'/g, '"')); } catch (e) { }
                                                                }
                                                                if (!reasonObj || typeof reasonObj !== 'object' || Array.isArray(reasonObj)) return null;

                                                                return (
                                                                    <div className="grid grid-cols-2 gap-2 mb-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                        {Object.entries(reasonObj)
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
                                                                        }
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}

                                                    <div className="text-xs text-center text-primary/50 mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Tap to view on Wongnai →
                                                    </div>

                                                    {status === 'open' && (
                                                        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5 relative z-30">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleTailIn(place.name, e);
                                                                }}
                                                                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all active:scale-95 duration-200 ${isPreferredByMe
                                                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-md shadow-rose-500/10'
                                                                    : 'bg-white/5 text-muted-foreground border-white/5 hover:border-white/10 hover:text-foreground'
                                                                    }`}
                                                            >
                                                                <span>❤️</span>
                                                                <span>{isPreferredByMe ? 'Preferred' : 'Prefer'}</span>
                                                                {prefCount > 0 && (
                                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isPreferredByMe ? 'bg-rose-500/30 text-rose-200' : 'bg-white/10 text-muted-foreground'
                                                                        }`}>
                                                                        {prefCount}
                                                                    </span>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleTailOut(place.name, e);
                                                                }}
                                                                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all active:scale-95 duration-200 ${isVetoedByMe
                                                                    ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-md shadow-red-500/10'
                                                                    : 'bg-white/5 text-muted-foreground border-white/5 hover:border-white/10 hover:text-foreground'
                                                                    }`}
                                                            >
                                                                <span>🚫</span>
                                                                <span>{isVetoedByMe ? 'Vetoed' : 'Veto'}</span>
                                                                {vetoCount > 0 && (
                                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isVetoedByMe ? 'bg-red-500/30 text-red-200' : 'bg-white/10 text-muted-foreground'
                                                                        }`}>
                                                                        {vetoCount}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {viewMode === 'restaurants' && restaurantSubTab === 'suggested' && filteredSuggestions.length > visibleDiscoveryCount && (
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
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ResultPageWithSuspense = () => {
    return (
        <Suspense fallback={<div className="h-[100dvh] flex items-center justify-center bg-background text-muted-foreground text-sm">Loading results...</div>}>
            <ResultPage />
        </Suspense>
    );
};

export default ResultPageWithSuspense;
