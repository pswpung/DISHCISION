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
    allAttendees?: any[];
}

const GoogleIcon = () => (
    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
    </svg>
);

export const TimeSlotSelector = ({ startDate, endDate, value, onChange, allAttendees }: TimeSlotSelectorProps) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const isLineBrowser = typeof navigator !== 'undefined' && /Line/i.test(navigator.userAgent);

    // Return null or fallback if dates are not defined yet
    if (!startDate || !endDate) return null;

    // Generate dates between start and end
    const getDaysArray = (start: string, end: string) => {
        let arr = [];
        try {
            for (let dt = new Date(start); dt <= new Date(end); dt.setDate(dt.getDate() + 1)) {
                arr.push(new Date(dt).toISOString().slice(0, 10)); // YYYY-MM-DD
            }
        } catch (e) {
            console.error("Invalid dates passed to getDaysArray", e);
        }
        return arr;
    };
    const dates = getDaysArray(startDate, endDate);

    // State for currently selected date to edit
    const [selectedDate, setSelectedDate] = useState<string>(dates[0] || '');

    const minTime = "08:00";
    const maxTime = "23:00";

    const addSlot = () => {
        const currentSlots = value[selectedDate] || [];
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

        if (newVal.length === 5) {
            if (newVal < minTime) newVal = minTime;
            if (newVal > maxTime) newVal = maxTime;
        }

        const updatedSlots = currentSlots.map((s, i) => i === index ? { ...s, [field]: newVal } : s);
        const newAvailability = { ...value, [selectedDate]: updatedSlots };
        onChange(newAvailability);
    };

    const handleBlur = (index: number) => {
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

            let newEndH = startH + 2;
            let newEndM = startM;

            if (newEndH > 23) {
                newEndH = 23;
                newEndM = 0;
            } else if (newEndH === 23 && newEndM > 0) {
                newEndM = 0;
            }

            const newEndStr = `${newEndH.toString().padStart(2, '0')}:${newEndM.toString().padStart(2, '0')}`;

            const updatedSlots = currentSlots.map((s, i) =>
                i === index ? { ...s, end: newEndStr } : s
            );
            onChange({ ...value, [selectedDate]: updatedSlots });
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' });
    };

    const formatTime = (d: Date) => {
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const fetchAndProcessCalendar = async (accessToken: string) => {
        try {
            const startISO = new Date(`${startDate}T00:00:00`).toISOString();
            const endISO = new Date(`${endDate}T23:59:59`).toISOString();
            
            const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
            url.searchParams.append('timeMin', startISO);
            url.searchParams.append('timeMax', endISO);
            url.searchParams.append('singleEvents', 'true');
            url.searchParams.append('orderBy', 'startTime');
            
            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP error ${response.status}`);
            }
            
            const data = await response.json();
            const events = data.items || [];
            
            const busyIntervalsByDay: { [day: string]: { start: Date; end: Date }[] } = {};
            dates.forEach(day => {
                busyIntervalsByDay[day] = [];
            });
            
            events.forEach((event: any) => {
                if (event.start?.date || !event.start?.dateTime) {
                    return;
                }
                
                if (event.status !== 'confirmed') {
                    return;
                }
                
                if (event.transparency === 'transparent') {
                    return;
                }
                
                if (event.attendees) {
                    const selfAttendee = event.attendees.find((att: any) => att.self);
                    if (selfAttendee && (selfAttendee.responseStatus === 'declined' || selfAttendee.responseStatus === 'tentative')) {
                        return;
                    }
                }
                
                const eventStart = new Date(event.start.dateTime);
                const eventEnd = new Date(event.end.dateTime);
                
                dates.forEach(day => {
                    const dayStart = new Date(`${day}T08:00:00`);
                    const dayEnd = new Date(`${day}T23:00:00`);
                    
                    if (eventStart < dayEnd && eventEnd > dayStart) {
                        const overlapStart = new Date(Math.max(dayStart.getTime(), eventStart.getTime()));
                        const overlapEnd = new Date(Math.min(dayEnd.getTime(), eventEnd.getTime()));
                        
                        if (overlapStart < overlapEnd) {
                            busyIntervalsByDay[day].push({ start: overlapStart, end: overlapEnd });
                        }
                    }
                });
            });
            
            const syncedAvailability: Availability = {};
            let totalSlotsAdded = 0;
            
            dates.forEach(day => {
                const dayStart = new Date(`${day}T08:00:00`);
                const dayEnd = new Date(`${day}T23:00:00`);
                const busyIntervals = busyIntervalsByDay[day];
                
                busyIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());
                
                const mergedBusy: { start: Date; end: Date }[] = [];
                busyIntervals.forEach(interval => {
                    if (mergedBusy.length === 0) {
                        mergedBusy.push(interval);
                    } else {
                        const last = mergedBusy[mergedBusy.length - 1];
                        if (interval.start.getTime() <= last.end.getTime()) {
                            last.end = new Date(Math.max(last.end.getTime(), interval.end.getTime()));
                        } else {
                            mergedBusy.push(interval);
                        }
                    }
                });
                
                const availableSlots: TimeSlot[] = [];
                let current = dayStart;
                
                mergedBusy.forEach(busy => {
                    if (busy.start.getTime() > current.getTime()) {
                        if (busy.start.getTime() - current.getTime() >= 2 * 60 * 60 * 1000) {
                            availableSlots.push({
                                start: formatTime(current),
                                end: formatTime(busy.start)
                            });
                        }
                    }
                    current = new Date(Math.max(current.getTime(), busy.end.getTime()));
                });
                
                if (dayEnd.getTime() > current.getTime()) {
                    if (dayEnd.getTime() - current.getTime() >= 2 * 60 * 60 * 1000) {
                        availableSlots.push({
                            start: formatTime(current),
                            end: formatTime(dayEnd)
                        });
                    }
                }
                
                // Merge the newly generated calendar slots with any existing manually added slots
                const manualSlots = value[day] || [];
                const availableIntervals: { start: Date; end: Date }[] = [];
                
                manualSlots.forEach(slot => {
                    if (slot.start && slot.end) {
                        availableIntervals.push({
                            start: new Date(`${day}T${slot.start}`),
                            end: new Date(`${day}T${slot.end}`)
                        });
                    }
                });
                
                availableSlots.forEach(slot => {
                    availableIntervals.push({
                        start: new Date(`${day}T${slot.start}`),
                        end: new Date(`${day}T${slot.end}`)
                    });
                });
                
                availableIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());
                
                const mergedAvailable: { start: Date; end: Date }[] = [];
                availableIntervals.forEach(interval => {
                    if (mergedAvailable.length === 0) {
                        mergedAvailable.push(interval);
                    } else {
                        const last = mergedAvailable[mergedAvailable.length - 1];
                        if (interval.start.getTime() <= last.end.getTime()) {
                            last.end = new Date(Math.max(last.end.getTime(), interval.end.getTime()));
                        } else {
                            mergedAvailable.push(interval);
                        }
                    }
                });
                
                const finalSlots = mergedAvailable.map(interval => ({
                    start: formatTime(interval.start),
                    end: formatTime(interval.end)
                }));
                
                syncedAvailability[day] = finalSlots;
                totalSlotsAdded += finalSlots.length;
            });
            
            onChange(syncedAvailability);
            setSyncStatus({ 
                type: 'success', 
                message: `Synced! Calendar free times combined with your manual entries (${totalSlotsAdded} slots total).` 
            });
        } catch (err: any) {
            console.error("Error fetching Google Calendar events:", err);
            setSyncStatus({ type: 'error', message: `Fetch failed: ${err.message || err}` });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSync = () => {
        if (typeof window === 'undefined') return;
        
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId || clientId === 'your-google-client-id.apps.googleusercontent.com') {
            alert("Google Client ID is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment variables.");
            return;
        }
        
        setIsSyncing(true);
        setSyncStatus(null);

        // Detect if we are on localhost
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isLocal) {
            if (!(window as any).google || !(window as any).google.accounts || !(window as any).google.accounts.oauth2) {
                alert("Google Identity Services is loading. Please try again in a few seconds.");
                setIsSyncing(false);
                return;
            }
            
            try {
                const client = (window as any).google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: 'https://www.googleapis.com/auth/calendar.readonly',
                    callback: async (response: any) => {
                        if (response.error) {
                            console.error("Google Auth error:", response);
                            setSyncStatus({ type: 'error', message: `Auth failed: ${response.error_description || response.error}` });
                            setIsSyncing(false);
                            return;
                        }
                        
                        const accessToken = response.access_token;
                        await fetchAndProcessCalendar(accessToken);
                    },
                    error_callback: (err: any) => {
                        console.error("GIS client error:", err);
                        setSyncStatus({ type: 'error', message: "Authorization popup was blocked or failed." });
                        setIsSyncing(false);
                    }
                });
                
                client.requestAccessToken();
            } catch (err: any) {
                console.error("Failed to initialize Google token client", err);
                setSyncStatus({ type: 'error', message: err.message || "Failed to start Google Sync." });
                setIsSyncing(false);
            }
        } else {
            // OAuth Proxy flow for Cloudflare Tunnels (trycloudflare.com)
            const proxyUrl = process.env.NEXT_PUBLIC_GOOGLE_AUTH_PROXY_URL;
            if (!proxyUrl || proxyUrl === 'https://your-username.github.io/dishcision-auth/') {
                alert("OAuth Proxy URL is not configured. Please set NEXT_PUBLIC_GOOGLE_AUTH_PROXY_URL in your environment variables to sync from tunnel domains.");
                setIsSyncing(false);
                return;
            }
            
            // Listen for message from the popup
            const handleAuthMessage = async (event: MessageEvent) => {
                // Verify the message comes from our configured proxy domain
                try {
                    const proxyOrigin = new URL(proxyUrl).origin;
                    if (event.origin !== proxyOrigin) return;
                } catch (e) {
                    return;
                }
                
                window.removeEventListener('message', handleAuthMessage);
                
                if (event.data.error) {
                    console.error("Proxy Auth error:", event.data.error);
                    setSyncStatus({ type: 'error', message: `Auth failed: ${event.data.error}` });
                    setIsSyncing(false);
                } else if (event.data.access_token) {
                    const accessToken = event.data.access_token;
                    await fetchAndProcessCalendar(accessToken);
                } else {
                    setIsSyncing(false);
                }
            };
            
            window.addEventListener('message', handleAuthMessage);
            
            // Open the auth proxy in a popup
            const origin = window.location.origin;
            const authUrl = `${proxyUrl}?origin=${encodeURIComponent(origin)}&client_id=${encodeURIComponent(clientId)}`;
            const width = 500;
            const height = 600;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            
            const popup = window.open(
                authUrl, 
                'GoogleAuthProxy', 
                `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
            );
            
            if (!popup) {
                alert("Popup blocker enabled. Please allow popups for this site to sync with Google Calendar.");
                window.removeEventListener('message', handleAuthMessage);
                setIsSyncing(false);
            }
        }
    };

    return (
        <div className="space-y-6 p-4">
            {/* Google Calendar Sync Panel
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">Sync your schedule</h3>
                    <p className="text-[11px] text-muted-foreground">Automatically pre-fill available slots by syncing with Google Calendar.</p>
                </div>
                <button
                    type="button"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className={`flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
                        isSyncing
                            ? 'bg-white/5 border-white/10 text-muted-foreground cursor-wait'
                            : 'bg-white text-black border-transparent hover:bg-white/90 shadow-md shadow-white/5'
                    }`}
                >
                    {isSyncing ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Syncing...
                        </>
                    ) : (
                        <>
                            <GoogleIcon />
                            Sync Calendar
                        </>
                    )}
                </button>
            </div>
            */}

            {/* isLineBrowser && (
                <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-400 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5">💡</span>
                        <div>
                            <p className="font-bold">Google blocks logins inside the LINE app.</p>
                            <p className="text-[11px] opacity-90 mt-0.5">Please tap the menu at the top-right and select <strong>"Open in browser"</strong> (or the Safari icon on iOS) to use Google Calendar sync.</p>
                        </div>
                    </div>
                </div>
            ) */}

            {/* syncStatus && (
                <div className={`p-3 rounded-xl border text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 ${
                    syncStatus.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                    <div className="flex items-center gap-2">
                        <span>{syncStatus.type === 'success' ? '✓' : '⚠️'}</span>
                        <span>{syncStatus.message}</span>
                    </div>
                </div>
            ) */}

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
                        <div key={idx} className="flex items-center gap-1.5 animate-in zoom-in duration-200 w-full">
                            <input
                                type="time"
                                value={slot.start}
                                min={minTime}
                                max={maxTime}
                                onChange={(e) => updateSlot(idx, 'start', e.target.value)}
                                onBlur={() => handleBlur(idx)}
                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-foreground focus:outline-none focus:border-primary flex-1 min-w-0 text-center text-sm"
                            />
                            <span className="text-muted-foreground font-bold shrink-0">-</span>
                            <input
                                type="time"
                                value={slot.end}
                                min={minTime}
                                max={maxTime}
                                onChange={(e) => updateSlot(idx, 'end', e.target.value)}
                                onBlur={() => handleBlur(idx)}
                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-foreground focus:outline-none focus:border-primary flex-1 min-w-0 text-center text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeSlot(idx)}
                                className="p-2 text-muted-foreground hover:text-red-400 transition-colors bg-white/5 rounded-lg hover:bg-white/10 shrink-0"
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

