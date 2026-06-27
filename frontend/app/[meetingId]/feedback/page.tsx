'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLiff } from '@/app/context/LiffContext';
import surveyQuestions from '@/app/config/survey-questions.json';
import { apiService } from '@/app/services/api';

export default function FeedbackPage() {
    const params = useParams();
    const { profile, error: liffError, liffObject, bypassLiff } = useLiff();
    const meetingId = params?.meetingId as string;
    const userId = profile?.userId || null;

    const [responses, setResponses] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [contextModal, setContextModal] = useState<'time' | 'restaurant' | null>(null);

    // Dynamic data states
    const [loadingData, setLoadingData] = useState(true);
    const [meetingName, setMeetingName] = useState('');
    const [meetingGroupId, setMeetingGroupId] = useState('');
    const [sortedSlots, setSortedSlots] = useState<any[]>([]);
    const [topRestaurants, setTopRestaurants] = useState<any[]>([]);
    const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
    const [userPreference, setUserPreference] = useState<any | null>(null);
    const [allMeetingAttendees, setAllMeetingAttendees] = useState<any[]>([]);

    const calculateROCWeights = (priorities: any) => {
        if (!priorities || !Array.isArray(priorities)) return {};

        // Normalize priorities: if it's a flat array of strings, turn it into string[][]
        let normalized: string[][] = [];
        if (priorities.length > 0) {
            if (typeof priorities[0] === 'string') {
                normalized = (priorities as string[]).map(p => [p]);
            } else if (Array.isArray(priorities[0])) {
                normalized = priorities as string[][];
            }
        }

        const flat = normalized.flat();
        const k = flat.length;
        if (k === 0) return {};
        const slotWeights: number[] = [];
        for (let r = 1; r <= k; r++) {
            let sum = 0;
            for (let j = r; j <= k; j++) sum += 1 / j;
            slotWeights.push(sum / k);
        }
        const weights: Record<string, number> = {};
        let start = 1;
        normalized.forEach(group => {
            const size = group.length;
            if (size === 0) return;
            let sum = 0;
            for (let s = start; s <= start + size - 1; s++) {
                sum += slotWeights[s - 1] || 0;
            }
            const avg = sum / size;
            group.forEach(f => { weights[f] = avg; });
            start += size;
        });
        return weights;
    };

    const getFactorIcon = (factor: string) => {
        switch (factor) {
            case 'Price': return '💰';
            case 'Category': return '🍜';
            case 'Vibe/Good For': return '🌟';
            case 'Distance from BTS': return '🚇';
            case 'Rating': return '⭐';
            case 'Parking': return '🚗';
            case 'Alcohol': return '🍺';
            default: return '📍';
        }
    };

    const getFactorDisplayName = (factor: string) => {
        switch (factor) {
            case 'Price': return 'Price';
            case 'Category': return 'Cuisine';
            case 'Vibe/Good For': return 'Vibe';
            case 'Distance from BTS': return 'BTS Distance';
            case 'Rating': return 'Rating';
            case 'Parking': return 'Parking';
            case 'Alcohol': return 'Alcohol';
            default: return factor;
        }
    };

    const rocWeights = useMemo(() => {
        if (!userPreference || !userPreference.priorities) return {};
        return calculateROCWeights(userPreference.priorities);
    }, [userPreference]);

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
            const att = allMeetingAttendees.find(a => a.user_id === uid);
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
            const max = factor.max_score || factor.max || 0;
            if (max <= 0) return false;
            const score = factor.weighted_score ?? factor.base_score ?? factor.score ?? factor.base ?? 0;
            return Math.round((score / max) * 100) >= 100;
        };

        if (reasonObj.Price && isFactorMatch(reasonObj.Price)) {
            badges.push({ text: '💰 Budget Match', type: 'success' });
        }

        if (reasonObj.Category && isFactorMatch(reasonObj.Category)) {
            badges.push({ text: '🍽️ Cuisine Match', type: 'success' });
        }

        if (reasonObj.Station && (reasonObj.Station.base_score >= 80 || reasonObj.Station.score >= 80)) {
            badges.push({ text: '🚇 Transit Friendly', type: 'info' });
        }

        if (reasonObj.Parking && isFactorMatch(reasonObj.Parking)) {
            badges.push({ text: '🚗 Parking Match', type: 'success' });
        }

        if (reasonObj.Alcohol && isFactorMatch(reasonObj.Alcohol)) {
            badges.push({ text: '🍻 Drinks Match', type: 'purple' });
        }

        if (reasonObj.Vibe && isFactorMatch(reasonObj.Vibe)) {
            badges.push({ text: '✨ Good Vibe', type: 'purple' });
        }

        return badges;
    };


    useEffect(() => {
        if (!meetingId) return;

        const fetchData = async () => {
            try {
                setLoadingData(true);
                // 1. Fetch meeting basic info
                const meeting = await apiService.getMeeting(meetingId, userId || undefined);
                setMeetingName(meeting.meeting_name);
                setMeetingGroupId(meeting.group_id || '');

                // 2. Fetch suggestion details (ranking lists)
                const resultData = await apiService.getSuggestions(meetingId);

                // Process time slots
                const suggestions = resultData.suggested_restaurants || {};
                const allSlots: any[] = [];
                Object.entries(suggestions).forEach(([date, times]) => {
                    Object.entries(times).forEach(([timeSlot, slotData]: [string, any]) => {
                        allSlots.push({
                            date,
                            time: timeSlot,
                            final_score: slotData.final_score || 0,
                            attendees: slotData.attendees || [],
                            partial_join: slotData.partial_join || [],
                            restaurants: slotData.restaurants || []
                        });
                    });
                });

                // Sort matching the backend layout
                const sorted = allSlots.sort((a, b) => {
                    if (b.final_score !== a.final_score) return b.final_score - a.final_score;
                    if (b.attendees.length !== a.attendees.length) return b.attendees.length - a.attendees.length;
                    if (b.partial_join.length !== a.partial_join.length) return b.partial_join.length - a.partial_join.length;
                    if (a.date !== b.date) return a.date.localeCompare(b.date);
                    return a.time.localeCompare(b.time);
                });
                setSortedSlots(sorted);

                // Process restaurants list
                setTopRestaurants(resultData.all_scored_restaurants || []);

                // 3. Fetch all group member profiles to translate userIds to names
                if (meeting.group_id) {
                    const members = await apiService.getUsersByGroup(meeting.group_id);
                    const profileMap: Record<string, any> = {};
                    members.forEach((m: any) => {
                        profileMap[m.user_id] = {
                            name: m.display_name || m.user_name || 'Unknown Friend',
                            picture: m.pictureurl || ''
                        };
                    });
                    setUserProfiles(profileMap);
                }

                // 4. Fetch the user's attendee details for preferences
                try {
                    const attendees = await apiService.getMeetingAttendees(meetingId);
                    setAllMeetingAttendees(attendees);
                    const myAttendee = attendees.find((a: any) => a.user_id === userId);
                    if (myAttendee && myAttendee.preference) {
                        setUserPreference(myAttendee.preference);
                    }
                } catch (prefErr) {
                    console.error("Error loading user preferences:", prefErr);
                }
            } catch (err) {
                console.error("Error loading survey metadata:", err);
            } finally {
                setLoadingData(false);
            }

            // Check if feedback already submitted
            if (meetingId && userId) {
                try {
                    const res = await apiService.checkFeedback(meetingId, userId);
                    if (res?.submitted) setIsSubmitted(true);
                } catch (e) { /* ignore */ }
            }
        };

        fetchData();
    }, [meetingId, userId]);

    // Group questions by section
    const sections = useMemo(() => {
        const groups: Record<string, typeof surveyQuestions> = {};
        surveyQuestions.forEach((q) => {
            if (!groups[q.section]) {
                groups[q.section] = [];
            }
            groups[q.section].push(q);
        });
        return Object.entries(groups);
    }, []);

    const [activeSectionIndex, setActiveSectionIndex] = useState(0);
    const currentSection = sections[activeSectionIndex];
    const isFirstSection = activeSectionIndex === 0;
    const isLastSection = activeSectionIndex === sections.length - 1;

    // Persist responses to sessionStorage so navigating away doesn't lose progress
    const STORAGE_KEY = `feedback_responses_${meetingId}`;
    const SECTION_KEY = `feedback_section_${meetingId}`;

    useEffect(() => {
        if (!meetingId) return;
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) setResponses(JSON.parse(saved));
            const savedSection = sessionStorage.getItem(SECTION_KEY);
            if (savedSection) setActiveSectionIndex(parseInt(savedSection, 10));
        } catch (e) { /* ignore */ }
    }, [meetingId]);

    useEffect(() => {
        if (!meetingId) return;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(responses));
        sessionStorage.setItem(SECTION_KEY, String(activeSectionIndex));
    }, [responses, activeSectionIndex, meetingId]);

    const handleNextSection = () => {
        const sectionQuestions = currentSection?.[1] || [];
        const missing = sectionQuestions.filter(q => {
            if (q.optional) return false;
            const val = responses[q.id];
            return val === undefined || val === '';
        });
        if (missing.length > 0) {
            setError('กรุณาตอบคำถามที่มีเครื่องหมาย * ให้ครบก่อนไปส่วนถัดไป');
            return;
        }
        setError(null);
        setActiveSectionIndex(prev => Math.min(sections.length - 1, prev + 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const tryFeatureLinks: Record<string, { label: string; href: string }> = useMemo(() => {
        if (!meetingId) return {};
        const gId = meetingGroupId || '';
        return {
            q20: { label: 'ลองสร้างกิจกรรมนัดหมาย', href: `/create-meeting?survey_mode=true&return_to_survey=${meetingId}` },
            // q22: { label: 'ลองดูขั้นตอนโหวต', href: `/vote?meeting_id=${meetingId}&group_id=${gId}&survey_mode=true&return_to_survey=${meetingId}` },
            q23: { label: 'ลองดูสรุปผลและตัดสินใจ', href: `/decision?meeting_id=${meetingId}&group_id=${gId}&survey_mode=true&return_to_survey=${meetingId}` },
        };
    }, [meetingId, meetingGroupId]);

    const handleSelectOption = (questionId: string, value: string) => {
        setResponses((prev) => ({ ...prev, [questionId]: value }));
    };

    const handleCheckboxOption = (questionId: string, value: string) => {
        setResponses((prev) => {
            const current = prev[questionId] || [];
            const updated = current.includes(value)
                ? current.filter((v: string) => v !== value)
                : [...current, value];
            return { ...prev, [questionId]: updated };
        });
    };

    const handleRatingOption = (questionId: string, rating: number) => {
        setResponses((prev) => ({ ...prev, [questionId]: rating }));
    };

    const handleTextChange = (questionId: string, value: string) => {
        setResponses((prev) => ({ ...prev, [questionId]: value }));
    };

    const handleSubmit = async () => {
        // Validate required questions in all sections
        const missingRequired = surveyQuestions.filter((q) => {
            const hasAns = responses[q.id] !== undefined && responses[q.id] !== '';
            return !q.optional && !hasAns;
        });

        if (missingRequired.length > 0) {
            setError(`Please answer all required questions before submitting.`);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await apiService.submitFeedback(meetingId, userId, responses);
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem(SECTION_KEY);
            setIsSubmitted(true);
        } catch (err: any) {
            console.error("Failed to submit feedback:", err);
            if (err.response?.status === 409) {
                setError("คุณเคยทำแบบประเมินสำหรับกิจกรรมนี้แล้ว (Feedback already submitted for this meeting)");
            } else {
                setError("Failed to submit feedback. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const sectionHasContext = (sectionName: string): 'time' | 'restaurant' | null => {
        if (sectionName.startsWith('ส่วนที่ 2')) {
            if (sectionName.includes('เวลาแนะนำ') || sectionName.includes('Time Suggestions')) return 'time';
            if (sectionName.includes('ร้านอาหาร') || sectionName.includes('Information Quality')) return 'restaurant';
        }
        return null;
    };

    // Helper to render dynamic time slot info under matching questions
    const renderTimeSlotExtra = (slotIndex: number) => {
        const slot = sortedSlots[slotIndex];
        if (!slot) return null;

        const getAttendeeName = (uid: string) => userProfiles[uid]?.name || 'Unknown Friend';
        const getAttendeePic = (uid: string) => userProfiles[uid]?.picture || '';

        return (
            <div className="mt-2.5 p-3.5 rounded-xl bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-3 text-left">
                <div className="flex justify-between items-center gap-2">
                    <span className="text-[11px] font-black text-foreground uppercase tracking-wider">
                        ⏰ {slot.date} • {slot.time}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-black shrink-0">
                        Score: {slot.final_score.toFixed(1)}/10
                    </span>
                </div>

                {/* Available list */}
                <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest block">Available Friends ({slot.attendees.length})</span>
                    {slot.attendees.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {slot.attendees.map((uid: string) => (
                                <div key={uid} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[9px] font-bold text-foreground">
                                    {getAttendeePic(uid) && (
                                        <img src={getAttendeePic(uid)} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                                    )}
                                    <span>{getAttendeeName(uid)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[9px] text-muted-foreground/60 italic">None</p>
                    )}
                </div>

                {/* Partially available list */}
                {slot.partial_join && slot.partial_join.length > 0 && (
                    <div className="space-y-1.5">
                        <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest block">Partially Available ({slot.partial_join.length})</span>
                        <div className="flex flex-wrap gap-1.5">
                            {slot.partial_join.map((pj: any) => {
                                const uid = typeof pj === 'string' ? pj : pj.user_id;
                                const timeText = typeof pj === 'string' ? '' : ` (${pj.overlap_text})`;
                                return (
                                    <div key={uid} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-500 dark:text-amber-400">
                                        {getAttendeePic(uid) && (
                                            <img src={getAttendeePic(uid)} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                                        )}
                                        <span>{getAttendeeName(uid)}{timeText}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const getTimeContextData = () => {
        const keyPersons = allMeetingAttendees.filter(a => a.is_key_person && a.is_joined);
        const normalAttendees = allMeetingAttendees.filter(a => !a.is_key_person && a.is_joined);

        const parseSlots = (slots: any[]): { date: string, times: string[] }[] => {
            if (!slots || slots.length === 0) return [];
            const dateGroups: Record<string, string[]> = {};
            slots.forEach(s => {
                if (s.start?.dateTime && s.end?.dateTime) {
                    const dateStr = s.start.dateTime.slice(0, 10);
                    const startTime = s.start.dateTime.slice(11, 16);
                    const endTime = s.end.dateTime.slice(11, 16);
                    if (!dateGroups[dateStr]) {
                        dateGroups[dateStr] = [];
                    }
                    const timeRange = `${startTime}-${endTime}`;
                    if (!dateGroups[dateStr].includes(timeRange)) {
                        dateGroups[dateStr].push(timeRange);
                    }
                } else if (s.date && s.time_slots) {
                    const times = s.time_slots.map((t: any) => `${t.start}-${t.end}`);
                    if (!dateGroups[s.date]) {
                        dateGroups[s.date] = [];
                    }
                    times.forEach((t: string) => {
                        if (!dateGroups[s.date].includes(t)) {
                            dateGroups[s.date].push(t);
                        }
                    });
                }
            });

            return Object.entries(dateGroups).map(([date, times]) => ({
                date,
                times
            })).sort((a, b) => a.date.localeCompare(b.date));
        };

        const kpSummaries = keyPersons.map(kp => {
            const name = userProfiles[kp.user_id]?.name || 'Key Person';
            return {
                name,
                pic: userProfiles[kp.user_id]?.picture || '',
                slots: parseSlots(kp.avaliable_at)
            };
        });

        const normalSummaries = normalAttendees.map(na => {
            const name = userProfiles[na.user_id]?.name || 'Attendee';
            return {
                name,
                pic: userProfiles[na.user_id]?.picture || '',
                slots: parseSlots(na.avaliable_at)
            };
        });

        return { kpSummaries, normalSummaries };
    };

    const getRestaurantContextData = () => {
        const keyPersons = allMeetingAttendees.filter(a => a.is_key_person && a.is_joined);
        const normalAttendees = allMeetingAttendees.filter(a => !a.is_key_person && a.is_joined);

        const formatPreferences = (pref: any) => {
            if (!pref) return 'ไม่กำหนดความต้องการพิเศษ';
            const parts: string[] = [];
            if (pref.price && pref.price !== 'Any') parts.push(`งบ: ${pref.price}`);
            if (pref.category && pref.category.length > 0) parts.push(`อาหารที่ชอบ: ${pref.category.join(', ')}`);
            if (pref.good_fors && pref.good_fors.length > 0) parts.push(`บรรยากาศ: ${pref.good_fors.join(', ')}`);
            if (pref.parking) parts.push('🚗 ที่จอดรถ');
            if (pref.alcohols) parts.push('🍺 แอลกอฮอล์');
            return parts.length > 0 ? parts.join(' | ') : 'เลือกแบบทั่วไป (Any)';
        };

        const kpPrefs = keyPersons.map(kp => {
            const name = userProfiles[kp.user_id]?.name || 'Key Person';
            return {
                name,
                pic: userProfiles[kp.user_id]?.picture || '',
                prefs: formatPreferences(kp.preference)
            };
        });

        // Aggregate Normal Attendees preferences
        const cuisines: Record<string, number> = {};
        const vibes: Record<string, number> = {};
        const avoids: Set<string> = new Set();
        let parkingCount = 0;
        let alcoholCount = 0;

        normalAttendees.forEach(na => {
            const pref = na.preference;
            if (pref) {
                if (pref.category) {
                    pref.category.forEach((c: string) => { cuisines[c] = (cuisines[c] || 0) + 1; });
                }
                if (pref.good_fors) {
                    pref.good_fors.forEach((v: string) => { vibes[v] = (vibes[v] || 0) + 1; });
                }
                if (pref.avoid_categories) {
                    pref.avoid_categories.forEach((c: string) => avoids.add(c));
                }
                if (pref.parking) parkingCount++;
                if (pref.alcohols) alcoholCount++;
            }
        });

        const cuisinesList = Object.entries(cuisines).sort((a, b) => b[1] - a[1]).map(e => `${e[0]} (${e[1]} คน)`);
        const vibesList = Object.entries(vibes).sort((a, b) => b[1] - a[1]).map(e => `${e[0]} ( ${e[1]} คน)`);
        const avoidList = Array.from(avoids);

        const normalSummaryParts: string[] = [];
        if (cuisinesList.length > 0) normalSummaryParts.push(`อาหารที่ชอบ: ${cuisinesList.slice(0, 3).join(', ')}`);
        if (vibesList.length > 0) normalSummaryParts.push(`บรรยากาศ: ${vibesList.slice(0, 3).join(', ')}`);
        if (parkingCount > 0) normalSummaryParts.push(`ต้องการที่จอดรถ (${parkingCount} คน)`);
        if (alcoholCount > 0) normalSummaryParts.push(`ต้องการแอลกอฮอล์ (${alcoholCount} คน)`);

        const normalPrefsSummary = normalSummaryParts.length > 0 ? normalSummaryParts.join(' | ') : 'ไม่ระบุเงื่อนไขพิเศษ';

        return { kpPrefs, normalPrefsSummary, avoidList };
    };

    const renderTimeContextAndList = () => {
        const { kpSummaries, normalSummaries } = getTimeContextData();
        return (
            <div className="space-y-4 p-4 rounded-2xl bg-primary/10 border border-primary/20 text-left animate-in fade-in duration-300">
                <div className="border-b border-primary/20 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                    <div>
                        <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            📅 Group Availability Context (เงื่อนไขและเวลาว่างของกลุ่ม)
                        </h4>
                        <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5">
                            นี่คือโจทย์เวลาว่างของสมาชิกในกลุ่มที่ส่งเข้ามา อัลกอริทึมจะคำนวณช่วงเวลาที่ทับซ้อนและจัดลำดับแนะนำเวลาว่าง
                        </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30 text-[9px] font-black text-primary uppercase tracking-wider">
                        ⚖️ VIP weight: Key Person 70% / Attendee 30%
                    </div>
                </div>

                <div className="space-y-3.5">
                    {/* Key Persons Box */}
                    <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase text-primary tracking-widest block flex items-center gap-1">
                            🔑 Key Person Schedule (เวลาว่างของผู้มีอำนาจตัดสินใจหลัก)
                        </span>
                        {kpSummaries.length > 0 ? (
                            <div className="space-y-1.5">
                                {kpSummaries.map((kp, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                        {kp.pic ? (
                                            <img src={kp.pic} alt="" className="w-6 h-6 rounded-full object-cover border border-primary/20 shrink-0" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">👑</div>
                                        )}
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <span className="text-[10px] font-black text-foreground block truncate">{kp.name}</span>
                                            {kp.slots.length > 0 ? (
                                                <div className="flex flex-col gap-1 mt-1">
                                                    {kp.slots.map((slot, sIdx) => (
                                                        <div key={sIdx} className="flex flex-wrap items-center gap-1.5">
                                                            <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-black text-[8px]">
                                                                📅 {slot.date}
                                                            </span>
                                                            {slot.times.map((t, tIdx) => (
                                                                <span key={tIdx} className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 text-foreground text-[8px] font-bold">
                                                                    ⏰ {t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-[9px] text-muted-foreground italic block">ไม่สะดวก / ไม่ระบุเวลาว่าง</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <span className="text-[9px] text-muted-foreground italic block">ไม่มีผู้มีอำนาจตัดสินใจหลัก (Key Person) ในกลุ่มนี้</span>
                        )}
                    </div>

                    {/* Normal Attendees Box */}
                    <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block flex items-center gap-1">
                            👥 Normal Attendees Schedule (เวลาว่างสมาชิกทั่วไป)
                        </span>
                        {normalSummaries.length > 0 ? (
                            <div className="space-y-1.5">
                                {normalSummaries.map((na, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                        {na.pic ? (
                                            <img src={na.pic} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">👤</div>
                                        )}
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <span className="text-[10px] font-black text-foreground block truncate">{na.name}</span>
                                            {na.slots.length > 0 ? (
                                                <div className="flex flex-col gap-1 mt-1">
                                                    {na.slots.map((slot, sIdx) => (
                                                        <div key={sIdx} className="flex flex-wrap items-center gap-1.5">
                                                            <span className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 text-foreground text-[8px] font-bold">
                                                                📅 {slot.date}
                                                            </span>
                                                            {slot.times.map((t, tIdx) => (
                                                                <span key={tIdx} className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 text-foreground text-[8px] font-bold">
                                                                    ⏰ {t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-[9px] text-muted-foreground italic block">ไม่สะดวก / ไม่ระบุเวลาว่าง</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <span className="text-[9px] text-muted-foreground italic block">ไม่มีสมาชิกทั่วไปเข้าร่วม</span>
                        )}
                    </div>

                    {/* Recommended Slots Dashboard */}
                    <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                        <span className="text-[9px] font-black uppercase text-primary tracking-widest block">
                            🕒 Suggestion Results (ช่วงเวลาแนะนำที่ดีที่สุดจากแอปพลิเคชัน)
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                            {sortedSlots.slice(0, 3).map((slot, index) => {
                                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                                const getAttendeeName = (uid: string) => userProfiles[uid]?.name || 'Unknown Friend';
                                const getAttendeePic = (uid: string) => userProfiles[uid]?.picture || '';
                                return (
                                    <div key={index} className="p-3 rounded-xl bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-2">
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-[10px] font-black text-foreground uppercase tracking-wider">
                                                {medal} อันดับ {index + 1}: {slot.date} • {slot.time}
                                            </span>
                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-black shrink-0">
                                                Score: {slot.final_score.toFixed(1)}/10
                                            </span>
                                        </div>
                                        {/* Attendance representation */}
                                        <div className="space-y-1">
                                            <span className="text-[8px] uppercase font-black text-muted-foreground block">สะดวกครบ ({slot.attendees.length} คน):</span>
                                            {slot.attendees.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {slot.attendees.map((uid: string) => (
                                                        <div key={uid} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 text-[8px] font-bold text-foreground">
                                                            {getAttendeePic(uid) && <img src={getAttendeePic(uid)} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />}
                                                            <span>{getAttendeeName(uid)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-[8px] text-muted-foreground/60 italic">ไม่มี</span>
                                            )}
                                        </div>
                                        {slot.partial_join && slot.partial_join.length > 0 && (
                                            <div className="space-y-1">
                                                <span className="text-[8px] uppercase font-black text-amber-500 block">สะดวกบางส่วน ({slot.partial_join.length} คน):</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {slot.partial_join.map((pj: any) => {
                                                        const uid = typeof pj === 'string' ? pj : pj.user_id;
                                                        const timeText = typeof pj === 'string' ? '' : ` (${pj.overlap_text})`;
                                                        return (
                                                            <div key={uid} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-[8px] font-bold text-amber-500">
                                                                {getAttendeePic(uid) && <img src={getAttendeePic(uid)} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />}
                                                                <span>{getAttendeeName(uid)}{timeText}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderRestaurantContextAndList = () => {
        const { kpPrefs, normalPrefsSummary, avoidList } = getRestaurantContextData();
        return (
            <div className="space-y-4 p-4 rounded-2xl bg-primary/10 border border-primary/20 text-left animate-in fade-in duration-300">
                <div className="border-b border-primary/20 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                    <div>
                        <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            🎯 DINING QUEST CONSTRAINTS (โจทย์ความต้องการของกลุ่ม)
                        </h4>
                        <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5">
                            นี่คือรายการเงื่อนไขความชอบที่รวบรวมได้จากทั้งกลุ่ม ระบบจัดสรรและคัดเลือกแนะนำร้านอาหารที่เหมาะสมที่สุด
                        </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30 text-[9px] font-black text-primary uppercase tracking-wider">
                        ⚖️ Stakeholder: Key Person 70% / Attendee 30%
                    </div>
                </div>

                <div className="space-y-3.5">
                    {/* Your Preference Recall Card */}
                    {userPreference && (
                        <div className="p-3.5 rounded-xl bg-primary/20 border border-primary/30 space-y-2">
                            <span className="text-[10px] font-black uppercase text-primary tracking-widest block flex items-center gap-1">
                                🎒 YOUR CRAVINGS & PRIORITIES RECALL (ความต้องการของคุณ)
                            </span>
                            <div className="space-y-2 text-[10px] font-bold text-foreground leading-relaxed">
                                {Object.keys(rocWeights).length > 0 ? (
                                    <div className="space-y-1">
                                        <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest block">Priority Weights (computed via ROC Centroid):</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {Object.entries(rocWeights).sort((a, b) => b[1] - a[1]).map(([factor, weight]) => (
                                                <span key={factor} className="px-2.5 py-1 rounded-lg bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[9px] font-bold">
                                                    {getFactorIcon(factor)} {getFactorDisplayName(factor)} ({(weight * 100).toFixed(1)}%)
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-[9px] text-muted-foreground italic block">ไม่ได้จัดลำดับความสำคัญ (No Ranked Priorities)</span>
                                )}

                                <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                                    <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest block">Your Selected Constraints:</span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                        <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                            <span className="text-[8px] text-muted-foreground block uppercase">Budget / Price</span>
                                            <span className="text-foreground">{userPreference.price && userPreference.price !== 'Any' ? userPreference.price : 'Any Budget'}</span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                            <span className="text-[8px] text-muted-foreground block uppercase">Preferred Cuisines</span>
                                            <span className="text-foreground truncate block" title={userPreference.category?.join(', ')}>{userPreference.category && userPreference.category.length > 0 ? userPreference.category.join(', ') : 'Any Cuisine'}</span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                            <span className="text-[8px] text-muted-foreground block uppercase">Ideal Vibes</span>
                                            <span className="text-foreground truncate block" title={userPreference.good_fors?.join(', ')}>{userPreference.good_fors && userPreference.good_fors.length > 0 ? userPreference.good_fors.join(', ') : 'Any Vibe'}</span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex justify-between items-center">
                                            <div>
                                                <span className="text-[8px] text-muted-foreground block uppercase">Special Needs</span>
                                                <span className="text-foreground">
                                                    {[
                                                        userPreference.parking ? '🚗 Parking' : null,
                                                        userPreference.alcohols ? '🍺 Alcohol' : null
                                                    ].filter(Boolean).join(' | ') || 'None'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {userPreference.avoid_categories && userPreference.avoid_categories.length > 0 && (
                                        <div className="mt-1 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-bold">
                                            🚫 Avoided: {userPreference.avoid_categories.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Key Persons Preferences */}
                    <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase text-primary tracking-widest block flex items-center gap-1">
                            👑 Main VIP Cravings (เป้าหมายสูงสุดของปาร์ตี้)
                        </span>
                        {kpPrefs.length > 0 ? (
                            <div className="space-y-1.5">
                                {kpPrefs.map((kp, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                        {kp.pic ? (
                                            <img src={kp.pic} alt="" className="w-6 h-6 rounded-full object-cover border border-primary/20 shrink-0" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">👑</div>
                                        )}
                                        <div className="space-y-0.5 min-w-0 flex-1">
                                            <span className="text-[10px] font-black text-foreground block truncate">{kp.name}</span>
                                            <span className="text-[9px] text-muted-foreground block leading-tight">{kp.prefs}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <span className="text-[9px] text-muted-foreground italic block">ไม่มีผู้มีอำนาจตัดสินใจหลัก (Key Person) ในกลุ่มนี้</span>
                        )}
                    </div>

                    {/* Normal Attendees Summary */}
                    <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block flex items-center gap-1">
                            ⚔️ Guild Member Wishes (ความหวังของสมาชิกทั่วไป)
                        </span>
                        <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[9px] font-bold text-foreground leading-relaxed">
                            {normalPrefsSummary}
                        </div>
                    </div>

                    {/* Aggregated Avoid / Veto list */}
                    {avoidList.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[9px] font-black uppercase text-rose-500 tracking-widest block flex items-center gap-1">
                                💀 Forbidden Foods / Vetoes (เมนู/ประเภทต้องห้ามเด็ดขาด)
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {avoidList.map((avoidCategory) => (
                                    <span key={avoidCategory} className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black">
                                        🚫 {avoidCategory}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggestions Comparison */}
                    <div className="space-y-2 pt-2.5 border-t border-black/5 dark:border-white/5">
                        <span className="text-[9px] font-black uppercase text-primary tracking-widest block">
                            🏆 Suggested Restaurant Results (ร้านอาหารที่ระบบจัดสรรแนะนำ)
                        </span>
                        <div className="space-y-4">
                            {topRestaurants.slice(0, 5).map((rest, index) => {
                                return (
                                    <div key={rest.id} className="relative">
                                        <div className="absolute top-2.5 left-2.5 z-10 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[9px] font-black shadow-md">
                                            #{index + 1}
                                        </div>
                                        <div className="pl-9">
                                            {renderRestaurantExtra(index)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Helper to render dynamic restaurant info under matching questions
    const renderRestaurantExtra = (restIndex: number) => {
        const rest = topRestaurants[restIndex];
        if (!rest) return null;

        const attendeeData = rest.reason?._attendee_scores?.[userId || ''];
        const groupScore = rest.score;
        const personalScore = attendeeData?.score;

        // Collect all categories where either the user has a priority or the group has a score/max_score > 0
        const categoriesMap: Record<string, { name: string; personal?: number; group?: number }> = {};

        // 1. Fill in group categories
        if (rest.reason) {
            for (const [catName, details] of Object.entries(rest.reason)) {
                if (catName !== '_attendee_scores' && details && typeof details === 'object') {
                    const maxScore = (details as any).max_score || 0;
                    if (maxScore > 0) {
                        const baseScore = (details as any).base_score || 0;
                        categoriesMap[catName] = {
                            name: catName,
                            group: baseScore
                        };
                    }
                }
            }
        }

        // 2. Fill in personal categories
        if (attendeeData?.reason) {
            for (const [catName, details] of Object.entries(attendeeData.reason)) {
                if (details && typeof details === 'object') {
                    const maxScore = (details as any).max || 0;
                    if (maxScore > 0) {
                        const baseScore = (details as any).base || 0;
                        if (categoriesMap[catName]) {
                            categoriesMap[catName].personal = baseScore;
                        } else {
                            categoriesMap[catName] = {
                                name: catName,
                                personal: baseScore
                            };
                        }
                    }
                }
            }
        }

        const categories = Object.values(categoriesMap);

        let link = rest.wongnai_link || rest.url;
        if (link && !link.startsWith('http')) {
            link = `https://${link}`;
        }

        // Helper to parse Python-like list strings safely
        const parsePythonList = (val: any): string[] => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') {
                const trimmed = val.trim();
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                        const formatted = trimmed.replace(/'/g, '"');
                        return JSON.parse(formatted);
                    } catch (e) {
                        return trimmed
                            .slice(1, -1)
                            .split(',')
                            .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
                            .filter(Boolean);
                    }
                }
                return [trimmed];
            }
            return [];
        };

        const restCategories = parsePythonList(rest.category);
        const restGoodFors = parsePythonList(rest.good_fors);
        const restAlcohols = parsePythonList(rest.alcohols);

        // Check compatibility details
        const userPrice = userPreference?.price;
        const isPriceMatch = !userPrice || userPrice === 'Any' || rest.price === userPrice;

        const userCuisines = userPreference?.category || [];
        const matchingCuisines = restCategories.filter((c: string) => userCuisines.includes(c));
        const isCuisineMatch = userCuisines.length === 0 || matchingCuisines.length > 0;

        const userAvoids = userPreference?.avoid_categories || [];
        const conflictingAvoids = restCategories.filter((c: string) => userAvoids.includes(c));
        const isAvoidConflict = conflictingAvoids.length > 0;

        const userVibes = userPreference?.good_fors || [];
        const matchingVibes = restGoodFors.filter((v: string) => userVibes.includes(v));
        const isVibeMatch = userVibes.length === 0 || matchingVibes.length > 0;

        const requiresParking = !!userPreference?.parking;
        const hasParking = rest.parking && !String(rest.parking).includes('ไม่มี') && rest.parking !== 'None' && rest.parking !== 'ไม่มีที่จอดรถ';
        const isParkingMatch = !requiresParking || hasParking;

        const requiresAlcohol = !!userPreference?.alcohols;
        const hasAlcohol = restAlcohols.length > 0 || (rest.alcohols && !String(rest.alcohols).includes('ไม่มี') && rest.alcohols !== 'None' && rest.alcohols !== '[]');
        const isAlcoholMatch = !requiresAlcohol || hasAlcohol;

        return (
            <div className="mt-2.5 p-3.5 rounded-xl bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-3 text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-0.5">
                        {link ? (
                            <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-black text-primary hover:underline inline-flex items-center gap-1 transition-all"
                            >
                                🔗 {rest.name}
                            </a>
                        ) : (
                            <span className="text-xs font-black text-foreground">
                                🍴 {rest.name}
                            </span>
                        )}
                        <span className="text-[9px] text-muted-foreground block leading-tight">
                            Cuisine: {restCategories.join(', ') || 'N/A'}
                        </span>
                        {/* Highlights/Badges Tag List */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {getHighlights(rest).map((badge, bIdx) => {
                                const colorClasses =
                                    badge.type === 'gold' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                        badge.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                            badge.type === 'info' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                                'bg-purple-500/10 text-purple-400 border border-purple-500/20';
                                return (
                                    <span
                                        key={bIdx}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${colorClasses}`}
                                    >
                                        {badge.text}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* Score comparison indicators */}
                    <div className="flex gap-1.5 w-full sm:w-auto">
                        {personalScore !== undefined && (
                            <div className="flex-1 sm:flex-initial text-center px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[9px]">
                                <span className="text-[8px] uppercase font-black text-primary tracking-wide block">Your Score</span>
                                <span className="font-black text-foreground">{personalScore.toFixed(1)}/100</span>
                            </div>
                        )}
                        <div className="flex-1 sm:flex-initial text-center px-2 py-0.5 rounded bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[9px]">
                            <span className="text-[8px] uppercase font-black text-muted-foreground tracking-wide block">Group Score</span>
                            <span className="font-black text-foreground">{groupScore.toFixed(1)}/100</span>
                        </div>
                    </div>
                </div>

                {/* Preference categories breakdown comparison */}
                {categories.length > 0 && (
                    <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                        <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest block">
                            Matching Score Comparison Breakdown
                        </span>
                        <div className="overflow-hidden rounded-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5">
                            <table className="w-full text-left text-[9px] border-collapse">
                                <thead>
                                    <tr className="border-b border-black/5 dark:border-white/5 bg-black/15 dark:bg-white/5 text-[8px] font-black uppercase text-muted-foreground">
                                        <th className="p-1.5">Criteria</th>
                                        <th className="p-1.5 text-right w-16">Your</th>
                                        <th className="p-1.5 text-right w-16">Group</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categories.map((cat) => {
                                        const weight = rocWeights[cat.name];
                                        const weightStr = weight !== undefined ? ` (${(weight * 100).toFixed(0)}%)` : '';
                                        return (
                                            <tr key={cat.name} className="border-b border-black/5 dark:border-white/5 last:border-0 font-bold text-foreground">
                                                <td className="p-1.5 text-muted-foreground">
                                                    {getFactorIcon(cat.name)} {getFactorDisplayName(cat.name)}{weightStr}
                                                </td>
                                                <td className="p-1.5 text-right text-primary">
                                                    {cat.personal !== undefined ? `${Math.round(cat.personal)}%` : '—'}
                                                </td>
                                                <td className="p-1.5 text-right text-foreground">
                                                    {cat.group !== undefined ? `${Math.round(cat.group)}%` : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {/* Total Match Score row */}
                                    <tr className="bg-black/10 dark:bg-white/10 font-black text-foreground border-t border-black/10 dark:border-white/10">
                                        <td className="p-1.5 text-muted-foreground">Total Match Score</td>
                                        <td className="p-1.5 text-right text-primary">
                                            {personalScore !== undefined ? `${personalScore.toFixed(1)}/100` : '—'}
                                        </td>
                                        <td className="p-1.5 text-right text-foreground">
                                            {groupScore !== undefined ? `${groupScore.toFixed(1)}/100` : '—'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Preference Matching Analysis */}
                {userPreference && (
                    <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                        <span className="text-[9px] uppercase font-black text-primary tracking-widest block">
                            Preference Alignment Analysis
                        </span>

                        {/* Avoid warnings alert if there are conflicts */}
                        {isAvoidConflict && (
                            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black flex items-center gap-1.5 mb-2">
                                <span>⚠️ Conflict: Contains avoided cuisine/ingredient:</span>
                                <span className="underline">{conflictingAvoids.join(', ')}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px] font-bold text-foreground">
                            {/* Budget/Price Match */}
                            {userPrice && (
                                <div className="flex justify-between items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                    <div className="space-y-0.5">
                                        <span className="text-muted-foreground block text-[8px] uppercase">Budget Match</span>
                                        <span className="text-foreground font-black">Rest: {rest.price || 'N/A'}</span>
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black ${isPriceMatch ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                        }`}>
                                        {isPriceMatch ? 'Match' : 'Mismatch'}
                                    </span>
                                </div>
                            )}

                            {/* Cuisine Match */}
                            {userCuisines.length > 0 && (
                                <div className="flex justify-between items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                    <div className="space-y-0.5">
                                        <span className="text-muted-foreground block text-[8px] uppercase">Cuisine Match</span>
                                        <span className="text-foreground font-black truncate max-w-[120px] block" title={restCategories.join(', ')}>
                                            {matchingCuisines.length > 0 ? matchingCuisines.join(', ') : 'None matching'}
                                        </span>
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black ${isCuisineMatch ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                        }`}>
                                        {isCuisineMatch ? 'Match' : 'Mismatch'}
                                    </span>
                                </div>
                            )}

                            {/* Vibe Match */}
                            {userVibes.length > 0 && (
                                <div className="flex justify-between items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                    <div className="space-y-0.5">
                                        <span className="text-muted-foreground block text-[8px] uppercase">Vibe Match</span>
                                        <span className="text-foreground font-black truncate max-w-[120px] block">
                                            {matchingVibes.length > 0 ? matchingVibes.join(', ') : 'None matching'}
                                        </span>
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black ${isVibeMatch ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                        }`}>
                                        {isVibeMatch ? 'Match' : 'Mismatch'}
                                    </span>
                                </div>
                            )}

                            {/* Parking Match */}
                            {requiresParking && (
                                <div className="flex justify-between items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                    <div className="space-y-0.5">
                                        <span className="text-muted-foreground block text-[8px] uppercase">Parking Match</span>
                                        <span className="text-foreground font-black">{hasParking ? 'Available' : 'None'}</span>
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black ${isParkingMatch ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                        }`}>
                                        {isParkingMatch ? 'Match' : 'Mismatch'}
                                    </span>
                                </div>
                            )}

                            {/* Alcohol Match */}
                            {requiresAlcohol && (
                                <div className="flex justify-between items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                    <div className="space-y-0.5">
                                        <span className="text-muted-foreground block text-[8px] uppercase">Alcohol Match</span>
                                        <span className="text-foreground font-black">{hasAlcohol ? 'Available' : 'None'}</span>
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black ${isAlcoholMatch ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                        }`}>
                                        {isAlcoholMatch ? 'Match' : 'Mismatch'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (!meetingId) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                <div className="glass-panel p-8 rounded-3xl text-center max-w-sm border border-black/5 dark:border-white/5 space-y-4">
                    <p className="text-sm font-bold text-amber-400">⚠️ Meeting ID is missing.</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">
                        Please check the link and try again.
                    </p>
                </div>
            </div>
        );
    }

    if (liffError) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4 bg-background">
                <div className="glass-panel p-8 rounded-[32px] flex flex-col items-center gap-6 text-center max-w-sm border border-red-500/10">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-3xl text-red-400">
                        ⚠️
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground mb-2">LINE Init Failed</h2>
                        <p className="text-muted-foreground text-xs leading-relaxed mb-4">{liffError}</p>
                        <p className="text-[10px] text-muted-foreground italic text-left">If you are testing locally or via a tunnel, you can bypass LINE validation to continue.</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                        <button
                            onClick={() => bypassLiff()}
                            className="bg-primary/10 hover:bg-primary/20 text-primary font-bold py-3 px-6 rounded-xl text-sm transition-all border border-primary/30"
                        >
                            Bypass LINE (Mock)
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-primary hover:bg-primary/95 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-primary/20"
                        >
                            Retry Connection
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!liffObject && !profile) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4 bg-background">
                <div className="glass-panel p-8 rounded-[32px] flex flex-col items-center gap-6 text-center max-w-sm">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <div>
                        <p className="text-foreground font-bold mb-1">Initializing LINE Client...</p>
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
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 bg-background">
            <div className="w-full max-w-lg glass-panel rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">

                {/* Header */}
                <div className="p-6 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 backdrop-blur-md">
                    <h2 className="text-lg font-black text-foreground tracking-tight">Beta Feedback Survey</h2>
                    <p className="text-[10px] text-primary font-bold uppercase tracking-wider mt-0.5">Help us improve DISHCISION</p>
                    {meetingName && (
                        <p className="text-xs font-bold text-muted-foreground mt-1 tracking-tight">Meeting: {meetingName}</p>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loadingData ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Loading meeting results...</p>
                        </div>
                    ) : isSubmitted ? (
                        <div className="py-12 text-center space-y-4 animate-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center mx-auto shadow-lg shadow-primary/20 text-2xl text-primary-foreground font-bold">
                                🎉
                            </div>
                            <h3 className="text-xl font-bold text-foreground">Thank you for your feedback!</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                Your answers have been saved. Your contribution helps validate DISHCISION for our graduation requirements!
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Section Header */}
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                                    Section {activeSectionIndex + 1} of {sections.length}
                                </span>
                                <h3 className="text-base font-black text-foreground">{currentSection?.[0]}</h3>
                            </div>

                            {sectionHasContext(currentSection[0]) && (
                                <p className="text-[9px] text-muted-foreground flex items-center gap-1.5">
                                    สามารถกดดูรายละเอียดของผลลัพธ์จากการนัดหมายได้โดยกดเครื่องหมาย
                                    <span className="text-primary text-[10px]">📋</span>
                                </p>
                            )}
                            {currentSection?.[0]?.startsWith('ส่วนที่ 3') && (
                                <p className="text-[9px] text-muted-foreground flex items-center gap-1.5">
                                    สามารถกด
                                    <span className="text-emerald-400 text-[10px]">🧪</span>
                                    เพื่อเปิดตัวอย่างหน้านั้น และลองใช้งานจริงก่อนตอบคำถาม
                                </p>
                            )}

                            {/* Question List */}
                            <div className="space-y-6">
                                {currentSection?.[1].map((q) => (
                                    <div key={q.id} className="space-y-3 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-4 rounded-2xl">
                                        <div className="flex items-start gap-2">
                                            <label className="flex-1 text-xs font-bold text-foreground leading-relaxed">
                                                {q.text} {!q.optional && <span className="text-primary">*</span>}
                                            </label>
                                            {(() => {
                                                const ctx = sectionHasContext(currentSection[0]);
                                                return ctx ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setContextModal(ctx)}
                                                        className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-black hover:bg-primary/20 transition-all active:scale-90"
                                                        title="View meeting details"
                                                    >
                                                        📋
                                                    </button>
                                                ) : null;
                                            })()}
                                            {tryFeatureLinks[q.id] && (
                                                <button
                                                    type="button"
                                                    onClick={() => { window.location.href = tryFeatureLinks[q.id].href; }}
                                                    className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px] font-black hover:bg-emerald-500/20 transition-all active:scale-90"
                                                    title="คลิกเพื่อเปิดตัวอย่างหน้านี้ และกลับมาดูใหม่ได้"
                                                >
                                                    🧪
                                                </button>
                                            )}
                                        </div>

                                        {!q.optional && error && (responses[q.id] === undefined || responses[q.id] === '') && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] text-rose-400 font-bold">⚠️ โปรดตอบคำถามนี้</span>
                                            </div>
                                        )}

                                        {/* SELECT/RADIO */}
                                        {q.type === 'select' && q.options && (
                                            <div className="space-y-2">
                                                {q.options.map((opt) => {
                                                    const isSelected = responses[q.id] === opt;
                                                    return (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => handleSelectOption(q.id, opt)}
                                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-xs transition-all ${isSelected
                                                                ? 'bg-primary/10 border-primary text-foreground font-bold'
                                                                : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground'
                                                                }`}
                                                        >
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-primary' : 'border-black/20 dark:border-white/20'
                                                                }`}>
                                                                {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                            </div>
                                                            <span>{opt}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* CHECKBOX */}
                                        {q.type === 'checkbox' && q.options && (
                                            <div className="space-y-2">
                                                {q.options.map((opt) => {
                                                    const isChecked = (responses[q.id] || []).includes(opt);
                                                    return (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => handleCheckboxOption(q.id, opt)}
                                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-xs transition-all ${isChecked
                                                                ? 'bg-primary/10 border-primary text-foreground font-bold'
                                                                : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground'
                                                                }`}
                                                        >
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? 'border-primary bg-primary/20' : 'border-black/20 dark:border-white/20'
                                                                }`}>
                                                                {isChecked && <span className="text-primary text-[10px]">✓</span>}
                                                            </div>
                                                            <span>{opt}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* RATING (1-5) */}
                                        {q.type === 'rating' && (
                                            <div className="flex items-center justify-between gap-1 pt-1 max-w-sm mx-auto">
                                                {[1, 2, 3, 4, 5].map((num) => {
                                                    const isSelected = responses[q.id] === num;
                                                    return (
                                                        <button
                                                            key={num}
                                                            type="button"
                                                            onClick={() => handleRatingOption(q.id, num)}
                                                            className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-black transition-all ${isSelected
                                                                ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/35 scale-110'
                                                                : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground'
                                                                }`}
                                                        >
                                                            {num}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* TEXTAREA */}
                                        {q.type === 'text' && (
                                            <textarea
                                                value={responses[q.id] || ''}
                                                onChange={(e) => handleTextChange(q.id, e.target.value)}
                                                placeholder="Write your feedback here..."
                                                className="w-full glass-input rounded-xl p-3 text-xs focus:ring-2 focus:ring-primary min-h-[80px] transition-all resize-none"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Context Modal */}
                {contextModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="relative w-full max-w-lg max-h-[70vh] overflow-y-auto rounded-[32px] bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl">
                            <div className="sticky top-0 z-10 flex justify-end p-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-black/5 dark:border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setContextModal(null)}
                                    className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-black hover:bg-primary/20 transition-all"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="p-4">
                                {contextModal === 'time' && renderTimeContextAndList()}
                                {contextModal === 'restaurant' && renderRestaurantContextAndList()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer error banner */}
                {!isSubmitted && error && (
                    <div className="px-6 pb-2">
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold text-center">
                            ⚠️ {error}
                        </div>
                    </div>
                )}

                {/* Footer Navigation */}
                {!isSubmitted && (
                    <div className="p-6 border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 backdrop-blur-md flex justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => { setError(null); setActiveSectionIndex(prev => Math.max(0, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            disabled={isFirstSection}
                            className="px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-muted-foreground disabled:opacity-30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                            Back
                        </button>

                        {!isLastSection ? (
                            <button
                                type="button"
                                onClick={handleNextSection}
                                className="px-6 py-3 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 border border-black/5 dark:border-white/5 text-foreground rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-6 py-3 glass-button disabled:opacity-50 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
