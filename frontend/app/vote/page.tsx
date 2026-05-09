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

    const [meetingData, setMeetingData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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
                        if (attendee.preference) {
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

    const handleFinalSubmit = async (data: any) => {
        const { status, availability: avail, preferences: prefs } = data;
        const effectiveUserId = paramUserId || profile?.userId;

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
            preferred_restaurant: prefs.preferredRestaurant
        } : {};

        try {
            await apiService.updateAttendee(meetingId, effectiveUserId, {
                is_joined: isJoined,
                preference: preference,
                avaliable_at: avaliable_at
            });

            setHasVoted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error("Failed to submit vote", error);
            alert("Failed to submit vote");
        }
    };

    return (
        <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
            <div className="flex-1 overflow-y-auto p-4 pb-20">
                <header className="mb-8 pt-4 text-center">
                    <button
                        onClick={() => groupId ? router.push(`/result?group_id=${groupId}`) : router.push('/')}
                        className="absolute left-0 top-6 p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-muted-foreground"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </button>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tracking-tight mb-2">
                        DISHCISION
                    </h1>
                    <p className="text-muted-foreground text-sm">Join the meeting and vote</p>
                </header>

                <VotingForm
                    meetingData={meetingData}
                    restaurantConfig={restaurantConfig}
                    onVoteSubmit={handleFinalSubmit}
                />
            </div>
        </div>
    );
};

export default InviteeVotePage;
