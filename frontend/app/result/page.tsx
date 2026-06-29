'use client'
import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiff } from '@/app/context/LiffContext';
import { apiService } from '@/app/services/api';
import SurveyModal from '@/app/components/survey-modal/survey-modal';
import SurveyModeBanner from '@/app/components/survey-mode-banner/survey-mode-banner';

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
        router.replace('/');
        return null;
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
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${meeting.status === 'open'
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
    const { liffObject } = useLiff();
    const [suggestionsMap, setSuggestionsMap] = useState<any>(null);
    const [preferredRestaurants, setPreferredRestaurants] = useState<any[]>([]);
    const [discoveryRestaurants, setDiscoveryRestaurants] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'slots' | 'restaurants'>('slots');
    // Sub-tab inside the Restaurants tab: 'friends' (suggested by attendees) | 'suggested' (by system) | 'all' (all scored, when suggest_per_time=false)
    const [restaurantSubTab, setRestaurantSubTab] = useState<'friends' | 'suggested' | 'all'>('friends');
    const [showFilters, setShowFilters] = useState(false);
    const [pendingSlotVotes, setPendingSlotVotes] = useState<Set<string>>(new Set());
    const [pendingRestaurantVotes, setPendingRestaurantVotes] = useState<Set<string>>(new Set());
    const [wasReady, setWasReady] = useState<boolean | null>(null);
    const [meetingData, setMeetingData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('open'); // 'open' | 'closed'
    const [missingVoters, setMissingVoters] = useState<any[]>([]);

    const [confirmedTimeSlot, setConfirmedTimeSlot] = useState<string>("");
    const [confirmedRestaurant, setConfirmedRestaurant] = useState<string>("");
    const [isSurveyOpen, setIsSurveyOpen] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchWrapperRef = useRef<HTMLDivElement>(null);

    // Close search dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
                setSearchResults([]);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [searchWrapperRef]);

    const searchParams = useSearchParams();
    const isSurveyMode = searchParams?.get('survey_mode') === 'true';

    const currentUserId = useMemo(() => {
        return profile?.userId || paramUserId || 'mock-user-id';
    }, [profile, paramUserId]);

    const votingState = useMemo(() => {
        return meetingData?.voting_state || {};
    }, [meetingData]);

    const isOrganizer = useMemo(() => {
        return meetingData?.initial_data?.organizer_id === currentUserId;
    }, [meetingData, currentUserId]);

    const isFixedTime = useMemo(() => {
        return (meetingData?.initial_data?.timing_mode || 'period') === 'fixed';
    }, [meetingData]);

    const isFixedRestaurant = useMemo(() => {
        return (meetingData?.initial_data?.fixed_restaurants?.length || 0) > 0;
    }, [meetingData]);

    const hasVotedTime = useMemo(() => {
        return pendingSlotVotes.size > 0;
    }, [pendingSlotVotes]);

    const hasVotedRestaurant = useMemo(() => {
        return pendingRestaurantVotes.size > 0 || (votingState.user_vetoed && votingState.user_vetoed.length > 0);
    }, [pendingRestaurantVotes, votingState.user_vetoed]);

    const canToggleReady = useMemo(() => {
        const timeCheck = isFixedTime || hasVotedTime;
        const restaurantCheck = isFixedRestaurant || hasVotedRestaurant;
        return timeCheck && restaurantCheck;
    }, [isFixedTime, hasVotedTime, isFixedRestaurant, hasVotedRestaurant]);

    const isCurrentUserReady = useMemo(() => {
        return votingState.ready_users?.includes(currentUserId) || false;
    }, [votingState.ready_users, currentUserId]);

    const isSpinningTime = useMemo(() => {
        return votingState.wheel_state?.status === 'spinning' && votingState.wheel_state?.target_type === 'time';
    }, [votingState]);

    const isSpinningRestaurant = useMemo(() => {
        return votingState.wheel_state?.status === 'spinning' && votingState.wheel_state?.target_type === 'restaurant';
    }, [votingState]);

    const getSlotVoteCount = (slotKey: string) => {
        const users = votingState.time_votes?.[slotKey] || [];
        const hasVotedInDb = users.includes(currentUserId);
        const isPendingVoted = pendingSlotVotes?.has(slotKey);

        if (hasVotedInDb && !isPendingVoted) {
            return Math.max(0, users.length - 1);
        } else if (!hasVotedInDb && isPendingVoted) {
            return users.length + 1;
        }
        return users.length;
    };

    const getRestaurantPrefCount = (restaurantName: string) => {
        const users = votingState.restaurant_preferences?.[restaurantName] || [];
        const hasVotedInDb = users.includes(currentUserId);
        const isPendingVoted = pendingRestaurantVotes?.has(restaurantName);

        if (hasVotedInDb && !isPendingVoted) {
            return Math.max(0, users.length - 1);
        } else if (!hasVotedInDb && isPendingVoted) {
            return users.length + 1;
        }
        return users.length;
    };

    const liveVenueCandidates = useMemo(() => {
        let list = [...preferredRestaurants];

        const votedNames = new Set([
            ...Object.keys(votingState.restaurant_preferences || {}).filter(name => (votingState.restaurant_preferences[name]?.length || 0) > 0),
            ...Object.keys(votingState.restaurant_vetoes || {}).filter(name => {
                const val = votingState.restaurant_vetoes[name];
                return typeof val === 'number' ? val > 0 : (val?.length || 0) > 0;
            })
        ]);

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

        let mappedList = list.map(place => {
            const prefCount = getRestaurantPrefCount(place.name);
            const rawVeto = votingState.restaurant_vetoes?.[place.name];
            const vetoCount = typeof rawVeto === 'number' ? rawVeto : (rawVeto?.length || 0);
            const netVotes = prefCount - vetoCount;
            return {
                ...place,
                prefCount,
                vetoCount,
                netVotes
            };
        });

        if (votingState.exclude_vetoed) {
            mappedList = mappedList.filter(place => (place.vetoCount || 0) === 0);
        }

        return mappedList.sort((a, b) => {
            if (b.netVotes !== a.netVotes) {
                return b.netVotes - a.netVotes;
            }
            return (b.score || 0) - (a.score || 0);
        });
    }, [preferredRestaurants, discoveryRestaurants, votingState]);

    const getHighlights = (place: any) => {
        let reasonObj = place.reason;
        if (typeof reasonObj === 'string') {
            try { reasonObj = JSON.parse(reasonObj.replace(/'/g, '"')); } catch (e) { }
        }
        if (!reasonObj || typeof reasonObj !== 'object' || Array.isArray(reasonObj)) return [];

        const badges: Array<{ text: string; type: 'success' | 'warning' | 'info' | 'purple' | 'gold' }> = [];

        const attendeeScores = reasonObj._attendee_scores || {};
        const keyScores: number[] = [];
        Object.entries(attendeeScores).forEach(([uid, uData]: [string, any]) => {
            const att = allAttendees.find(a => a.user_id === uid);
            if (att?.is_key_person) {
                keyScores.push(uData.score || 0);
            }
        });
        if (keyScores.length > 0) {
            const avgKeyScore = keyScores.reduce((a, b) => a + b, 0) / keyScores.length;
            if (avgKeyScore >= 85) {
                badges.push({ text: '👑 Key Choice', type: 'gold' });
            }
        }

        const isFactorMatch = (factor: any) => {
            if (!factor) return false;
            const max = factor.max_score || 0;
            if (max <= 0) return false;
            const score = factor.weighted_score || 0;
            return Math.round((score / max) * 100) >= 100;
        };

        if (reasonObj.Price && isFactorMatch(reasonObj.Price)) {
            badges.push({ text: '💰 Budget Match', type: 'success' });
        }

        if (reasonObj.Category && isFactorMatch(reasonObj.Category)) {
            badges.push({ text: '🍽️ Cuisine Match', type: 'success' });
        }

        if (reasonObj.Station && reasonObj.Station.base_score >= 80) {
            badges.push({ text: '🚇 Transit Friendly', type: 'info' });
        }

        if (reasonObj.Parking && isFactorMatch(reasonObj.Parking)) {
            badges.push({ text: '🚗 Parking', type: 'success' });
        }

        if (reasonObj.Alcohol && isFactorMatch(reasonObj.Alcohol)) {
            badges.push({ text: '🍻 Drinks', type: 'purple' });
        }

        if (reasonObj.Vibe && isFactorMatch(reasonObj.Vibe)) {
            badges.push({ text: '✨ Good Vibe', type: 'purple' });
        }

        return badges;
    };

    const getBestMatchSummary = (place: any): string => {
        let reasonObj = place.reason;
        if (typeof reasonObj === 'string') {
            try { reasonObj = JSON.parse(reasonObj.replace(/'/g, '"')); } catch (e) { }
        }
        if (!reasonObj || typeof reasonObj !== 'object' || Array.isArray(reasonObj)) return "";

        const reasons: string[] = [];

        const isFactorMatch = (factor: any) => {
            if (!factor) return false;
            const max = factor.max_score || 0;
            if (max <= 0) return false;
            const score = factor.weighted_score || 0;
            return Math.round((score / max) * 100) >= 100;
        };

        if (reasonObj.Price && isFactorMatch(reasonObj.Price)) {
            reasons.push("fits the price budget of attendees");
        }
        if (reasonObj.Category && isFactorMatch(reasonObj.Category)) {
            reasons.push("matches the cuisine preferences");
        }
        if (reasonObj.Vibe && isFactorMatch(reasonObj.Vibe)) {
            reasons.push("matches the group's desired vibe");
        }
        if (reasonObj.Station && reasonObj.Station.base_score >= 80) {
            reasons.push("is highly convenient via public transit");
        }
        if (reasonObj.Parking && isFactorMatch(reasonObj.Parking)) {
            reasons.push("has parking space");
        }
        if (reasonObj.Alcohol && isFactorMatch(reasonObj.Alcohol)) {
            reasons.push("serves alcohol/drinks");
        }
        if (place.rating && place.rating >= 4.0) {
            reasons.push(`has a great rating of ${place.rating.toFixed(1)}`);
        }

        if (reasons.length === 0) {
            return "Ranked highly based on overall criteria matching.";
        }

        const firstTwo = reasons.slice(0, 2);
        let summaryText = "Recommended because it " + firstTwo.join(" and ");
        if (reasons.length > 2) {
            summaryText += `, and ${reasons[2]}`;
        }
        summaryText += ".";
        return summaryText;
    };

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

    // Whether suggest_per_time is enabled (per-time-slot custom restaurant lists)
    const suggestPerTime = meetingData?.initial_data?.suggest_per_time === true;

    // Auto-switch view mode for fixed timing
    useEffect(() => {
        const mode = meetingData?.initial_data?.timing_mode?.toLowerCase() || 'period';
        const allowSuggest = meetingData?.initial_data?.allow_system_suggest !== false;

        if (mode === 'fixed' && viewMode === 'slots') {
            setViewMode('restaurants');
            if (!suggestPerTime && discoveryRestaurants.length > 0) {
                setRestaurantSubTab('all');
            } else {
                setRestaurantSubTab(allowSuggest ? 'suggested' : 'friends');
            }
        }
    }, [meetingData, suggestPerTime, discoveryRestaurants]);

    // Handle default sub-tab selection based on suggest_per_time and available data
    useEffect(() => {
        if (viewMode === 'restaurants') {
            if (!suggestPerTime) {
                if (restaurantSubTab === 'suggested') {
                    setRestaurantSubTab('all');
                } else if (restaurantSubTab === 'friends' && preferredRestaurants.length === 0 && discoveryRestaurants.length > 0) {
                    setRestaurantSubTab('all');
                }
            } else {
                // When suggest_per_time is true, if we are on 'friends' but have no friend suggestions
                // and we do have suggested (discovery) restaurants, switch to 'suggested'.
                if (restaurantSubTab === 'friends' && preferredRestaurants.length === 0 && discoveryRestaurants.length > 0) {
                    setRestaurantSubTab('suggested');
                }
            }
        }
    }, [viewMode, suggestPerTime, restaurantSubTab, preferredRestaurants.length, discoveryRestaurants.length]);

    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [selectedVibe, setSelectedVibe] = useState<string>('All');
    const [activeFilters, setActiveFilters] = useState<Record<string, number>>({});
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

    const [selectedDate, setSelectedDate] = useState<string>("");
    const [selectedTime, setSelectedTime] = useState<string>("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [allAttendees, setAllAttendees] = useState<any[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const fetchingRef = useRef(false);

    const [expandedReasonIds, setExpandedReasonIds] = useState<Set<string>>(new Set());
    const [expandedTabs, setExpandedTabs] = useState<Record<string, 'factor' | 'attendee'>>({});

    const [visibleDiscoveryCount, setVisibleDiscoveryCount] = useState(10);
    const [error, setError] = useState<string | null>(null);

    const filterRestaurants = useCallback((restaurantList: any[]) => {
        if (!restaurantList) return [];
        return restaurantList.filter(p => {
            const cats = typeof p.category === 'string'
                ? JSON.parse(p.category.replace(/'/g, '"'))
                : (Array.isArray(p.category) ? p.category : []);
            const categoryMatch = selectedCategory === 'All' || cats.includes(selectedCategory);

            const vibes = typeof p.good_fors === 'string'
                ? JSON.parse(p.good_fors.replace(/'/g, '"'))
                : (Array.isArray(p.good_fors) ? p.good_fors : []);
            const vibeMatch = selectedVibe === 'All' || vibes.includes(selectedVibe);

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

            return allCriteriaMatch && categoryMatch && vibeMatch;
        });
    }, [selectedCategory, selectedVibe, activeFilters, meetingData]);

    const filteredSuggestions = useMemo(() => {
        return filterRestaurants(suggestions);
    }, [suggestions, filterRestaurants]);

    const visibleSuggestions = useMemo(() => {
        return viewMode === 'restaurants' && (restaurantSubTab === 'suggested' || restaurantSubTab === 'all')
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
        const compareTime = (a: any, b: any) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        };
        if (slotSortKey === 'score') {
            copy.sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0) || count(b) - count(a) || compareTime(a, b));
        } else {
            copy.sort((a, b) => count(b) - count(a) || (b.final_score ?? 0) - (a.final_score ?? 0) || compareTime(a, b));
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

    const availableVibes = useMemo(() => {
        const vibes = new Set<string>();
        vibes.add('All');

        const allSources = [
            ...(suggestionsMap ? Object.values(suggestionsMap).flatMap((times: any) =>
                Object.values(times).flatMap((slot: any) => Array.isArray(slot) ? slot : (slot.restaurants || []))
            ) : []),
            ...preferredRestaurants,
            ...discoveryRestaurants
        ];

        allSources.forEach((p: any) => {
            try {
                const pVibes = typeof p.good_fors === 'string'
                    ? JSON.parse(p.good_fors.replace(/'/g, '"'))
                    : (Array.isArray(p.good_fors) ? p.good_fors : []);
                pVibes.forEach((v: string) => vibes.add(v));
            } catch (e) { }
        });
        return Array.from(vibes);
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
            } else if (restaurantSubTab === 'all') {
                setSuggestions(discoveryRestaurants);
            } else {
                setSuggestions(discoveryRestaurants);
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

            const missing = enrichedAttendees.filter((a: any) => a.preference === null);
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
                    const missing = attendees.filter((a: any) => a.preference === null);
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

    useEffect(() => {
        if (!votingState || !currentUserId) return;

        // If user is ready, keep pending state synced to database
        if (isCurrentUserReady) {
            const slots = new Set<string>();
            Object.entries(votingState.time_votes || {}).forEach(([slotKey, users]: [string, any]) => {
                if (Array.isArray(users) && users.includes(currentUserId)) {
                    slots.add(slotKey);
                }
            });
            setPendingSlotVotes(slots);

            const rests = new Set<string>();
            Object.entries(votingState.restaurant_preferences || {}).forEach(([restName, users]: [string, any]) => {
                if (Array.isArray(users) && users.includes(currentUserId)) {
                    rests.add(restName);
                }
            });
            setPendingRestaurantVotes(rests);
            setWasReady(true);
        } else {
            // If user was ready, or this is first load (wasReady is null), initialize the pending state
            if (wasReady === null || wasReady === true) {
                const slots = new Set<string>();
                Object.entries(votingState.time_votes || {}).forEach(([slotKey, users]: [string, any]) => {
                    if (Array.isArray(users) && users.includes(currentUserId)) {
                        slots.add(slotKey);
                    }
                });
                setPendingSlotVotes(slots);

                const rests = new Set<string>();
                Object.entries(votingState.restaurant_preferences || {}).forEach(([restName, users]: [string, any]) => {
                    if (Array.isArray(users) && users.includes(currentUserId)) {
                        rests.add(restName);
                    }
                });
                setPendingRestaurantVotes(rests);
                setWasReady(false);
            }
        }
    }, [votingState, currentUserId, isCurrentUserReady, wasReady]);

    const handleToggleTimeVote = (date: string, time: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isSurveyMode) { alert("🔍 Preview Mode — cannot vote in survey mode."); return; }
        if (isCurrentUserReady) return;

        const slotKey = `${date}_${time}`;
        setPendingSlotVotes(prev => {
            const next = new Set(prev);
            if (next.has(slotKey)) {
                next.delete(slotKey);
            } else {
                next.add(slotKey);
            }
            return next;
        });
    };



    // --- Restaurant Search ---
    const handleSearch = async (keyword: string) => {
        setSearchTerm(keyword);
        if (keyword.length > 2) {
            setIsSearching(true);
            try {
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

    const handleToggleTailIn = (restaurantName: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isSurveyMode) { alert("🔍 Preview Mode — cannot vote in survey mode."); return; }
        if (isCurrentUserReady) return;

        setPendingRestaurantVotes(prev => {
            const next = new Set(prev);
            if (next.has(restaurantName)) {
                next.delete(restaurantName);
            } else {
                next.add(restaurantName);
            }
            return next;
        });
    };

    const handleToggleTailOut = async (restaurantName: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isSurveyMode) { alert("🔍 Preview Mode — cannot veto in survey mode."); return; }
        if (isCurrentUserReady) return;
        try {
            const updated = await apiService.toggleTailOut(meetingId, currentUserId, restaurantName);
            setMeetingData(updated);
            await loadResultData();
        } catch (err) {
            console.error("Toggle veto failed:", err);
        }
    };

    const handleToggleReady = async () => {
        try {
            if (isSurveyMode) { alert("🔍 Preview Mode — cannot mark ready in survey mode."); return; }
            if (!isCurrentUserReady) {
                const votedSlots = Array.from(pendingSlotVotes);
                const votedRestaurants = Array.from(pendingRestaurantVotes);
                await apiService.submitVotes(meetingId, currentUserId, votedSlots, votedRestaurants);
            }
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

    const handleSelectWheelTimeSlots = async (keys: string[]) => {
        try {
            const updated = await apiService.selectWheelTimeSlots(meetingId, keys);
            setMeetingData(updated);
        } catch (err) {
            console.error("Failed to select wheel time slots:", err);
        }
    };

    const handleToggleTimeSlotForWheel = async (key: string) => {
        const currentList = votingState.selected_time_slots || [];
        const updatedList = currentList.includes(key)
            ? currentList.filter((k: string) => k !== key)
            : [...currentList, key];
        await handleSelectWheelTimeSlots(updatedList);
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
            if (isSurveyMode) { alert("🔍 Preview Mode — cannot confirm in survey mode."); return; }
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
            const selectedKeys = votingState.selected_time_slots || [];
            const slotsToUse = selectedKeys.length > 0
                ? sortedSlots.filter(slot => selectedKeys.includes(`${slot.date}_${slot.time}`))
                : sortedSlots;
            slotsToUse.forEach(slot => {
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
            if (isSurveyMode) { alert("🔍 Preview Mode — cannot spin in survey mode."); return; }
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

    if (isCurrentUserReady && status === 'open') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-6 bg-[#09090b] animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center text-5xl border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.3)] mb-2">
                    🎉
                </div>
                <div className="space-y-3">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 tracking-tight">
                        Votes Submitted!
                    </h1>
                    <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
                        Your preferences have been successfully recorded. 
                        <br />Waiting for other attendees to complete their votes...
                    </p>
                </div>

                <div className="pt-4 flex flex-col gap-3 w-full max-w-xs z-10">
                    <button
                        onClick={() => handleToggleReady()}
                        className="w-full py-4 rounded-xl font-bold text-md border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all flex items-center justify-center gap-2"
                    >
                        ✏️ Edit My Votes
                    </button>
                    
                    <button
                        onClick={() => liffObject?.closeWindow()}
                        className="glass-button w-full py-4 rounded-xl font-bold text-md shadow-lg hover:shadow-green-500/20 transition-all border-green-500/30 bg-green-500/10 text-green-200"
                    >
                        Close Window
                    </button>
                </div>
            </div>
        );
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
            {isSurveyMode && <SurveyModeBanner />}
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
                        const hasRestaurants = (preferredRestaurants.length > 0) || (allowSuggest && discoveryRestaurants.length > 0) || (!suggestPerTime && discoveryRestaurants.length > 0);

                        const tabs: { id: string; label: string }[] = [];
                        if (mode !== 'fixed') tabs.push({ id: 'slots', label: 'Slots' });
                        if (!isFixedRestaurant && hasRestaurants) tabs.push({ id: 'restaurants', label: 'Restaurants' });

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
                {viewMode === 'restaurants' && (
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
                // When suggest_per_time is false, show 'All Restaurants' tab directly (no Suggested sub-tab)
                if (!suggestPerTime) {
                    const hasFriends = preferredRestaurants.length > 0;
                    const hasAll = discoveryRestaurants.length > 0;
                    const showSubTabs = hasFriends && hasAll;
                    return showSubTabs ? (
                        <div className="flex-none px-4 pt-3">
                            <div className="flex p-0.5 bg-white/5 rounded-xl border border-white/5">
                                <button
                                    onClick={() => setRestaurantSubTab('friends')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${restaurantSubTab === 'friends'
                                        ? 'bg-white/10 text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    Friends ({preferredRestaurants.length})
                                </button>
                                <button
                                    onClick={() => setRestaurantSubTab('all')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${restaurantSubTab === 'all'
                                        ? 'bg-white/10 text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    All Restaurants ({discoveryRestaurants.length})
                                </button>
                            </div>
                        </div>
                    ) : null;
                }

                // When suggest_per_time is true, show Friends / Suggested sub-tabs as before
                const hasFriends = preferredRestaurants.length > 0;
                const hasSuggested = (meetingData?.initial_data?.allow_system_suggest !== false) && discoveryRestaurants.length > 0;
                const showSubTabs = hasFriends && hasSuggested;
                return showSubTabs ? (
                    <div className="flex-none px-4 pt-3">
                        <div className="flex p-0.5 bg-white/5 rounded-xl border border-white/5">
                            <button
                                onClick={() => setRestaurantSubTab('friends')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${restaurantSubTab === 'friends'
                                    ? 'bg-white/10 text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Friends ({preferredRestaurants.length})
                            </button>
                            <button
                                onClick={() => setRestaurantSubTab('suggested')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${restaurantSubTab === 'suggested'
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

            {viewMode === 'restaurants' && (
                <div className="flex-none px-4 pt-3 pb-2 border-b border-white/5 bg-background space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Restaurant Options</span>
                        <button
                            type="button"
                            onClick={() => setShowFilters(!showFilters)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-primary/30 text-[9px] font-black uppercase tracking-wider text-muted-foreground hover:text-primary transition-all flex items-center gap-1"
                        >
                            <span>⚡</span>
                            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                        </button>
                    </div>
                    {(suggestPerTime || restaurantSubTab === 'friends') && (
                        <div className="relative space-y-2" ref={searchWrapperRef}>
                            {/* <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search & Prefer/Veto Restaurants</label>
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-violet-500/10 border border-violet-500/30 text-violet-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5"><path d="M10 1a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 14a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349-4.063-1.628V17h2a1 1 0 110 2H7a1 1 0 110-2h2V5.273L4.952 6.898l1.715 5.35a1 1 0 01-.285 1.049A3.989 3.989 0 014 14a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L8 3.323V2a1 1 0 011-1h1z"/></svg>
                                    AI Search
                                </span>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="พิมพ์ชื่อร้าน หรืออธิบายสิ่งที่อยากกิน เช่น ปลาทอด รามอินทรา..."
                                    value={searchTerm}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="glass-input w-full p-3 pr-9 rounded-xl text-sm font-medium"
                                />
                                {isSearching && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <svg className="animate-spin h-4 w-4 text-violet-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                        </svg>
                                    </span>
                                )}
                            </div> */}

                            {searchResults.length > 0 && (
                                <div className="absolute left-0 right-0 z-50 mt-2 bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl max-h-72 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 divide-y divide-white/5">
                                    {searchResults.map((place, idx) => {
                                        const isPreferredByMe = pendingRestaurantVotes.has(place.name);
                                        const isVetoedByMe = votingState.user_vetoed?.includes(place.name) || false;
                                        const prefCount = getRestaurantPrefCount(place.name);
                                        const vetoCount = votingState.restaurant_vetoes?.[place.name] || 0;

                                        return (
                                            <div
                                                key={idx}
                                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="font-bold text-sm text-primary dark:text-white truncate">{place.name}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">
                                                        {place.category ? (Array.isArray(place.category) ? place.category[0] : place.category) : ''}
                                                        {place.price ? ` • ${place.price}` : ''}
                                                        {place.address ? ` • ${place.address.split(' ').slice(-3).join(' ')}` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        disabled={isCurrentUserReady}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleTailIn(place.name, e);
                                                        }}
                                                        className={`flex items-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all duration-200 ${isPreferredByMe
                                                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-md shadow-rose-500/10'
                                                            : 'bg-white/5 text-muted-foreground border-white/5 hover:border-white/10 hover:text-foreground'
                                                            } ${isCurrentUserReady ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'active:scale-95'}`}
                                                    >
                                                        <span>❤️</span>
                                                        <span>{isPreferredByMe ? 'Preferred' : 'Prefer'}</span>
                                                        {prefCount > 0 && <span className="text-[9px] bg-rose-500/30 text-rose-200 px-1.5 py-0.5 rounded-full">{prefCount}</span>}
                                                    </button>
                                                    <button
                                                        disabled={isCurrentUserReady}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleTailOut(place.name, e);
                                                        }}
                                                        className={`flex items-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all duration-200 ${isVetoedByMe
                                                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/25 hover:opacity-95'
                                                            : 'bg-emerald-500/5 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:scale-[1.01] hover:shadow-[0_4px_12px_rgba(16,185,129,0.1)]'
                                                            } ${isCurrentUserReady ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'active:scale-95'}`}
                                                    >
                                                        <span>🚫</span>
                                                        <span>{isVetoedByMe ? 'Vetoed' : 'Veto'}</span>
                                                        {vetoCount > 0 && (
                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isVetoedByMe ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                                                {vetoCount}
                                                            </span>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cuisine and Vibe selectors */}
                    {showFilters && (
                        <div className="space-y-3 pt-1 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                            {availableCategories.length > 1 && (
                                <div className="space-y-1">
                                    <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Cuisine / Category</span>
                                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                                        {availableCategories.map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setSelectedCategory(cat)}
                                                className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${selectedCategory === cat
                                                    ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                                                    : 'bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/5'
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {availableVibes.length > 1 && (
                                <div className="space-y-1">
                                    <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Vibe / Environment</span>
                                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                                        {availableVibes.map((vibe) => (
                                            <button
                                                key={vibe}
                                                type="button"
                                                onClick={() => setSelectedVibe(vibe)}
                                                className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${selectedVibe === vibe
                                                    ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                                                    : 'bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/5'
                                                    }`}
                                            >
                                                {vibe}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

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
                    {suggestions.length === 0 && viewMode === 'restaurants' && (
                        <div className="max-w-md mx-auto text-center py-16 px-6 glass-panel rounded-3xl border border-white/5 animate-in fade-in zoom-in duration-700">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-inner">
                                <span className="text-4xl">🍽️</span>
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-2">
                                {restaurantSubTab === 'friends'
                                    ? 'No Friend Suggestions'
                                    : restaurantSubTab === 'all'
                                        ? 'No Restaurants Found'
                                        : 'No Suggested Restaurants'}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {restaurantSubTab === 'friends'
                                    ? 'No one has suggested a specific restaurant yet.'
                                    : restaurantSubTab === 'all'
                                        ? 'No restaurants have been scored yet. Check back soon.'
                                        : 'System recommendations are still being generated. Check back soon.'}
                            </p>
                            <button
                                onClick={() => setViewMode('slots')}
                                className="mt-8 text-xs font-bold text-primary uppercase tracking-widest hover:underline"
                            >
                                Go to Slots
                            </button>
                        </div>
                    )}

                    <div className="max-w-lg mx-auto space-y-4">
                        {viewMode === 'slots' ? (
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
                                                    {/* {status === 'open' && (
                                                        <button
                                                            disabled={isCurrentUserReady}
                                                            onClick={(e) => handleToggleTimeVote(slot.date, slot.time, e)}
                                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${votingState.time_votes?.[`${slot.date}_${slot.time}`]?.includes(currentUserId)
                                                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-sm'
                                                                : 'bg-white/5 text-muted-foreground border-white/10 hover:border-white/20'
                                                                } ${isCurrentUserReady ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'active:scale-95'}`}
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
                                                    )} */}
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

                                            {status === 'open' && (
                                                <button
                                                    disabled={isCurrentUserReady}
                                                    onClick={(e) => handleToggleTimeVote(slot.date, slot.time, e)}
                                                    className={"w-full mt-4 py-3.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm " + (
                                                        pendingSlotVotes.has(slot.date + "_" + slot.time)
                                                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/25 hover:opacity-95"
                                                            : "bg-primary/5 text-primary border-primary/30 hover:bg-primary/10 hover:border-primary/50 hover:scale-[1.01] hover:shadow-[0_4px_12px_rgba(245,131,87,0.1)]"
                                                    ) + (isCurrentUserReady ? " opacity-40 cursor-not-allowed pointer-events-none" : "")}
                                                >
                                                    <span>{pendingSlotVotes.has(slot.date + "_" + slot.time) ? "✅ Chosen (Preferred)" : "👍 Select This Time"}</span>
                                                    {/* {getSlotVoteCount(slot.date + "_" + slot.time) > 0 && (
                                                        <span className={"text-[9px] font-black px-1.5 py-0.5 rounded-full " + (
                                                            pendingSlotVotes.has(slot.date + "_" + slot.time)
                                                                ? "bg-white/20 text-white"
                                                                : "bg-primary/10 text-primary border border-primary/20"
                                                        )}>
                                                            {getSlotVoteCount(slot.date + "_" + slot.time)}
                                                        </span>
                                                    )} */}
                                                </button>
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
                                            setSelectedVibe('All');
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
                                        const isPreferredByMe = pendingRestaurantVotes.has(place.name);
                                        const isVetoedByMe = votingState.user_vetoed?.includes(place.name) || false;
                                        const vetoLabel = isVetoedByMe
                                            ? (vetoCount > 1 ? "Vetoed by you & others" : "Vetoed by you")
                                            : "Vetoed by some of your attendees";

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
                                                    {viewMode === 'restaurants' && (restaurantSubTab === 'suggested' || restaurantSubTab === 'all') && index < 3 && (
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
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                                                                <span>
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
                                                                </span>
                                                                {typeof place.distance_km === 'number' && (
                                                                    <span className="text-[10px] text-primary/70 font-semibold">
                                                                        • 📍 {place.distance_km.toFixed(1)} km from center
                                                                    </span>
                                                                )}
                                                            </p>
                                                            {vetoCount > 0 && (
                                                                <p className="text-[10px] text-red-400 font-medium mt-1">
                                                                    🚫 {vetoLabel}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="text-right shrink-0 ml-2">
                                                            <p className="text-sm font-medium text-primary">{place.price}</p>
                                                            <p className="text-[10px] text-muted-foreground">⭐ {place.rating ? place.rating.toFixed(1) : '-'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                                        {getHighlights(place).map((badge, bIdx) => {
                                                            const colorClasses =
                                                                badge.type === 'gold' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                                    badge.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                                        badge.type === 'info' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                                                            'bg-purple-500/10 text-purple-400 border border-purple-500/20';
                                                            return (
                                                                <span
                                                                    key={bIdx}
                                                                    className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${colorClasses}`}
                                                                >
                                                                    {badge.text}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>

                                                    {expandedReasonIds.has(place.id) && (
                                                        <div className="mt-3 pt-3 border-t border-white/5 space-y-2 animate-in fade-in duration-300">
                                                            {(() => {
                                                                let reasonObj = place.reason;
                                                                if (typeof reasonObj === 'string') {
                                                                    try { reasonObj = JSON.parse(reasonObj.replace(/'/g, '"')); } catch (e) { }
                                                                }
                                                                if (!reasonObj || typeof reasonObj !== 'object' || Array.isArray(reasonObj)) return null;

                                                                const activeTab = expandedTabs[place.id] || 'factor';

                                                                return (
                                                                    <div className="flex flex-col gap-2">
                                                                        {/* Tab Header */}
                                                                        <div className="flex border-b border-white/5 mb-2 relative z-30">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setExpandedTabs(prev => ({ ...prev, [place.id]: 'factor' }));
                                                                                }}
                                                                                className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${activeTab === 'factor' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                                                            >
                                                                                Factor
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setExpandedTabs(prev => ({ ...prev, [place.id]: 'attendee' }));
                                                                                }}
                                                                                className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${activeTab === 'attendee' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                                                            >
                                                                                Attendee
                                                                            </button>
                                                                        </div>

                                                                        {/* Tab Content */}
                                                                        {activeTab === 'factor' ? (
                                                                            <div className="grid grid-cols-2 gap-2 mb-3 animate-in fade-in duration-200">
                                                                                {Object.entries(reasonObj)
                                                                                    .filter(([key]) => key !== 'Fixed' && key !== '_attendee_scores')
                                                                                    .sort(([keyA, detailsA]: [any, any], [keyB, detailsB]: [any, any]) => {
                                                                                        const maxA = detailsA.max_score || 0;
                                                                                        const maxB = detailsB.max_score || 0;
                                                                                        if (maxB !== maxA) return maxB - maxA;
                                                                                        return keyA.localeCompare(keyB);
                                                                                    })
                                                                                    .map(([key, details]: [string, any], i: number) => {
                                                                                        const score = details.weighted_score;
                                                                                        const max = details.max_score || 1;
                                                                                        const percentage = max > 0 ? Math.round((score / max) * 100) : 0;
                                                                                        return (
                                                                                            <div key={i} className="bg-white/5 rounded-xl p-2 border border-white/10 hover:bg-white/5 transition-colors">
                                                                                                <div className="flex justify-between items-center mb-1.5">
                                                                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider line-clamp-1">{key}</span>
                                                                                                    <span className="text-[10px] font-black text-primary shrink-0 flex items-center gap-1">
                                                                                                        <span>{percentage}%</span>
                                                                                                        <span className="text-[8px] text-muted-foreground font-medium">({typeof score === 'number' ? parseFloat(score.toFixed(1)) : score}/{parseFloat(max.toFixed(1))})</span>
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
                                                                        ) : (
                                                                            <div className="space-y-1.5 mb-3 animate-in fade-in duration-200">
                                                                                {(() => {
                                                                                    const attendeeScores = (reasonObj as any)._attendee_scores || {};
                                                                                    const sortedAttendees = Object.values(attendeeScores).sort((a: any, b: any) => b.score - a.score);

                                                                                    if (sortedAttendees.length === 0) {
                                                                                        return (
                                                                                            <div className="text-center py-4 text-xs text-muted-foreground">
                                                                                                No attendee scores available
                                                                                            </div>
                                                                                        );
                                                                                    }

                                                                                    return sortedAttendees.map((att: any, idx: number) => (
                                                                                        <div key={idx} className="flex items-center justify-between bg-white/5 rounded-xl p-2 border border-white/10">
                                                                                            <div className="flex items-center gap-2">
                                                                                                {att.pictureUrl ? (
                                                                                                    <img
                                                                                                        src={att.pictureUrl}
                                                                                                        alt={att.name}
                                                                                                        className="w-5 h-5 rounded-full border border-white/10 object-cover"
                                                                                                    />
                                                                                                ) : (
                                                                                                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary border border-primary/20">
                                                                                                        {att.name ? att.name.charAt(0).toUpperCase() : '?'}
                                                                                                    </div>
                                                                                                )}
                                                                                                <span className="text-[11px] font-bold text-foreground line-clamp-1">{att.name}</span>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                                                <div className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20">
                                                                                                    {att.score}%
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    ));
                                                                                })()}
                                                                            </div>
                                                                        )}
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
                                                                disabled={isCurrentUserReady}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleTailIn(place.name, e);
                                                                }}
                                                                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all duration-200 ${isPreferredByMe
                                                                    ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/25 hover:opacity-95'
                                                                    : 'bg-rose-500/5 text-rose-300 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/50 hover:scale-[1.01] hover:shadow-[0_4px_12px_rgba(244,63,94,0.1)]'
                                                                    } ${isCurrentUserReady ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'active:scale-95'}`}
                                                            >
                                                                <span>❤️</span>
                                                                <span>{isPreferredByMe ? 'Preferred' : 'Prefer'}</span>
                                                                {prefCount > 0 && (
                                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isPreferredByMe ? 'bg-white/20 text-white' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                                        }`}>
                                                                        {prefCount}
                                                                    </span>
                                                                )}
                                                            </button>
                                                            <button
                                                                disabled={isCurrentUserReady}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleTailOut(place.name, e);
                                                                }}
                                                                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all duration-200 ${isVetoedByMe
                                                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/25 hover:opacity-95'
                                                                    : 'bg-emerald-500/5 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:scale-[1.01] hover:shadow-[0_4px_12px_rgba(16,185,129,0.1)]'
                                                                    } ${isCurrentUserReady ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'active:scale-95'}`}
                                                            >
                                                                <span>🚫</span>
                                                                <span>{isVetoedByMe ? 'Vetoed' : 'Veto'}</span>
                                                                {vetoCount > 0 && (
                                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isVetoedByMe ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
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

                                    {viewMode === 'restaurants' && (restaurantSubTab === 'suggested' || restaurantSubTab === 'all') && filteredSuggestions.length > visibleDiscoveryCount && (
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
            {/* STICKY BOTTOM SUBMIT VOTE & DECISION BAR */}
            {status === 'open' && (
                <div className="flex-none p-4 bg-[#09090b]/95 backdrop-blur-md border-t border-white/5 shadow-[0_-4px_12px_rgba(0,0,0,0.5)] z-20">
                    <div className="max-w-lg mx-auto space-y-3">
                        {!isCurrentUserReady ? (
                            <div className="space-y-2">
                                <button
                                    disabled={!canToggleReady}
                                    onClick={handleToggleReady}
                                    className="glass-button w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
                                >
                                    <span>📤 Submit My Votes</span>
                                </button>
                                <p className="text-[10px] text-center text-muted-foreground">
                                    {!canToggleReady
                                        ? "Select your preferred time slots and restaurants to submit."
                                        : "Ready to submit your preferences to the group!"}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center flex flex-col items-center justify-center gap-1">
                                    <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                        <span>✅</span> Votes submitted! Waiting for others...
                                    </p>
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                                        All preferences submitted. You can still edit them if needed.
                                    </p>
                                </div>
                                <button
                                    onClick={handleToggleReady}
                                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                                >
                                    ✏️ Edit My Votes
                                </button>
                            </div>
                        )}

                        {/* {isOrganizer && (
                            <button
                                onClick={() => router.push(`/decision?group_id=${groupId}&meeting_id=${meetingId}`)}
                                className="w-full py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
                            >
                                <span>🎯</span> Go to Decision Page
                            </button>
                        )} */}
                    </div>
                </div>
            )}

            {status === 'closed' && (
                <div className="flex-none p-4 bg-[#09090b]/95 backdrop-blur-md border-t border-white/5 shadow-[0_-4px_12px_rgba(0,0,0,0.5)] z-20">
                    <div className="max-w-lg mx-auto flex flex-col gap-2">
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-center">
                            <p className="text-xs font-bold text-purple-400">
                                📍 Meeting Finalized!
                            </p>
                        </div>
                        <button
                            onClick={() => router.push(`/decision?group_id=${groupId}&meeting_id=${meetingId}`)}
                            className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
                        >
                            <span>🎯</span> View Final Details
                        </button>
                    </div>
                </div>
            )}

            <SurveyModal
                isOpen={isSurveyOpen}
                onClose={() => setIsSurveyOpen(false)}
                meetingId={meetingId || ''}
                userId={currentUserId}
            />
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
