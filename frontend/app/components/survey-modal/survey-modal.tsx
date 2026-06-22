'use client';

import React, { useState } from 'react';
import surveyQuestions from '../../config/survey-questions.json';
import { apiService } from '../../services/api';

interface SurveyModalProps {
    isOpen: boolean;
    onClose: () => void;
    meetingId: string;
    userId: string | null;
}

export default function SurveyModal({ isOpen, onClose, meetingId, userId }: SurveyModalProps) {
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Group questions by section
    const sections = React.useMemo(() => {
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

    if (!isOpen) return null;

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

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-zinc-900/90 border border-white/10 rounded-[32px] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                
                {/* Header */}
                <div className="flex-none p-6 border-b border-white/5 bg-zinc-900/50 backdrop-blur-md flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-black text-white tracking-tight">Beta Feedback Survey</h2>
                        <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mt-0.5">Help us improve DISHCISION</p>
                    </div>
                    {!isSubmitted && (
                        <button 
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm hover:bg-white/10 transition-all"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {isSubmitted ? (
                        <div className="py-12 text-center space-y-4 animate-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-purple-500/20 text-2xl">
                                🎉
                            </div>
                            <h3 className="text-xl font-bold text-white">Thank you for your feedback!</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                Your answers have been saved. Your contribution helps validate DISHCISION for our graduation requirements!
                            </p>
                            <button
                                onClick={onClose}
                                className="mt-6 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-500/25"
                            >
                                Close Survey
                            </button>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-xl font-medium animate-in fade-in duration-200">
                                    {error}
                                </div>
                            )}

                            {/* Section Header */}
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">
                                    Section {activeSectionIndex + 1} of {sections.length}
                                </span>
                                <h3 className="text-base font-black text-white">{currentSection?.[0]}</h3>
                            </div>

                            {/* Question List */}
                            <div className="space-y-6">
                                {currentSection?.[1].map((q) => (
                                    <div key={q.id} className="space-y-3 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                                        <label className="block text-xs font-bold text-foreground leading-relaxed">
                                            {q.text} {!q.optional && <span className="text-purple-400">*</span>}
                                        </label>

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
                                                                    ? 'bg-purple-600/20 border-purple-500 text-white font-bold' 
                                                                    : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                                                            }`}
                                                        >
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                                                isSelected ? 'border-purple-400' : 'border-white/20'
                                                            }`}>
                                                                {isSelected && <div className="w-2 h-2 rounded-full bg-purple-400" />}
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
                                                                    ? 'bg-purple-600/20 border-purple-500 text-white font-bold' 
                                                                    : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                                                            }`}
                                                        >
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                                                isChecked ? 'border-purple-400 bg-purple-500/20' : 'border-white/20'
                                                            }`}>
                                                                {isChecked && <span className="text-purple-400 text-[10px]">✓</span>}
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
                                                                    ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/35 scale-110'
                                                                    : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
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
                                                className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-foreground focus:outline-none focus:border-purple-500/50 min-h-[80px] transition-all resize-none"
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
                    <div className="flex-none p-6 border-t border-white/5 bg-zinc-900/50 backdrop-blur-md flex justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setActiveSectionIndex(prev => Math.max(0, prev - 1))}
                            disabled={isFirstSection}
                            className="px-4 py-3 bg-white/5 border border-white/10 text-muted-foreground disabled:opacity-30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                            Back
                        </button>
                        
                        {!isLastSection ? (
                            <button
                                type="button"
                                onClick={() => setActiveSectionIndex(prev => Math.min(sections.length - 1, prev + 1))}
                                className="px-6 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-500/20"
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
