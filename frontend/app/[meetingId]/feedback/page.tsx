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

    // Dynamic data states
    const [loadingData, setLoadingData] = useState(true);
    const [meetingName, setMeetingName] = useState('');
    const [sortedSlots, setSortedSlots] = useState<any[]>([]);
    const [topRestaurants, setTopRestaurants] = useState<any[]>([]);
    const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

    useEffect(() => {
        if (!meetingId) return;

        const fetchData = async () => {
            try {
                setLoadingData(true);
                // 1. Fetch meeting basic info
                const meeting = await apiService.getMeeting(meetingId, userId || undefined);
                setMeetingName(meeting.meeting_name);

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
                    return b.partial_join.length - a.partial_join.length;
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
            } catch (err) {
                console.error("Error loading survey metadata:", err);
            } finally {
                setLoadingData(false);
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
            setIsSubmitted(true);
        } catch (err: any) {
            console.error("Failed to submit feedback:", err);
            setError("Failed to submit feedback. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentSection = sections[activeSectionIndex];
    const isFirstSection = activeSectionIndex === 0;
    const isLastSection = activeSectionIndex === sections.length - 1;

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
                            Cuisine: {Array.isArray(rest.category) ? rest.category.join(', ') : rest.category || 'N/A'}
                        </span>
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
                            Score Comparison Breakdown
                        </span>
                        <div className="overflow-hidden rounded-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5">
                            <table className="w-full text-left text-[9px] border-collapse">
                                <thead>
                                    <tr className="border-b border-black/5 dark:border-white/5 bg-black/15 dark:bg-white/5 text-[8px] font-black uppercase text-muted-foreground">
                                        <th className="p-1.5">Criteria</th>
                                        <th className="p-1.5 text-right w-16">You</th>
                                        <th className="p-1.5 text-right w-16">Group</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categories.map((cat) => (
                                        <tr key={cat.name} className="border-b border-black/5 dark:border-white/5 last:border-0 font-bold text-foreground">
                                            <td className="p-1.5 text-muted-foreground">{cat.name}</td>
                                            <td className="p-1.5 text-right text-primary">
                                                {cat.personal !== undefined ? `${Math.round(cat.personal)}%` : '—'}
                                            </td>
                                            <td className="p-1.5 text-right text-foreground">
                                                {cat.group !== undefined ? `${Math.round(cat.group)}%` : '—'}
                                            </td>
                                        </tr>
                                    ))}
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
                            {error && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium animate-in fade-in duration-200">
                                    {error}
                                </div>
                            )}

                            {/* Section Header */}
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                                    Section {activeSectionIndex + 1} of {sections.length}
                                </span>
                                <h3 className="text-base font-black text-foreground">{currentSection?.[0]}</h3>
                            </div>

                            {/* Question List */}
                            <div className="space-y-6">
                                {currentSection?.[1].map((q) => (
                                    <div key={q.id} className="space-y-3 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-4 rounded-2xl">
                                        <label className="block text-xs font-bold text-foreground leading-relaxed">
                                            {q.text} {!q.optional && <span className="text-primary">*</span>}
                                        </label>

                                        {/* DYNAMIC METADATA BLOCKS */}
                                        {q.id === 'q6' && renderTimeSlotExtra(0)}
                                        {q.id === 'q7' && renderTimeSlotExtra(1)}
                                        {q.id === 'q8' && renderTimeSlotExtra(2)}
                                        {q.id === 'q10' && renderRestaurantExtra(0)}
                                        {q.id === 'q11' && renderRestaurantExtra(1)}
                                        {q.id === 'q12' && renderRestaurantExtra(2)}
                                        {q.id === 'q13' && renderRestaurantExtra(3)}
                                        {q.id === 'q14' && renderRestaurantExtra(4)}

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
                                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-xs transition-all ${
                                                                isSelected 
                                                                    ? 'bg-primary/10 border-primary text-foreground font-bold' 
                                                                    : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground'
                                                            }`}
                                                        >
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                                                isSelected ? 'border-primary' : 'border-black/20 dark:border-white/20'
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
                                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-xs transition-all ${
                                                                isChecked 
                                                                    ? 'bg-primary/10 border-primary text-foreground font-bold' 
                                                                    : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground'
                                                            }`}
                                                        >
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                                                isChecked ? 'border-primary bg-primary/20' : 'border-black/20 dark:border-white/20'
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
                                                            className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-black transition-all ${
                                                                isSelected
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

                {/* Footer Navigation */}
                {!isSubmitted && (
                    <div className="p-6 border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 backdrop-blur-md flex justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setActiveSectionIndex(prev => Math.max(0, prev - 1))}
                            disabled={isFirstSection}
                            className="px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-muted-foreground disabled:opacity-30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                            Back
                        </button>
                        
                        {!isLastSection ? (
                            <button
                                type="button"
                                onClick={() => setActiveSectionIndex(prev => Math.min(sections.length - 1, prev + 1))}
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
