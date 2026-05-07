'use client'
import { useState, useEffect, useRef } from 'react';
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
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [selectedTime, setSelectedTime] = useState<string>("");
    const [suggestions, setSuggestions] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [meetingData, setMeetingData] = useState<any>(null);
    const [missingVoters, setMissingVoters] = useState<any[]>([]);
    const [status, setStatus] = useState('open'); // 'open' | 'closed'

    const scrollRef = useRef<HTMLDivElement>(null);
    const fetchingRef = useRef(false);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (meetingId && !fetchingRef.current) {
            fetchingRef.current = true;
            loadResultData().finally(() => {
                // In strict mode, we might want to allow refetching if something failed, 
                // but for now, to prevent double-notification race, we keep it true.
            });
        }
    }, [meetingId]); // Removed isLoggedIn/profile dependencies to avoid re-triggering on auth state change which causes race

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
        if (suggestionsMap && selectedDate && selectedTime) {
            const dateSlots = suggestionsMap[selectedDate];
            if (dateSlots && dateSlots[selectedTime]) {
                const slotData = dateSlots[selectedTime];
                // Handle new API structure: { "restaurants": [...], "scores": {...} }
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
        }
    }, [suggestionsMap, selectedDate, selectedTime]);

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
                setSuggestionsMap(resultData);

                // Date/Time selection is now handled by the useEffect hook
                const dates = Object.keys(resultData).sort();
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
                <header className="text-center">
                    <h1 className="text-lg font-bold text-muted-foreground uppercase tracking-widest mb-1">
                        TOP PICKS
                    </h1>
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tracking-tight leading-tight">
                        {meetingData?.meeting_name || "Meeting Result"}
                    </h2>
                    <p className="text-muted-foreground text-xs mt-1">Based on everyone preferences</p>
                    {status === 'closed' && missingVoters.length > 0 &&
                        <span className="inline-block mt-1 px-2 py-0.5 bg-red-500/10 text-red-300 text-[10px] rounded-md border border-red-500/20">
                            ⚠️ Vote closed early
                        </span>
                    }
                </header>
            </div>

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
                                            {time} — Score: {score}/10
                                        </option>
                                    );
                                })}
                            </select>
                            {/* Dropdown Icon */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 pb-8 space-y-4">
                {suggestions.length === 0 && availableTimes.length > 0 && (
                    <div className="text-center py-10 text-muted-foreground text-sm opacity-60">
                        No suggestions found for this time slot. <br />
                        Try picking another time.
                    </div>
                )}

                <div className="max-w-lg mx-auto space-y-4">
                    {suggestions.map((place, index) => {
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
                                    <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-50 group-hover:scale-110 transition-transform duration-300">
                                        🍽️
                                    </div>
                                    <div className="absolute top-2 right-2 glass-panel px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                                        <span className={`font-bold text-xs ${place.score >= 80 ? 'text-green-400' : place.score >= 50 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                            Match: {place.score}/100
                                        </span>
                                    </div>
                                    {/* <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/90">
                                        📍 {place.distance_km?.toFixed(1) ?? '?'} km
                                    </div> */}
                                </div>
                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="text-lg font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{place.name}</h3>
                                            <p className="text-xs text-muted-foreground">
                                                {(() => {
                                                    try {
                                                        // Parse the category string (e.g., "['อาหารไทย', 'ซูชิ']")
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

                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {place.reason?.slice(0, 3).map((r: string, i: number) => (
                                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10">
                                                {r}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="text-xs text-center text-primary/50 mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                        Tap to view on Wongnai →
                                    </div>
                                </div>
                            </a>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ResultPage;
