'use client'
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy redirect — the /vote route has been renamed to /availability.
 * LINE bot messages have been updated to use /availability directly.
 * This redirect handles any old /vote links still in LINE chat history.
 */
export default function VoteRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        // Preserve all query params (group_id, meeting_id, user_id)
        const search = window.location.search;
        router.replace(`/availability${search}`);
    }, [router]);

    return null;
}
