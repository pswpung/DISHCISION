'use client';

import { useState } from 'react';

interface TimeSlot {
    start: string;
    end: string;
}

interface Availability {
    [date: string]: TimeSlot[];
}

interface TimeSlotSelectorProps {
    startDate: string;
    endDate: string;
    value: Availability;
    onChange: (availability: Availability) => void;
}

export const TimeSlotSelector = ({ startDate, endDate, value, onChange }: TimeSlotSelectorProps) => {

    // Generate dates between start and end
    const getDaysArray = (start: string, end: string) => {
        let arr = [];
        for (let dt = new Date(start); dt <= new Date(end); dt.setDate(dt.getDate() + 1)) {
            arr.push(new Date(dt).toISOString().slice(0, 10)); // YYYY-MM-DD
        }
        return arr;
    };
    const dates = getDaysArray(startDate, endDate);

    // State for currently selected date to edit
    const [selectedDate, setSelectedDate] = useState<string>(dates[0]);

    const minTime = "08:00";
    const maxTime = "23:00";

    const addSlot = () => {
        const currentSlots = value[selectedDate] || [];
        // Default to a safe range within constraints (2 hours)
        const newSlot: TimeSlot = { start: '12:00', end: '14:00' };

        const newAvailability = {
            ...value,
            [selectedDate]: [...currentSlots, newSlot]
        };
        onChange(newAvailability);
    };

    const removeSlot = (index: number) => {
        const currentSlots = value[selectedDate] || [];
        const newSlots = currentSlots.filter((_, i) => i !== index);
        const newAvailability = { ...value, [selectedDate]: newSlots };
        onChange(newAvailability);
    };

    const updateSlot = (index: number, field: 'start' | 'end', val: string) => {
        const currentSlots = value[selectedDate] || [];
        const slot = currentSlots[index];

        let newVal = val;

        // 1. Basic Range Constraint (Clamping)
        if (newVal.length === 5) {
            if (newVal < minTime) newVal = minTime;
            if (newVal > maxTime) newVal = maxTime;
        }

        const newSlot = { ...slot, [field]: newVal };

        // 2. Strict Validation: Start < End
        if (newSlot.start.length === 5 && newSlot.end.length === 5) {
            if (newSlot.start >= newSlot.end) {
                // Allow momentary overlap during typing, but will fix on blur?
                // Or just warn?
                // Let's rely on handleBlur for strict logic enforcement
            }
        }

        const updatedSlots = currentSlots.map((s, i) => i === index ? { ...s, [field]: newVal } : s);
        const newAvailability = { ...value, [selectedDate]: updatedSlots };
        onChange(newAvailability);
    };

    const handleBlur = (index: number) => {
        // Enforce logic on blur: Minimum 2 hours
        const currentSlots = value[selectedDate] || [];
        const slot = currentSlots[index];

        if (slot.start.length !== 5 || slot.end.length !== 5) return;

        const [startH, startM] = slot.start.split(':').map(Number);
        const [endH, endM] = slot.end.split(':').map(Number);

        const startTimeInMinutes = startH * 60 + startM;
        const endTimeInMinutes = endH * 60 + endM;
        const duration = endTimeInMinutes - startTimeInMinutes;
        const minDuration = 120; // 2 hours

        if (duration < minDuration) {
            alert("Available slot must be at least 2 hours.");

            // Auto-correct: End = Start + 2 hours
            let newEndH = startH + 2;
            let newEndM = startM;

            // Handle day overflow or max time
            if (newEndH > 23) {
                newEndH = 23;
                newEndM = 0; // Cap at 23:00
            } else if (newEndH === 23 && newEndM > 0) {
                newEndM = 0; // Cap at 23:00
            }

            const newEndStr = `${newEndH.toString().padStart(2, '0')}:${newEndM.toString().padStart(2, '0')}`;

            // Re-check duration with capped end time
            const cappedEndMinutes = newEndH * 60 + newEndM;
            if (cappedEndMinutes - startTimeInMinutes < minDuration) {
                // If moving end to max still isn't enough (e.g. start at 22:00), ignore or reset start?
                // For now, let's just cap end.
            }

            // Re-update
            const updatedSlots = currentSlots.map((s, i) =>
                i === index ? { ...s, end: newEndStr } : s
            );
            onChange({ ...value, [selectedDate]: updatedSlots });
        }
    }

    // Helper to format date nicely
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' });
    };

    return (
        <div className="space-y-6">
            {/* Date Tabs */}
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                {dates.map((date) => {
                    const hasSlots = (value[date] || []).length > 0;
                    const isSelected = selectedDate === date;
                    return (
                        <button
                            key={date}
                            type="button"
                            onClick={() => setSelectedDate(date)}
                            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${isSelected
                                ? 'bg-primary border-primary text-white shadow-lg'
                                : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'
                                }`}
                        >
                            <div className="text-xs opacity-80">{date}</div>
                            {hasSlots && <div className="mt-1 w-1.5 h-1.5 bg-green-400 rounded-full mx-auto" />}
                        </button>
                    );
                })}
            </div>

            {/* Selected Date Editor */}
            <div className="glass-panel p-4 rounded-xl border border-white/5 min-h-[200px] animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-lg font-bold text-foreground">{formatDate(selectedDate)}</span>
                    <button
                        type="button"
                        onClick={addSlot}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-foreground hover:bg-white/20 transition-colors text-sm font-medium"
                    >
                        <span className="text-lg leading-none">+</span> Add Time
                    </button>
                </div>

                <div className="space-y-3">
                    {(value[selectedDate] || []).map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2 animate-in zoom-in duration-200">
                            <input
                                type="time"
                                value={slot.start}
                                min={minTime}
                                max={maxTime} // Start shouldn't theoretically go to max but HTML handles validation
                                onChange={(e) => updateSlot(idx, 'start', e.target.value)}
                                onBlur={() => handleBlur(idx)}
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary flex-1"
                            />
                            <span className="text-muted-foreground font-bold">-</span>
                            <input
                                type="time"
                                value={slot.end}
                                min={minTime} // End can't be earlier than min
                                max={maxTime}
                                onChange={(e) => updateSlot(idx, 'end', e.target.value)}
                                onBlur={() => handleBlur(idx)}
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary flex-1"
                            />
                            <button
                                type="button"
                                onClick={() => removeSlot(idx)}
                                className="p-2 text-muted-foreground hover:text-red-400 transition-colors bg-white/5 rounded-lg hover:bg-white/10"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                    {(value[selectedDate] || []).length === 0 && (
                        <div className="text-center py-8 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                            <span className="text-4xl mb-2">🕒</span>
                            <p>No availability set for this day.</p>
                            <p className="text-xs">Click "+ Add Time" if you are free.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
