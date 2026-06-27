'use client'
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/app/context/LiffContext';
import { apiService } from '@/app/services/api';
import VotingForm from '@/app/components/voting-form/voting-form';
import { TimeSlotSelector } from '@/app/components/time-slot-selector/time-slot-selector';
import { parseAvailabilityText } from '@/app/utils/availability-parser';
import SurveyModeBanner from '@/app/components/survey-mode-banner/survey-mode-banner';

const AvailabilityPage = () => {
    const { isLoggedIn, profile, liffObject, error, bypassLiff } = useLiff();
    const router = useRouter();

    const [groupId, setGroupId] = useState<string | null>(null);
    const [meetingId, setMeetingId] = useState<string | null>(null);
    const [paramUserId, setParamUserId] = useState<string | null>(null);
    const [isSurveyMode, setIsSurveyMode] = useState(false);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        setGroupId(searchParams.get('group_id'));
        setMeetingId(searchParams.get('meeting_id'));
        setParamUserId(searchParams.get('user_id'));
        setIsSurveyMode(searchParams.get('survey_mode') === 'true');
    }, []);

    const [meetingData, setMeetingData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [restaurantConfig, setRestaurantConfig] = useState<any>(null);

    const [isInvited, setIsInvited] = useState(false);
    const [checkingInvite, setCheckingInvite] = useState(true);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [allAttendees, setAllAttendees] = useState<any[]>([]);
    const [simulatedUserId, setSimulatedUserId] = useState<string | null>(null);

    useEffect(() => {
        const fetchMeeting = async () => {
            if (!meetingId) return;
            try {
                const [data, config, attendees] = await Promise.all([
                    apiService.getMeeting(meetingId),
                    apiService.getRestaurantConfig(),
                    apiService.getMeetingAttendees(meetingId)
                ]);

                setRestaurantConfig(config);

                // Transform to UI expected format
                const uiData = {
                    name: data.meeting_name,
                    startDate: data.initial_data?.start_date,
                    endDate: data.initial_data?.end_date,
                    mealTime: data.initial_data?.meal_time,
                    organizerId: data.initial_data?.organizer_id,
                    fixedRestaurants: data.initial_data?.fixed_restaurants || [],
                    timingMode: data.initial_data?.timing_mode,
                    fixedDate: data.initial_data?.fixed_date,
                    fixedStartTime: data.initial_data?.fixed_start_time,
                    fixedEndTime: data.initial_data?.fixed_end_time,
                    fixLocation: data.initial_data?.fix_location,
                    fixLocationCoords: data.initial_data?.fix_location_coords,
                    allowSystemSuggest: data.initial_data?.allow_system_suggest,
                    requireAllJoin: data.initial_data?.require_all_join,
                    allowOthersSuggest: data.initial_data?.allow_others_suggest
                };
                setMeetingData(uiData);

                setAllAttendees(attendees);

                // Check Invitation
                const effectiveUserId = simulatedUserId || paramUserId || profile?.userId;
                if (effectiveUserId) {
                    console.log("Effective User ID : ", effectiveUserId);
                    const attendee = attendees.find((a: any) => a.user_id === effectiveUserId);
                    console.log("Attendee : ", attendee);
                    if (attendee) {
                        setIsInvited(true);
                        // Check if already submitted (preference exists and not empty)
                        if (attendee.preference && Object.keys(attendee.preference).length > 0) {
                            setHasSubmitted(true);
                        } else {
                            setHasSubmitted(false);
                        }
                    } else {
                        setIsInvited(false);
                    }
                } else {
                    setIsInvited(false); // No user ID to check against
                }

            } catch (e) {
                console.error("Failed to load meeting", e);
                setIsInvited(false);
            } finally {
                setLoading(false);
                setCheckingInvite(false);
            }
        };

        if (meetingId && (simulatedUserId || paramUserId || profile?.userId)) {
            fetchMeeting();
        } else if (meetingId && !paramUserId && !isLoggedIn) {
            const loadPublicData = async () => {
                try {
                    const [data, config] = await Promise.all([
                        apiService.getMeeting(meetingId),
                        apiService.getRestaurantConfig()
                    ]);
                    setRestaurantConfig(config);
                    setMeetingData({
                        name: data.meeting_name,
                        startDate: data.initial_data?.start_date,
                        endDate: data.initial_data?.end_date,
                        mealTime: data.initial_data?.meal_time,
                        organizerId: data.initial_data?.organizer_id,
                        fixedRestaurants: data.initial_data?.fixed_restaurants || [],
                        timingMode: data.initial_data?.timing_mode,
                        fixedDate: data.initial_data?.fixed_date,
                        fixedStartTime: data.initial_data?.fixed_start_time,
                        fixedEndTime: data.initial_data?.fixed_end_time,
                        fixLocation: data.initial_data?.fix_location,
                        fixLocationCoords: data.initial_data?.fix_location_coords,
                        allowSystemSuggest: data.initial_data?.allow_system_suggest,
                        requireAllJoin: data.initial_data?.require_all_join,
                        allowOthersSuggest: data.initial_data?.allow_others_suggest
                    });
                } catch (e) {
                    console.error("Failed to load public meeting data", e);
                }
                setLoading(false);
                setCheckingInvite(false);
                setIsInvited(false);
            };
            loadPublicData();
        } else {
            setLoading(false);
            setCheckingInvite(false);
            setIsInvited(false);
        }
    }, [meetingId, paramUserId, profile, isLoggedIn, simulatedUserId]);

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                <div className="glass-panel p-8 rounded-2xl flex flex-col items-center gap-6 text-center max-w-sm border border-red-500/10">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-3xl text-red-400">
                        ⚠️
                    </div>
                    <div>
                        <h2 className="text-xl font-bold mb-2">LINE Init Failed</h2>
                        <p className="text-muted-foreground text-xs leading-relaxed mb-4">{error}</p>
                        <p className="text-[10px] text-muted-foreground italic text-left">If you are testing locally or via a tunnel, you can bypass LINE validation to continue.</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                        <button
                            onClick={() => bypassLiff()}
                            className="bg-primary hover:bg-primary/95 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-primary/20"
                        >
                            🧪 Bypass LINE (Use Mock Profile)
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-white/5 hover:bg-white/10 text-foreground font-semibold py-2 px-6 rounded-xl text-xs transition-all"
                        >
                            Retry Connection
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading || checkingInvite) return (
        <div className="flex items-center justify-center min-h-screen p-4">
            <div className="glass-panel p-8 rounded-2xl flex flex-col items-center gap-6 text-center max-w-sm">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <div>
                    <p className="text-gray-300 font-bold mb-1">Initializing LINE Client...</p>
                    <p className="text-[10px] text-muted-foreground">Waiting for LINE SDK to sync.</p>
                </div>
                <button
                    onClick={() => bypassLiff()}
                    className="text-[10px] font-bold text-primary/70 hover:text-primary transition-all border border-dashed border-primary/30 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10"
                >
                    Bypass Initialization (Mock)
                </button>
            </div>
        </div>
    );

    const effectiveUserId = simulatedUserId || paramUserId || profile?.userId;

    if (!isInvited) return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-6 max-w-sm mx-auto">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-3xl">
                🔒
            </div>
            <div>
                <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    {meetingData ? `You are not invited to "${meetingData.name}"` : "You are not invited to this meeting."}
                </p>
                <p className="text-xs text-white/30 mt-2">Active User ID: {effectiveUserId || 'Unknown'}</p>
            </div>

            {/* Simulation/Bypass Helper */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 w-full text-left">
                <span className="text-[10px] font-black text-primary uppercase tracking-wider block">🧪 Developer simulation tool</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Select a registered meeting attendee from the list below to fill in on their behalf (bypassing LIFF validation):
                </p>
                <select
                    value={simulatedUserId || ""}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSimulatedUserId(val || null);
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                >
                    <option value="">-- Choose Attendee --</option>
                    {allAttendees.map((att: any) => (
                        <option key={att.user_id} value={att.user_id}>
                            {att.display_name || att.user_name || att.user_id} ({att.is_key_person ? 'Key' : 'General'})
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );

    // Already submitted screen
    if (hasSubmitted) return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-6 animate-in fade-in zoom-in">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-4xl border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                ✅
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
                    Preferences Submitted
                </h1>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
                    Your availability and food preferences for <span className="text-foreground font-medium">"{meetingData?.name}"</span> are saved.
                </p>
            </div>

            <div className="glass-panel p-4 w-full max-w-xs rounded-xl text-left space-y-2 border border-white/5">
                <p className="text-xs font-bold text-foreground">What happens next?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Once everyone has filled in their preferences, the organizer will share restaurant suggestions in the group chat. You can then vote on which restaurant you prefer.
                </p>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-xs">
                {groupId && meetingId && (
                    <button
                        onClick={() => router.push(`/result?group_id=${groupId}&meeting_id=${meetingId}`)}
                        className="bg-primary text-white font-bold py-3 px-6 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-primary/20"
                    >
                        See Group Suggestions
                    </button>
                )}
                <button
                    onClick={() => {
                        if (liffObject) {
                            liffObject.closeWindow();
                        } else {
                            window.close();
                        }
                    }}
                    className="text-muted-foreground text-sm font-medium hover:text-foreground transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );

    const handleFinalSubmit = async (data: any) => {
        if (isSurveyMode) {
            alert("🔍 Preview Mode — cannot submit in survey mode. Close this and continue the questionnaire.");
            return;
        }

        const { status, availability: avail, preferences: prefs } = data;

        if (!effectiveUserId) {
            alert("User ID missing. Please login.");
            return;
        }

        if (!groupId || !meetingId) {
            alert("Meeting data missing.");
            return;
        }

        const isJoined = status === 'yes';
        const avaliable_at: any[] = [];

        if (isJoined) {
            Object.entries(avail).forEach(([dateStr, slots]: [string, any]) => {
                slots.forEach((slot: any) => {
                    avaliable_at.push({
                        start: { dateTime: `${dateStr}T${slot.start}:00+07:00`, timeZone: "Asia/Bangkok" },
                        end: { dateTime: `${dateStr}T${slot.end}:00+07:00`, timeZone: "Asia/Bangkok" },
                        meal_time: meetingData?.mealTime,
                        is_avaliable: true
                    });
                });
            });
        }

        const preference = isJoined ? {
            price: prefs.price,
            category: prefs.category,
            avoid_categories: prefs.avoid_categories,
            good_fors: prefs.good_fors,
            alcohols: prefs.alcohols,
            parking: prefs.parking,
            departure_location: prefs.departureLocation,
            lat: prefs.lat,
            lng: prefs.lng,
            preferred_restaurant: prefs.preferredRestaurant,
            priorities: prefs.priorities,
            free_text: prefs.free_text
        } : {};

        try {
            await apiService.updateAttendee(meetingId, effectiveUserId, {
                is_joined: isJoined,
                preference: preference,
                avaliable_at: avaliable_at
            });

            setHasSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error("Failed to submit preferences", error);
            alert("Failed to submit preferences. Please try again.");
        }
    };

    return (
        <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
            {isSurveyMode && <SurveyModeBanner />}
            <div className="flex-1 overflow-y-auto p-4 pb-20">
                <header className="mb-8 pt-4 text-center">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tracking-tight mb-2">
                        DISHCISION
                    </h1>
                    <p className="text-muted-foreground text-sm">Tell us when you are free and what you like</p>
                </header>

                {isSurveyMode && !meetingId ? (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="glass-panel p-4 rounded-2xl space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">🧪 Survey Preview</span>
                            </div>
                            <h2 className="text-sm font-black text-foreground">Step 2: Schedule & Preferences</h2>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                ในหน้านี้ คุณสามารถระบุเวลาว่าง จัดลำดับความชอบประเภทอาหาร บรรยากาศร้าน งบประมาณ และข้อจำกัดต่างๆ
                                ก่อนจะกดส่งเพื่อให้ระบบประมวลผล
                            </p>
                        </div>

                        <div className="glass-panel p-4 rounded-2xl space-y-3">
                            <span className="text-[9px] font-black text-primary uppercase tracking-widest block">⏰ Availability Grid (ตัวอย่าง)</span>
                            <div className="grid grid-cols-7 gap-1">
                                {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map(d => (
                                    <div key={d} className="text-center text-[8px] font-bold text-muted-foreground py-1">{d}</div>
                                ))}
                                {Array.from({ length: 35 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-6 rounded-md ${i > 17 && i < 22 ? 'bg-emerald-500/30 border border-emerald-500/40' : 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5'}`}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="glass-panel p-4 rounded-2xl space-y-2">
                            <span className="text-[9px] font-black text-primary uppercase tracking-widest block">🍜 Preference Chips (ตัวอย่าง)</span>
                            <div className="flex flex-wrap gap-1.5">
                                {['อาหารญี่ปุ่น', 'อาหารไทย', 'ก๋วยเตี๋ยว', 'พิซซ่า', 'ชาบู', 'สตรีทฟู้ด'].map(c => (
                                    <span key={c} className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[9px] font-bold">{c}</span>
                                ))}
                            </div>
                        </div>

                        <div className="glass-panel p-4 rounded-2xl space-y-2">
                            <span className="text-[9px] font-black text-primary uppercase tracking-widest block">🎯 Priorities (ตัวอย่าง)</span>
                            <div className="space-y-1.5">
                                {['🥇 Price', '🥈 Cuisine', '🥉 Vibe'].map(p => (
                                    <div key={p} className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[10px] font-bold text-foreground">{p}</div>
                                ))}
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold text-center">
                            ⚡ ปิดโหมดพรีวิวเพื่อกลับไปตอบแบบสอบถาม
                        </div>
                    </div>
                ) : (
                    <VotingForm
                        meetingData={meetingData}
                        restaurantConfig={restaurantConfig}
                        onVoteSubmit={handleFinalSubmit}
                        userId={effectiveUserId}
                        allAttendees={allAttendees}
                    />
                )}
            </div>
        </div>
    );
};

export default AvailabilityPage;
