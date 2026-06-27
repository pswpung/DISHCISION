import axios from 'axios';

const API_BASE_URL = ''; // Relative path for Next.js rewrites

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
    },
});

export interface User {
    user_id: string;
    display_name: string;
    pictureurl?: string;
    group_id?: string;
}

export interface MeetingResponse {
    meeting_id: string;
    meeting_name: string;
    group_id: string;
    initial_data: any;
    suggestion_detail?: any;
}

export interface AttendeeCreate {
    meeting_id: string;
    user_id: string;
    group_id: string;
    is_key_person: boolean;
    is_joined: boolean;
}

export const apiService = {
    // Restaurant APIs
    getRestaurantConfig: async () => {
        const response = await apiClient.get('/restaurant/config');
        console.log("Fetch Restaurant Config:", response.data);
        return response.data;
    },

    // User APIs
    createUser: async (user: User) => {
        try {
            const response = await apiClient.post('/users', user);
            return response.data;
        } catch (error: any) {
            if (error.response && error.response.status === 400) {
                // User already exists, fetch instead or just ignore
                return null;
            }
            throw error;
        }
    },

    getUser: async (userId: string) => {
        try {
            const response = await apiClient.get(`/users/${userId}`);
            return response.data;
        } catch (error) {
            return null;
        }
    },

    getLastAttendeePreference: async (userId: string) => {
        try {
            const response = await apiClient.get(`/users/${userId}/last-preference`);
            return response.data;
        } catch (error) {
            return null;
        }
    },

    getUsersByGroup: async (groupId: string) => {
        try {
            const response = await apiClient.get(`/users/group/${groupId}`);
            return response.data;
        } catch (error) {
            return [];
        }
    },

    // Meeting APIs
    createMeeting: async (data: {
        meeting_name: string;
        group_id: string;
        initial_data: any;
    }) => {
        const response = await apiClient.post<MeetingResponse>('/meetings', data);
        return response.data;
    },

    // Attendee APIs
    addAttendee: async (attendee: Partial<AttendeeCreate> & { preference?: any, avaliable_at?: any }) => {
        const response = await apiClient.post('/attendee', attendee);
        return response.data;
    },

    getMeetingAttendees: async (meetingId: string) => {
        try {
            const response = await apiClient.get<any[]>(`/attendee/${meetingId}`);
            return response.data;
        } catch (error) {
            return [];
        }
    },

    updateAttendee: async (meetingId: string, userId: string, data: any) => {
        const response = await apiClient.patch(`/attendee/${meetingId}/${userId}`, data);
        return response.data;
    },

    // Meeting APIs Ext
    getMeetingsByGroup: async (groupId: string) => {
        try {
            const response = await apiClient.get<MeetingResponse[]>(`/meetings/group/${groupId}`);
            return response.data;
        } catch (error) {
            return [];
        }
    },

    getMeeting: async (meetingId: string, userId?: string) => {
        const url = userId ? `/meetings/${meetingId}?user_id=${userId}` : `/meetings/${meetingId}`;
        const response = await apiClient.get<MeetingResponse>(url);
        return response.data;
    },

    // Suggestion APIs
    getSuggestions: async (meetingId: string) => {
        const response = await apiClient.post(`/restaurant/suggest/${meetingId}`);
        return response.data;
    },

    searchRestaurants: async (keyword: string, price?: number | string, mode: string = "hybrid") => {
        try {
            let url = `/restaurant/search?keyword=${encodeURIComponent(keyword)}&mode=${mode}`;
            if (price) {
                url += `&price=${price}`;
            }
            const response = await apiClient.get(url);
            return response.data;
        } catch (error) {
            return [];
        }
    },

    searchLocation: async (query: string) => {
        try {
            const response = await apiClient.get(`/location/search?q=${encodeURIComponent(query)}`);
            return response.data;
        } catch (error) {
            console.error("Location search failed", error);
            return [];
        }
    },

    reverseGeocode: async (lat: number, lng: number) => {
        try {
            const response = await apiClient.get(`/location/reverse?lat=${lat}&lng=${lng}`);
            return response.data;
        } catch (error) {
            console.error("Reverse geocode failed", error);
            return null;
        }
    },

    voteTimeSlot: async (meetingId: string, userId: string, slotKey: string) => {
        const response = await apiClient.post(`/meetings/${meetingId}/vote-time`, { user_id: userId, slot_key: slotKey });
        return response.data;
    },

    toggleTailIn: async (meetingId: string, userId: string, restaurantName: string) => {
        const response = await apiClient.post(`/meetings/${meetingId}/tail-in`, { user_id: userId, restaurant_name: restaurantName });
        return response.data;
    },

    toggleTailOut: async (meetingId: string, userId: string, restaurantName: string) => {
        const response = await apiClient.post(`/meetings/${meetingId}/tail-out`, { user_id: userId, restaurant_name: restaurantName });
        return response.data;
    },

    toggleReady: async (meetingId: string, userId: string) => {
        const response = await apiClient.post(`/meetings/${meetingId}/toggle-ready`, { user_id: userId });
        return response.data;
    },

    setDecisionMethod: async (meetingId: string, targetType: string, method: string) => {
        const response = await apiClient.post(`/meetings/${meetingId}/set-decision-method`, { target_type: targetType, method: method });
        return response.data;
    },

    saveSpinResult: async (meetingId: string, targetType: string, landedKey: string, stopAngle: number, selectedKeys: string[]) => {
        const response = await apiClient.post(`/meetings/${meetingId}/spin-wheel`, {
            target_type: targetType,
            landed_key: landedKey,
            stop_angle: stopAngle,
            selected_keys: selectedKeys
        });
        return response.data;
    },

    selectWheelRestaurants: async (meetingId: string, restaurantNames: string[]) => {
        const response = await apiClient.post(`/meetings/${meetingId}/select-wheel-restaurants`, { restaurant_names: restaurantNames });
        return response.data;
    },

    selectWheelTimeSlots: async (meetingId: string, slotKeys: string[]) => {
        const response = await apiClient.post(`/meetings/${meetingId}/select-wheel-time-slots`, { slot_keys: slotKeys });
        return response.data;
    },

    toggleExcludeVetoed: async (meetingId: string, userId: string) => {
        const response = await apiClient.post(`/meetings/${meetingId}/toggle-exclude-vetoed`, { user_id: userId });
        return response.data;
    },

    confirmFinalMeetingPlan: async (meetingId: string, confirmedTimeSlot: string, confirmedRestaurant: string) => {
        const response = await apiClient.post(`/meetings/${meetingId}/confirm-final`, {
            confirmed_time: confirmedTimeSlot,
            confirmed_restaurant: confirmedRestaurant
        });
        return response.data;
    },

    submitFeedback: async (meetingId: string, userId: string | null, responses: Record<string, any>) => {
        const response = await apiClient.post(`/meetings/${meetingId}/feedback`, {
            user_id: userId,
            responses
        });
        return response.data;
    },

    checkFeedback: async (meetingId: string, userId: string) => {
        try {
            const response = await apiClient.get(`/meetings/${meetingId}/feedback/${userId}`);
            return response.data;
        } catch (error) {
            return null;
        }
    }
};
