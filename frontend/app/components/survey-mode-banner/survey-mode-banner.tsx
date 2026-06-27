'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SurveyModeBanner() {
    const router = useRouter();
    const [returnTo, setReturnTo] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setReturnTo(params.get('return_to_survey'));
    }, []);

    if (!returnTo) return null;

    const handleReturn = () => {
        router.push(`/${returnTo}/feedback`);
    };

    return (
        <div className="sticky top-0 z-50 w-full bg-primary/10 backdrop-blur-md border-b border-primary/20 px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider truncate">
                    Survey Mode
                </span>
            </div>
            <button
                onClick={handleReturn}
                className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-[10px] font-black transition-all active:scale-95"
            >
                ← Back to Survey
            </button>
        </div>
    );
}
