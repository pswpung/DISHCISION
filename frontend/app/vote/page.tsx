'use client'
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/app/context/LiffContext';
import { apiService } from '@/app/services/api';
import VotingForm from '@/app/components/voting-form/voting-form';
import { TimeSlotSelector } from '@/app/components/time-slot-selector/time-slot-selector';
import { parseAvailabilityText } from '@/app/utils/availability-parser';

const InviteeVotePage = () => {
    const { isLoggedIn, profile, liffObject } = useLiff();
    const router = useRouter();

    const [groupId, setGroupId] = useState<string | null>(null);
    const [meetingId, setMeetingId] = useState<string | null>(null);
    const [paramUserId, setParamUserId] = useState<string | null>(null);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        setGroupId(searchParams.get('group_id'));
        setMeetingId(searchParams.get('meeting_id'));
        setParamUserId(searchParams.get('user_id'));
    }, []);

    const [currentStep, setCurrentStep] = useState(1); // 1: RSVP, 2: Availability, 3: Preferences
    const [meetingData, setMeetingData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [rsvp, setRsvp] = useState<'yes' | 'no' | null>(null);
    const [availability, setAvailability] = useState<any>({}); // UI format: { date: [ {start, end} ] }

    const [restaurantConfig, setRestaurantConfig] = useState<any>(null);

    const [isInvited, setIsInvited] = useState(false);
    const [checkingInvite, setCheckingInvite] = useState(true);
    const [hasVoted, setHasVoted] = useState(false);

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

                // Check Invitation
                const effectiveUserId = paramUserId || profile?.userId;
                // const effectiveUserId = "U9f823928c4e73e51da6aae67fe93827a";
                if (effectiveUserId) {
                    console.log("Effective User ID : ", effectiveUserId);
                    const attendee = attendees.find((a: any) => a.user_id === effectiveUserId);
                    console.log("Attendee : ", attendee);
                    if (attendee) {
                        setIsInvited(true);
                        // Check if already voted (preference exists and not empty)
                        if (attendee.preference && Object.keys(attendee.preference).length > 0) {
                            setHasVoted(true);
                        }
                    } else {
                        setIsInvited(false);
                    }
                } else {
                    setIsInvited(false); // No user ID to check against
                }

            } catch (e) {
                console.error("Failed to load meeting", e);
                setIsInvited(false); // If fetching fails, assume not invited or cannot verify
            } finally {
                setLoading(false);
                setCheckingInvite(false);
            }
        };

        if (meetingId && (paramUserId || profile?.userId)) {
            fetchMeeting();
        } else if (meetingId && !paramUserId && !isLoggedIn) {
            // Wait for login or param?
            // If completely missing ID, we might just load meeting data to show title,
            // but status check depends on ID.
            // We can trigger fetch but permission check will fail -> Not Invited or "Please Login"
            // For now, let's just fetch if meetingId exists, check logic inside.
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
                setIsInvited(false); // No user ID, so not invited for voting purposes
            };
            loadPublicData();
        } else {
            // If meetingId is missing or other conditions not met, stop loading
            setLoading(false);
            setCheckingInvite(false);
            setIsInvited(false);
        }
    }, [meetingId, paramUserId, profile, isLoggedIn]); // Add deps

    // Re-check invited if profile/attendees update?
    // Simplified: Just one effect that depends on ID too.

    if (loading || checkingInvite) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (!isInvited) return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-4">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-3xl">
                🔒
            </div>
            <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
            <p className="text-muted-foreground">{meetingData ? `You are not invited to "${meetingData.name}"` : "You are not invited to this meeting."}</p>
            <p className="text-xs text-white/30">User ID: {paramUserId || profile?.userId || 'Unknown'}</p>
        </div>
    );

    // GUARD: ALREADY VOTED
    // If hasVoted is true, show the info screen
    if (hasVoted) return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-6 animate-in fade-in zoom-in">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-4xl border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                ✅
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
                    All Set!
                </h1>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
                    You have already filled in your preferences for <span className="text-foreground font-medium">"{meetingData?.name}"</span>.
                </p>
            </div>

            <div className="glass-panel p-4 w-full max-w-xs rounded-xl text-center">
                <p className="text-xs text-muted-foreground">
                    Sit tight! We will verify the results soon.
                </p>
            </div>

            {/* Optional: Add button to verify results if ready? or just close */}
            <button
                onClick={() => {
                    if (liffObject) {
                        liffObject.closeWindow();
                    } else {
                        window.close();
                    }
                }}
                className="text-primary text-sm font-medium hover:underline"
            >
                Close
            </button>
        </div>
    );

    const handleRSVP = (status: 'yes' | 'no') => {
        setRsvp(status);
        if (status === 'yes') {
            if (meetingData?.timingMode === 'fixed') {
                // Auto-fill availability for fixed time
                const fixedAvail = {
                    [meetingData.fixedDate]: [
                        { start: meetingData.fixedStartTime, end: meetingData.fixedEndTime }
                    ]
                };
                setAvailability(fixedAvail);
                if (meetingData?.allowOthersSuggest || meetingData?.allowSystemSuggest) {
                    setCurrentStep(3);
                } else {
                    // Submit immediately since no more preferences step
                    handleSubmitVote('yes', fixedAvail, {});
                }
            } else {
                setCurrentStep(2);
            }
        } else {
            // If No, submit immediately as declined
            handleSubmitVote(status, {}, {});
        }
    };

    const handleAvailabilitySubmit = (dates: any) => {
        const hasSlots = Object.values(dates).some((slots: any) => slots.length > 0);
        if (!hasSlots) {
            alert("Please select at least one available time slot.");
            return;
        }
        setAvailability(dates);

        if (meetingData?.fixedRestaurants && meetingData.fixedRestaurants.length > 0) {
            handleSubmitVote('yes', dates, {});
        } else {
            setCurrentStep(3);
        }
    };

    const handleFinalSubmit = (prefs: any) => {
        handleSubmitVote('yes', availability, prefs);
    };

    const handleSubmitVote = async (status: 'yes' | 'no', avail: any, prefs: any) => {
        const effectiveUserId = paramUserId || profile?.userId;

        if (!effectiveUserId) {
            alert("User ID missing. Please login.");
            return;
        }

        if (!groupId || !meetingId) {
            alert("Meeting data missing.");
            return;
        }

        // 1. Transform Data
        const isJoined = status === 'yes';

        // // 2. Ensure User Exists (Idempotent-ish)
        // await apiService.addAttendee({
        //     meeting_id: meetingId,
        //     user_id: effectiveUserId,
        //     group_id: groupId,
        //     is_key_person: false,
        //     is_joined: status === 'yes',
        // });

        // Transform Availability
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

        // Transform Preferences (New Structure)
        const preference = isJoined ? {
            price: prefs.price,
            category: prefs.category,
            avoid_categories: prefs.avoidCategories,
            good_fors: prefs.goodFors,
            alcohols: prefs.alcohols,
            parking: prefs.parking,
            departure_location: prefs.departureLocation,
            lat: prefs.lat,
            lng: prefs.lng,
            preferred_restaurant: prefs.preferredRestaurant
        } : {};

        try {
            // 3. Submit to Attendee API - Update existing record
            // Since page is guarded by isInvited, user must exist.
            await apiService.updateAttendee(meetingId, effectiveUserId, {
                is_joined: isJoined,
                preference: preference,
                avaliable_at: avaliable_at
            });

            // 4. Show "All Set" screen instead of redirecting
            setHasVoted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            // router.push(`/result?group_id=${groupId}&meeting_id=${meetingId}&user_id=${effectiveUserId}`);
        } catch (error) {
            console.error("Failed to submit vote", error);
            alert("Failed to submit vote");
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
            <div className="flex-1 overflow-y-auto p-4 pb-20">
                <header className="mb-6 pt-4 relative">
                    <button
                        onClick={() => groupId ? router.push(`/result?group_id=${groupId}`) : router.push('/')}
                        className="absolute left-0 top-6 p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-muted-foreground"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </button>

                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tracking-tight px-10">
                            {meetingData?.name}
                        </h1>
                        <p className="text-muted-foreground text-xs">Step {currentStep} of 3</p>
                    </div>

                    <div className="w-full bg-white/10 h-1 mt-4 rounded-full overflow-hidden">
                        <div
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${(currentStep / 3) * 100}%` }}
                        ></div>
                    </div>
                </header>

                {/* STEP 1: RSVP */}
                {currentStep === 1 && (
                    <div className="glass-panel p-6 rounded-2xl text-center space-y-6 animate-in zoom-in">
                        <h2 className="text-xl font-bold text-foreground">Will you join us?</h2>
                        <p className="text-muted-foreground">
                            {meetingData?.timingMode === 'fixed' ? (
                                <>
                                    <span className="font-medium text-foreground">{meetingData.fixedDate}</span><br />
                                    <span className="text-sm">{meetingData.fixedStartTime} - {meetingData.fixedEndTime}</span>
                                </>
                            ) : (
                                <>
                                    {meetingData?.startDate} - {meetingData?.endDate}<br />
                                    {meetingData?.mealTime}
                                </>
                            )}
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => handleRSVP('no')}
                                className="px-6 py-3 rounded-xl border border-white/10 text-muted-foreground hover:bg-white/5 transition-all"
                            >
                                Not Available
                            </button>
                            <button
                                onClick={() => handleRSVP('yes')}
                                className="px-8 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-all"
                            >
                                I'm In!
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: AVAILABILITY (Detailed Time Slots) */}
                {currentStep === 2 && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <div className="mb-4">
                            <button
                                onClick={() => setCurrentStep(1)}
                                className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 uppercase tracking-wider transition-colors"
                            >
                                ← Back
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-foreground text-center">When are you free?</h2>

                        <TimeSlotSelector
                            startDate={meetingData?.startDate}
                            endDate={meetingData?.endDate}
                            value={availability}
                            onChange={setAvailability}
                        />

                        <button
                            onClick={() => handleAvailabilitySubmit(availability)}
                            className="glass-button w-full py-4 rounded-xl font-bold mt-4"
                        >
                            {meetingData?.fixedRestaurants && meetingData.fixedRestaurants.length > 0
                                ? "Submit Vote"
                                : "Next: Preferences"}
                        </button>
                    </div>
                )}

                {/* STEP 3: PREFERENCES */}
                {currentStep === 3 && (
                    <div className="glass-panel p-6 rounded-2xl space-y-6 animate-in slide-in-from-right">
                        <div className="mb-2">
                            <button
                                onClick={() => setCurrentStep(meetingData?.timingMode === 'fixed' ? 1 : 2)}
                                className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 uppercase tracking-wider transition-colors"
                            >
                                ← Back
                            </button>
                        </div>
                        <VotingForm
                            meetingData={meetingData}
                            restaurantConfig={restaurantConfig}
                            onVoteSubmit={handleFinalSubmit}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

export default InviteeVotePage
