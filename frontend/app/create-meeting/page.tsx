'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/app/context/LiffContext';
import { apiService } from '@/app/services/api';
import CreateMeetingForm from '../components/create-meeting-form/create-meeting-form';

const CreateMeetingPage = () => {
  const { profile, isLoggedIn, login, liffObject } = useLiff();
  const router = useRouter();
  console.log("Profile:", profile);
  console.log("Is Logged In:", isLoggedIn);

  // State for params and loading
  const [isReady, setIsReady] = useState(false);
  const [isCreated, setIsCreated] = useState(false); // Added success state
  const [paramGroupId, setParamGroupId] = useState<string | null>(null);
  const [paramUserId, setParamUserId] = useState<string | null>(null);

  // Helper to check identity safely after mount
  useEffect(() => {
    // Prevent hydration mismatch by moving window access to effect
    const searchParams = new URLSearchParams(window.location.search);
    const meetingId = searchParams.get('meeting_id');
    const groupId = searchParams.get('group_id');
    const userId = searchParams.get('user_id');

    // Fail-safe: If meeting_id is present, we are likely wrongly redirected here from a Result/Vote link.
    // Redirect correct page (Result)
    if (meetingId) {
      router.replace(`/result?group_id=${groupId || ''}&meeting_id=${meetingId}&user_id=${userId || ''}`);
      return;
    }

    setParamGroupId(groupId);
    setParamUserId(userId);
    setIsReady(true);
  }, []);

  const [restaurantConfig, setRestaurantConfig] = useState<any>(null);

  // Fetch Config
  useEffect(() => {
    // Only fetch if we haven't yet
    if (restaurantConfig || !isReady) return;

    const fetchConfig = async () => {
      try {
        const config = await apiService.getRestaurantConfig();
        console.log("Fetch Restaurant Config:", config);
        setRestaurantConfig(config);
      } catch (e) {
        console.warn("Failed to fetch restaurant config", e);
      }
    };
    fetchConfig();
  }, [isReady, restaurantConfig]);

  // Fetch Group Attendees
  useEffect(() => {
    if (!isReady) return;

    const fetchAttendees = async () => {
      const targetGroupId = paramGroupId || 'group-1'; // Default to group-1
      try {
        const users = await apiService.getUsersByGroup(targetGroupId);
        // Map backend users to UI format
        const attendees = users.map((u: any) => ({
          userId: u.user_id,
          displayName: u.display_name,
          pictureUrl: u.pictureurl
        }));

        if (attendees.length > 0) {
          console.log("INVITE FRIEND LIST (from DB):", attendees);
          setAttendeeList(attendees);
        }
      } catch (e) {
        console.warn("Failed to fetch group attendees", e);
      }
    };
    fetchAttendees();
  }, [isReady, paramGroupId]);

  const [attendeeList, setAttendeeList] = useState<any[]>([]);
  const [organizerInfo, setOrganizerInfo] = useState<any>(null);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [isAllowed, setIsAllowed] = useState(true);

  // Permission Check & Organizer Fetch
  // Permissions
  useEffect(() => {
    if (!isReady) return;
    if (!isLoggedIn) return;

    const checkPermission = async () => {
      // ... existing logic ...
      // (Keeping context, just inserting the other effect below or above block)
    };
    checkPermission();
  }, [isReady, isLoggedIn, profile, paramUserId]);

  // Auto-login effect (Moved from bottom)
  useEffect(() => {
    if (liffObject && !isLoggedIn) {
      // login(); // Optional auto-login
    }
  }, [liffObject, isLoggedIn, login]);

  const handleMeetingData = async (data: any) => {
    console.log("Creating meeting with:", data);

    try {
      // 1. Create/Ensure Organizer Exists
      if (profile) {
        await apiService.createUser({
          user_id: profile.userId,
          display_name: profile.displayName,
          pictureurl: profile.pictureUrl
        });
      }

      // 2. Create Meeting
      const meetingPayload = {
        meeting_name: data.name,
        group_id: data.groupId,
        initial_data: {
          event_name: data.name,
          start_date: data.startDate,
          end_date: data.endDate,
          meal_time: data.mealTime,
          attendees: data.attendees.map((a: any) => a.userId),
          key_person: data.keyPersons.map((k: any) => k.userId),
          key_decision_ratio: data.keyDecisionRatio || 70,
          fixed_restaurants: data.fixedRestaurants || [],
          // Location Data
          fix_location: data.fixLocation || null,
          fix_location_coords: data.fixLocationCoords || null,
          // Advanced Settings
          allow_system_suggest: data.allowSystemSuggest,
          require_all_join: data.requireAllJoin,
          allow_others_suggest: data.allowOthersSuggest,
          suggest_per_time: data.suggest_per_time,
          // Timing Mode & Fixed Time
          timing_mode: data.timingMode,
          fixed_date: data.fixedDate || null,
          fixed_start_time: data.fixedStartTime || null,
          fixed_end_time: data.fixedEndTime || null,
        }
      };

      const newMeeting = await apiService.createMeeting(meetingPayload);
      console.log("Meeting created:", newMeeting);

      // 3. Add other attendees
      for (const attendee of data.attendees) {
        await apiService.addAttendee({
          meeting_id: newMeeting.meeting_id,
          user_id: attendee.userId,
          group_id: data.groupId,
          is_key_person: data.keyPersons.some((k: any) => k.userId === attendee.userId),
          is_joined: false
        });
      }

      // 4. Add Organizer as Attendee (With Manual Availability & Preferences)
      // Transform availability from TimeSlotSelector ({ date: [{start, end}] }) to linear array
      const avaliable_at_list: any[] = [];
      const availMap = data.availability || {};

      Object.entries(availMap).forEach(([dateStr, slots]: [string, any]) => {
        slots.forEach((slot: any) => {
          avaliable_at_list.push({
            start: { dateTime: `${dateStr}T${slot.start}:00+07:00`, timeZone: "Asia/Bangkok" },
            end: { dateTime: `${dateStr}T${slot.end}:00+07:00`, timeZone: "Asia/Bangkok" },
            meal_time: data.mealTime,
            is_avaliable: true
          });
        });
      });

      const prefs = {
        ...data.organizerPreferences,
        lat: data.locationCoordinates?.lat || data.fixLocationCoords?.lat || null,
        lng: data.locationCoordinates?.lng || data.fixLocationCoords?.lng || null,
        departure_location: data.departureLocation || data.fixLocation || null,
        preferred_restaurant: data.preferredRestaurant || [],
        priorities: data.organizerPreferences?.priorities || []
      };

      const payload = {
        avaliable_at: avaliable_at_list, // Send as direct list
        preference: prefs,
        is_joined: true
      }
      console.log("payload", payload)

      // Use PATCH to update existing attendee record
      await apiService.updateAttendee(
        newMeeting.meeting_id,
        data.organizerId,
        payload
      );

      // Check if it's a solo meeting (only organizer)
      // data.attendees comes from selection. If empty, it's just organizer.
      // If data.attendees has items, total is len + 1.
      // Condition: if data.attendees is empty OR length is 0 (meaning only organizer is in the meeting)
      if (data.attendees.length === 0) {
        console.log("Solo meeting detected, triggering suggestions...");
        apiService.getSuggestions(newMeeting.meeting_id).catch(err => console.error("Auto-suggest failed", err));
      } else {
        // Double check: if data.attendees contains ONLY the organizer (userId match)
        const otherAttendees = data.attendees.filter((a: any) => a.userId !== data.organizerId);
        if (otherAttendees.length === 0) {
          console.log("Solo meeting detected (filtered), triggering suggestions...");
          apiService.getSuggestions(newMeeting.meeting_id).catch(err => console.error("Auto-suggest failed", err));
        }
      }

      // 5. Show Success Screen
      setIsCreated(true);
      // router.push(`/result?group_id=${data.groupId}&meeting_id=${newMeeting.meeting_id}`); // Removed redirect

    } catch (error) {
      console.error("Failed to create meeting:", error);
      alert("Failed to create meeting. See console for details.");
    }
  };

  if (isCreated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-6 animate-in fade-in zoom-in">
        <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center text-5xl border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.3)] mb-2">
          🎉
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 tracking-tight">
            Meeting Created!
          </h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
            We've sent invites to <span className="text-foreground font-bold">Group</span>.
            <br />Relax and wait for the votes to roll in!
          </p>
        </div>

        <div className="pt-4 flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => liffObject?.closeWindow()}
            className="glass-button w-full py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-green-500/20 transition-all border-green-500/30 bg-green-500/10 text-green-200"
          >
            Close Window
          </button>
          <button
            onClick={() => router.push(paramGroupId ? `/result?group_id=${paramGroupId}` : '/')}
            className="text-sm text-muted-foreground hover:text-white transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Determine if we should show the form or loading
  // Initial render (SSR/Hydration): isReady false -> !isMocking true -> !isLoggedIn true -> SHOW LOADING
  // Client mount: isReady true -> isMocking might be true.
  // Auto-login effect (Moved to top)

  if (!isReady || !liffObject) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-300">Initializing...</p>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-3xl">
            🔒
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Login Required</h2>
            <p className="text-muted-foreground text-sm">Please login with LINE to create a meeting.</p>
          </div>
          <button
            onClick={() => login()}
            className="bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3 px-8 rounded-full transition-all active:scale-95"
          >
            Login with LINE
          </button>
        </div>
      </div>
    );
  }

  // Not Allowed View
  if (permissionChecked && !isAllowed) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center p-6 text-center space-y-6 animate-in fade-in zoom-in">
        <div className="w-24 h-24 rounded-full border-4 border-white/10 overflow-hidden shadow-2xl relative">
          {organizerInfo?.pictureurl ? (
            <img src={organizerInfo.pictureurl} alt={organizerInfo.display_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold">
              {organizerInfo?.display_name?.charAt(0) || '?'}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            Waiting for Organizer
          </h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
            Please wait for <span className="font-bold text-white">{organizerInfo?.display_name || "the organizer"}</span> to fill out the meeting details.
          </p>
        </div>

        <div className="bg-white/5 rounded-xl p-4 w-full max-w-xs border border-white/10">
          <p className="text-xs text-white/50">
            You will receive a notification to vote once setup is complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <header className="mb-8 pt-4 text-center">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tracking-tight mb-2">
            DISHCISION
          </h1>
          <p className="text-muted-foreground text-sm">Create a new dining appointment</p>
        </header>

        <CreateMeetingForm
          attendeeList={(() => {
            // Combine profile with attendeeList if not already present
            let list = [...attendeeList];
            if (profile && !list.some(a => a.userId === profile.userId)) {
              list = [{ 
                userId: profile.userId, 
                displayName: profile.displayName, 
                pictureUrl: profile.pictureUrl 
              }, ...list];
            }
            // Final deduplication by userId just to be safe
            return Array.from(new Map(list.map(item => [item.userId, item])).values());
          })()}
          onDataSubmit={handleMeetingData}
          initialGroupId={paramGroupId || 'group-1'}
          initialUserId={profile?.userId || paramUserId} // If allowed, use profile ID
          restaurantConfig={restaurantConfig}
        />
      </div>
    </div>
  )
}

export default CreateMeetingPage
