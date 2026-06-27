'use client'
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/app/context/LiffContext';
import { apiService } from '@/app/services/api';
import { SpinWheel } from '@/app/components/spin-wheel/spin-wheel';
import SurveyModeBanner from '@/app/components/survey-mode-banner/survey-mode-banner';

const DecisionPage = () => {
    const { profile } = useLiff();
    const router = useRouter();

    const [groupId, setGroupId] = useState<string | null>(null);
    const [meetingId, setMeetingId] = useState<string | null>(null);
    const [paramUserId, setParamUserId] = useState<string | null>(null);
    const [paramsReady, setParamsReady] = useState(false);

    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        setGroupId(sp.get('group_id'));
        setMeetingId(sp.get('meeting_id'));
        setParamUserId(sp.get('user_id'));
        setParamsReady(true);
    }, []);

    const [isSurveyMode, setIsSurveyMode] = useState(false);
    useEffect(() => {
        setIsSurveyMode(new URLSearchParams(window.location.search).get('survey_mode') === 'true');
    }, []);

    const currentUserId = profile?.userId || paramUserId;

    const [meetingData, setMeetingData] = useState<any>(null);
    const [allAttendees, setAllAttendees] = useState<any[]>([]);
    const [suggestionData, setSuggestionData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [confirmedTimeSlot, setConfirmedTimeSlot] = useState('');
    const [confirmedRestaurant, setConfirmedRestaurant] = useState('');
    const [wheelFilter, setWheelFilter] = useState<'voted' | 'all'>('voted');

    const isOrganizer = isSurveyMode ? true : (meetingData?.initial_data?.organizer_id === currentUserId);
    const isFixed = meetingData?.initial_data?.timing_mode === 'fixed';
    const status = meetingData?.initial_data?.status;
    const votingState: any = meetingData?.voting_state || {};

    const isSpinningTime = votingState.wheel_state?.status === 'spinning' && votingState.wheel_state?.target_type === 'time';
    const isSpinningRestaurant = votingState.wheel_state?.status === 'spinning' && votingState.wheel_state?.target_type === 'restaurant';

    useEffect(() => {
        if (!meetingId || !paramsReady) return;
        const fetchData = async () => {
            try {
                const [meeting, attendees, suggestions, groupUsers] = await Promise.all([
                    apiService.getMeeting(meetingId, currentUserId || undefined),
                    apiService.getMeetingAttendees(meetingId),
                    apiService.getSuggestions(meetingId),
                    groupId ? apiService.getUsersByGroup(groupId) : Promise.resolve([]),
                ]);

                const enrichedAttendees = attendees.map((att: any) => {
                    const user = groupUsers.find((u: any) => u.user_id === att.user_id);
                    return {
                        ...att,
                        displayName: user ? user.display_name || user.user_name : 'Unknown User',
                        display_name: user ? user.display_name || user.user_name : 'Unknown User',
                        pictureUrl: user?.pictureurl
                    };
                });

                setMeetingData(meeting);
                setAllAttendees(enrichedAttendees);
                setSuggestionData(suggestions);
                const fd = meeting?.voting_state?.final_decision;
                if (fd) {
                    setConfirmedTimeSlot(fd.time_slot || '');
                    setConfirmedRestaurant(fd.restaurant_id || '');
                }
            } catch (e) {
                console.error('Failed to load decision data', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [meetingId, currentUserId, groupId, paramsReady]);

    const votedAttendees = useMemo(() =>
        allAttendees.filter((a: any) => a.preference !== null),
        [allAttendees]
    );

    const topSlots: any[] = useMemo(() => {
        if (!suggestionData?.suggested_restaurants) return [];
        const slots: any[] = [];
        for (const [date, times] of Object.entries(suggestionData.suggested_restaurants)) {
            for (const [time, data] of Object.entries(times as any)) {
                const d = data as any;
                slots.push({ date, time, ...d });
            }
        }
        return slots.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
    }, [suggestionData]);

    const sortedSlots = useMemo(() => {
        const sorted = [...topSlots].sort((a, b) => {
            const keyA = `${a.date}_${a.time}`;
            const keyB = `${b.date}_${b.time}`;
            const votesA = votingState.time_votes?.[keyA]?.length || 0;
            const votesB = votingState.time_votes?.[keyB]?.length || 0;
            if (votesB !== votesA) return votesB - votesA;
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });
        return sorted;
    }, [topSlots, votingState]);

    const topRestaurants: any[] = useMemo(() => {
        const all = suggestionData?.all_scored_restaurants || [];
        return [...all].sort((a: any, b: any) => {
            const votesA = votingState.restaurant_preferences?.[a.name]?.length || 0;
            const votesB = votingState.restaurant_preferences?.[b.name]?.length || 0;
            if (votesB !== votesA) return votesB - votesA;
            return (b.score || 0) - (a.score || 0);
        });
    }, [suggestionData, votingState]);

    const finalDecision = isSurveyMode ? null : meetingData?.voting_state?.final_decision;

    const handleSetDecisionMethod = async (targetType: 'time' | 'restaurant', method: string) => {
        if (isSurveyMode) {
            setMeetingData((prev: any) => {
                const copy = { ...prev };
                if (!copy.voting_state) copy.voting_state = {};
                if (targetType === 'time') {
                    copy.voting_state.time_decision_method = method;
                } else {
                    copy.voting_state.restaurant_decision_method = method;
                }
                return copy;
            });
            return;
        }
        try {
            const updated = await apiService.setDecisionMethod(meetingId!, targetType, method);
            setMeetingData(updated);
        } catch (err) {
            console.error('Failed to set decision method:', err);
        }
    };

    const handleToggleTimeSlotForWheel = async (key: string) => {
        const currentList = votingState.selected_time_slots || [];
        const updatedList = currentList.includes(key)
            ? currentList.filter((k: string) => k !== key)
            : [...currentList, key];
        if (isSurveyMode) {
            setMeetingData((prev: any) => {
                const copy = { ...prev };
                if (!copy.voting_state) copy.voting_state = {};
                copy.voting_state.selected_time_slots = updatedList;
                return copy;
            });
            return;
        }
        const updated = await apiService.selectWheelTimeSlots(meetingId!, updatedList);
        setMeetingData(updated);
    };

    const handleToggleRestaurantForWheel = async (name: string) => {
        const currentList = votingState.selected_restaurants || [];
        const updatedList = currentList.includes(name)
            ? currentList.filter((n: string) => n !== name)
            : [...currentList, name];
        if (isSurveyMode) {
            setMeetingData((prev: any) => {
                const copy = { ...prev };
                if (!copy.voting_state) copy.voting_state = {};
                copy.voting_state.selected_restaurants = updatedList;
                return copy;
            });
            return;
        }
        const updated = await apiService.selectWheelRestaurants(meetingId!, updatedList);
        setMeetingData(updated);
    };

    const handleTriggerSpin = async (targetType: 'time' | 'restaurant') => {
        if (!meetingId) return;
        let candidates: Array<{ key: string; label: string; weight: number }> = [];
        if (targetType === 'time') {
            const selectedKeys = votingState.selected_time_slots || [];
            let slotsToUse = selectedKeys.length > 0
                ? sortedSlots.filter((slot: any) => selectedKeys.includes(`${slot.date}_${slot.time}`))
                : sortedSlots;

            if (wheelFilter === 'voted') {
                const votedSlots = slotsToUse.filter((s: any) => {
                    const key = `${s.date}_${s.time}`;
                    return (votingState.time_votes?.[key]?.length || 0) > 0;
                });
                if (votedSlots.length > 0) {
                    slotsToUse = votedSlots;
                }
            }

            slotsToUse.forEach((slot: any) => {
                const key = `${slot.date}_${slot.time}`;
                const votes = votingState.time_votes?.[key]?.length || 0;
                candidates.push({ key, label: `${slot.date.slice(5)} ${slot.time}`, weight: Math.max(1, votes) });
            });
        } else {
            let names = votingState.selected_restaurants || [];
            if (names.length === 0) names = topRestaurants.slice(0, 5).map((r: any) => r.name);
            names.forEach((name: string) => {
                const place = topRestaurants.find((r: any) => r.name === name);
                if (place) {
                    candidates.push({
                        key: name, label: name,
                        weight: Math.max(1, Math.round((place.score || 50) / 10 + (votingState.restaurant_preferences?.[name]?.length || 0) * 5))
                    });
                }
            });
        }
        if (candidates.length === 0) return;

        const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
        let rand = Math.random() * totalWeight;
        let winner = candidates[0];
        for (const c of candidates) { rand -= c.weight; if (rand <= 0) { winner = c; break; } }

        let startDeg = 0, minDeg = 0, maxDeg = 0;
        candidates.forEach(c => {
            const sliceDeg = (c.weight / totalWeight) * 360;
            if (c.key === winner.key) { minDeg = startDeg; maxDeg = startDeg + sliceDeg; }
            startDeg += sliceDeg;
        });
        const padding = Math.min(3, (maxDeg - minDeg) / 3);
        const targetDeg = minDeg + padding + Math.random() * (maxDeg - minDeg - 2 * padding);
        let stopAngle = (270 - targetDeg) + 360 * 5;
        if (stopAngle < 360 * 5) stopAngle += 360;

        if (isSurveyMode) {
            setMeetingData((prev: any) => {
                const copy = { ...prev };
                if (!copy.voting_state) copy.voting_state = {};
                copy.voting_state.wheel_state = {
                    status: "spinning",
                    target_type: targetType,
                    spin_at: Date.now(),
                    landed_key: winner.key,
                    stop_angle: stopAngle,
                    selected_keys: candidates.map(c => c.key)
                };
                return copy;
            });
            return;
        }
        try {
            const updated = await apiService.saveSpinResult(meetingId, targetType, winner.key, stopAngle, candidates.map(c => c.key));
            setMeetingData(updated);
        } catch (err) {
            console.error('Failed to spin:', err);
        }
    };

    const handleConfirm = async () => {
        if (!meetingId) return;
        const timeVal = isFixed
            ? `${meetingData.initial_data.fixed_date}_${meetingData.initial_data.fixed_start_time}`
            : confirmedTimeSlot;
        const restaurant = confirmedRestaurant;
        if (!timeVal && !isFixed) { alert('Please select a time slot.'); return; }
        if (!restaurant) { alert('Please select a restaurant.'); return; }
        if (isSurveyMode) {
            alert("🔍 Preview Mode — cannot submit in survey mode. Close this and continue the questionnaire.");
            return;
        }
        setConfirming(true);
        try {
            const updated = await apiService.confirmFinalMeetingPlan(meetingId, timeVal, restaurant);
            setMeetingData(updated);
        } catch (e) {
            console.error('Failed to confirm final plan', e);
            alert('Failed to confirm. Please try again.');
        } finally {
            setConfirming(false);
        }
    };

    const renderTimeDecision = () => {
        if (isFixed) return null;
        const timeMethod = votingState.time_decision_method || 'majority';

        return (
            <div className="glass-panel p-5 rounded-2xl space-y-4 border border-white/5">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-foreground">Time Slot Decision</h3>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                        {timeMethod === 'wheel' ? 'Spin Wheel' : 'Pick'}
                    </span>
                </div>

                {isOrganizer && (
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 text-[11px]">
                        <button onClick={() => handleSetDecisionMethod('time', 'majority')}
                            className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${timeMethod !== 'wheel' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>
                            Pick
                        </button>
                        <button onClick={() => handleSetDecisionMethod('time', 'wheel')}
                            className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${timeMethod === 'wheel' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>
                            Spin Wheel
                        </button>
                    </div>
                )}

                {timeMethod === 'wheel' ? (
                    <div className="space-y-4">
                        {isOrganizer && (
                            <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 text-[10px]">
                                <button
                                    onClick={() => setWheelFilter('voted')}
                                    className={"flex-1 py-1.5 rounded-lg font-bold transition-all " + (
                                        wheelFilter === 'voted' ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    🗳️ Voted Slots Only
                                </button>
                                <button
                                    onClick={() => setWheelFilter('all')}
                                    className={"flex-1 py-1.5 rounded-lg font-bold transition-all " + (
                                        wheelFilter === 'all' ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    🌐 All Slots
                                </button>
                            </div>
                        )}

                        {isOrganizer && (
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Include in Wheel</h4>
                                <div className="max-h-32 overflow-y-auto bg-black/10 rounded-2xl p-2.5 border border-white/5 space-y-1.5">
                                    {sortedSlots
                                        .filter((slot: any) => {
                                            if (wheelFilter !== 'voted') return true;
                                            const key = `${slot.date}_${slot.time}`;
                                            return (votingState.time_votes?.[key]?.length || 0) > 0;
                                        })
                                        .slice(0, 8).map((slot: any) => {
                                            const key = `${slot.date}_${slot.time}`;
                                            const isChecked = votingState.selected_time_slots?.includes(key) || false;
                                            const votes = votingState.time_votes?.[key]?.length || 0;
                                            return (
                                                <label key={key} className="flex items-center gap-2 text-[11px] font-semibold text-foreground/80 cursor-pointer">
                                                    <input type="checkbox" checked={isChecked} onChange={() => handleToggleTimeSlotForWheel(key)} className="rounded accent-primary" />
                                                    <span className="truncate flex-1">{slot.date.slice(5)} • {slot.time}</span>
                                                    <span className="text-[10px] text-primary font-black shrink-0">👍 {votes}</span>
                                                </label>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                        <SpinWheel
                            options={(() => {
                                const selectedKeys = votingState.selected_time_slots || [];
                                let slotsToUse = selectedKeys.length > 0
                                    ? sortedSlots.filter((s: any) => selectedKeys.includes(`${s.date}_${s.time}`))
                                    : sortedSlots;

                                if (wheelFilter === 'voted') {
                                    const votedSlots = slotsToUse.filter((s: any) => {
                                        const key = `${s.date}_${s.time}`;
                                        return (votingState.time_votes?.[key]?.length || 0) > 0;
                                    });
                                    if (votedSlots.length > 0) {
                                        slotsToUse = votedSlots;
                                    }
                                }

                                return slotsToUse.slice(0, 8).map((s: any) => {
                                    const key = `${s.date}_${s.time}`;
                                    const votes = votingState.time_votes?.[key]?.length || 0;
                                    return { key, label: `${s.date.slice(5)} ${s.time}`, weight: Math.max(1, votes) };
                                });
                            })()}
                            targetAngle={votingState.wheel_state?.target_type === 'time' ? votingState.wheel_state.stop_angle : null}
                            spinAt={votingState.wheel_state?.target_type === 'time' ? votingState.wheel_state.spin_at : null}
                            isSpinning={isSpinningTime}
                            onComplete={async () => {
                                if (votingState.wheel_state?.landed_key) {
                                    setConfirmedTimeSlot(votingState.wheel_state.landed_key);
                                    if (isOrganizer) {
                                        if (isSurveyMode) {
                                            setMeetingData((prev: any) => {
                                                const copy = { ...prev };
                                                if (copy.voting_state?.wheel_state) {
                                                    copy.voting_state.wheel_state.status = "idle";
                                                }
                                                return copy;
                                            });
                                            return;
                                        }
                                        try {
                                            const updated = await apiService.resetWheel(meetingId!);
                                            setMeetingData(updated);
                                        } catch (e) {
                                            console.error('Failed to reset time wheel:', e);
                                        }
                                    }
                                }
                            }}
                        />
                        {isOrganizer && (
                            <button disabled={isSpinningTime || sortedSlots.length === 0}
                                onClick={() => handleTriggerSpin('time')}
                                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none">
                                {isSpinningTime ? 'Spinning...' : 'Spin Time Slot Wheel'}
                            </button>
                        )}
                        {!isOrganizer && (
                            <div className="text-center text-xs text-muted-foreground italic">
                                {isSpinningTime ? '🎡 The wheel is spinning!' : 'Waiting for organizer to spin...'}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {sortedSlots.slice(0, 5).map((slot: any, i: number) => {
                            const key = `${slot.date}_${slot.time}`;
                            const votes = votingState.time_votes?.[key]?.length || 0;
                            return (
                                <div key={key} onClick={() => { if (isOrganizer) setConfirmedTimeSlot(key); }}
                                    className={`flex justify-between items-center p-3 rounded-2xl border text-xs cursor-pointer transition-all ${confirmedTimeSlot === key ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-white/5 border-white/5'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-primary">#{i + 1}</span>
                                        <div>
                                            <p className="font-bold text-foreground">{slot.time}</p>
                                            <p className="text-[10px] text-muted-foreground">{slot.date}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-primary text-[10px]">👍 {votes}</span>
                                        {isOrganizer && confirmedTimeSlot === key && (
                                            <span className="text-[9px] bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded font-black">Selected</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderRestaurantDecision = () => {
        const restMethod = votingState.restaurant_decision_method || 'majority';

        return (
            <div className="glass-panel p-5 rounded-2xl space-y-4 border border-white/5">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-foreground">Restaurant Decision</h3>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                        {restMethod === 'wheel' ? 'Spin Wheel' : 'Pick'}
                    </span>
                </div>

                {isOrganizer && (
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 text-[11px]">
                        <button onClick={() => handleSetDecisionMethod('restaurant', 'majority')}
                            className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${restMethod !== 'wheel' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>
                            Pick
                        </button>
                        <button onClick={() => handleSetDecisionMethod('restaurant', 'wheel')}
                            className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${restMethod === 'wheel' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>
                            Spin Wheel
                        </button>
                    </div>
                )}

                {restMethod === 'wheel' ? (
                    <div className="space-y-4">
                        {isOrganizer && (
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Include in Wheel</h4>
                                <div className="max-h-32 overflow-y-auto bg-black/10 rounded-2xl p-2.5 border border-white/5 space-y-1.5">
                                    {topRestaurants.slice(0, 8).map((r: any) => {
                                        const isChecked = votingState.selected_restaurants?.includes(r.name) || false;
                                        const prefs = votingState.restaurant_preferences?.[r.name]?.length || 0;
                                        return (
                                            <label key={r.name} className="flex items-center gap-2 text-[11px] font-semibold text-foreground/80 cursor-pointer">
                                                <input type="checkbox" checked={isChecked} onChange={() => handleToggleRestaurantForWheel(r.name)} className="rounded accent-primary" />
                                                <span className="truncate flex-1">{r.name}</span>
                                                <span className="text-[10px] text-primary font-black shrink-0">❤️ {prefs} • Match: {Math.round(r.score)}%</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <SpinWheel
                            options={(() => {
                                const names = votingState.selected_restaurants || [];
                                const restToUse = names.length > 0
                                    ? topRestaurants.filter((r: any) => names.includes(r.name))
                                    : topRestaurants.slice(0, 5);
                                return restToUse.slice(0, 8).map((r: any) => ({
                                    key: r.name,
                                    label: r.name,
                                    weight: Math.max(1, Math.round((r.score || 50) / 10 + (votingState.restaurant_preferences?.[r.name]?.length || 0) * 5))
                                }));
                            })()}
                            targetAngle={votingState.wheel_state?.target_type === 'restaurant' ? votingState.wheel_state.stop_angle : null}
                            spinAt={votingState.wheel_state?.target_type === 'restaurant' ? votingState.wheel_state.spin_at : null}
                            isSpinning={isSpinningRestaurant}
                            onComplete={async () => {
                                if (votingState.wheel_state?.landed_key) {
                                    setConfirmedRestaurant(votingState.wheel_state.landed_key);
                                    if (isOrganizer) {
                                        if (isSurveyMode) {
                                            setMeetingData((prev: any) => {
                                                const copy = { ...prev };
                                                if (copy.voting_state?.wheel_state) {
                                                    copy.voting_state.wheel_state.status = "idle";
                                                }
                                                return copy;
                                            });
                                            return;
                                        }
                                        try {
                                            const updated = await apiService.resetWheel(meetingId!);
                                            setMeetingData(updated);
                                        } catch (e) {
                                            console.error('Failed to reset restaurant wheel:', e);
                                        }
                                    }
                                }
                            }}
                        />
                        {isOrganizer && (
                            <button disabled={isSpinningRestaurant || topRestaurants.length === 0}
                                onClick={() => handleTriggerSpin('restaurant')}
                                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none">
                                {isSpinningRestaurant ? 'Spinning...' : 'Spin Restaurant Wheel'}
                            </button>
                        )}
                        {!isOrganizer && (
                            <div className="text-center text-xs text-muted-foreground italic">
                                {isSpinningRestaurant ? '🎡 The wheel is spinning!' : 'Waiting for organizer to spin...'}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {topRestaurants.slice(0, 5).map((r: any, i: number) => {
                            const prefs = votingState.restaurant_preferences?.[r.name]?.length || 0;
                            return (
                                <div key={r.name} onClick={() => { if (isOrganizer) setConfirmedRestaurant(r.name); }}
                                    className={`flex justify-between items-center p-3 rounded-2xl border text-xs cursor-pointer transition-all ${confirmedRestaurant === r.name ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-white/5 border-white/5'}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-bold text-primary shrink-0">#{i + 1}</span>
                                        <p className="font-bold text-foreground truncate">{r.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <span className="text-[10px] text-primary font-black">❤️ {prefs}</span>
                                        <span className="text-[10px] text-muted-foreground">•</span>
                                        <span className="text-[10px] text-amber-400 font-black">Match: {Math.round(r.score)}/100</span>
                                        {isOrganizer && confirmedRestaurant === r.name && (
                                            <span className="text-[9px] bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded font-black">Selected</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    if (!paramsReady) {
        return <div className="flex items-center justify-center min-h-screen p-4"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    }
    if (!meetingId) {
        return <div className="flex items-center justify-center min-h-screen p-4"><div className="glass-panel p-8 rounded-2xl text-center max-w-sm"><p className="text-muted-foreground">No meeting ID provided.</p></div></div>;
    }
    if (loading) {
        return <div className="flex items-center justify-center min-h-screen p-4"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    }
    if (!meetingData) {
        return <div className="flex items-center justify-center min-h-screen p-4"><div className="glass-panel p-8 rounded-2xl text-center max-w-sm"><p className="text-muted-foreground">Failed to load meeting data.</p></div></div>;
    }

    return (
        <div className="min-h-screen bg-background p-4 pb-20">
            {isSurveyMode && <SurveyModeBanner />}
            <header className="mb-6 pt-4 text-center">
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tracking-tight">
                    Decision Panel
                </h1>
                <h2 className="text-sm text-foreground font-bold mt-1">{meetingData.meeting_name}</h2>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${finalDecision ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                    {finalDecision ? 'Confirmed' : 'Awaiting Decision'}
                </span>
            </header>

            <div className="space-y-4 max-w-lg mx-auto">
                {/* Voting Summary */}
                <div className="glass-panel p-5 rounded-2xl space-y-3">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider">Voting Summary</h3>
                    <p className="text-sm font-bold">{votedAttendees.length} / {allAttendees.length} voted</p>
                    <div className="flex flex-wrap gap-2">
                        {allAttendees.map((a: any) => {
                            const voted = a.preference !== null;
                            return (
                                <div key={a.user_id} className={"flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all " + (
                                    voted
                                        ? "bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20 text-green-700 dark:text-green-400"
                                        : "bg-white/5 border-white/5 text-muted-foreground"
                                )} title={a.display_name || 'Unknown'}>
                                    {a.pictureUrl ? (
                                        <img src={a.pictureUrl} alt={a.display_name} className="w-5 h-5 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                                            {(a.display_name || a.user_id)?.slice(0, 1) || '?'}
                                        </div>
                                    )}
                                    <span className="text-[11px] font-semibold truncate max-w-[80px]">
                                        {a.display_name || 'Unknown'}
                                    </span>
                                    <span className="text-[9px] opacity-80 font-black ml-0.5">
                                        {voted ? "✓" : "⏳"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Time Range */}
                <div className="glass-panel p-5 rounded-2xl space-y-2">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider">Time Range</h3>
                    {isFixed ? (
                        <p className="text-sm font-medium">{meetingData.initial_data.fixed_date} • {meetingData.initial_data.fixed_start_time} - {meetingData.initial_data.fixed_end_time}</p>
                    ) : (
                        <p className="text-sm font-medium">
                            {meetingData.initial_data.start_date} → {meetingData.initial_data.end_date}
                            {meetingData.initial_data.meal_time && <> • {meetingData.initial_data.meal_time}</>}
                        </p>
                    )}
                </div>

                {/* Time Decision */}
                {!finalDecision && renderTimeDecision()}

                {/* Restaurant Decision */}
                {!finalDecision && renderRestaurantDecision()}

                {/* Final Decision */}
                {finalDecision && (
                    <div className="glass-panel p-5 rounded-2xl space-y-3 border border-green-500/30">
                        <h3 className="text-xs font-black text-green-400 uppercase tracking-wider">Final Decision</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white/5 rounded-xl">
                                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Time</p>
                                <p className="text-xs font-bold mt-1">{finalDecision.time_slot?.replace('_', ' • ')}</p>
                            </div>
                            <div className="p-3 bg-white/5 rounded-xl">
                                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Restaurant</p>
                                <p className="text-xs font-bold mt-1">{finalDecision.restaurant_id}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Button */}
                {isOrganizer && !finalDecision && (
                    <div className="glass-panel p-5 rounded-2xl space-y-4 border border-primary/20">
                        <h3 className="text-xs font-black text-primary uppercase tracking-wider">Organizer Action</h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Time Slot</p>
                                <p className="font-bold truncate mt-0.5">{confirmedTimeSlot ? confirmedTimeSlot.replace('_', ' • ') : 'Not selected'}</p>
                            </div>
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Restaurant</p>
                                <p className="font-bold truncate mt-0.5">{confirmedRestaurant || 'Not selected'}</p>
                            </div>
                        </div>
                        <button onClick={handleConfirm} disabled={isSurveyMode || confirming || (!confirmedTimeSlot && !isFixed) || !confirmedRestaurant}
                            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg hover:shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none">
                            {isSurveyMode ? 'Confirm & Notify Groups' : (confirming ? 'Confirming...' : 'Confirm & Notify Group')}
                        </button>
                    </div>
                )}

                {/* Observer waiting */}
                {!isOrganizer && !finalDecision && (
                    <div className="glass-panel p-5 rounded-2xl space-y-3 text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center text-xl">⏳</div>
                        <p className="text-sm font-bold text-foreground">Waiting for Organizer</p>
                        <p className="text-xs text-muted-foreground">The organizer is reviewing the suggestions and making the final decision.</p>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-col gap-2 pt-4">
                    {groupId && meetingId && (
                        <button onClick={() => router.push(`/result?group_id=${groupId}&meeting_id=${meetingId}`)}
                            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                            View Full Results
                        </button>
                    )}
                    {isSurveyMode ? (
                        <button onClick={() => {
                            const params = new URLSearchParams(window.location.search);
                            const returnTo = params.get('return_to_survey');
                            if (returnTo) {
                                router.push(`/${returnTo}/feedback`);
                            } else {
                                router.push('/');
                            }
                        }}
                            className="w-full py-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-black text-primary hover:bg-primary/20 transition-all text-center">
                            ← กลับสู่แบบสอบถาม (Back to Survey)
                        </button>
                    ) : (
                        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push('/'); }}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-2">
                            Back
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DecisionPage;
