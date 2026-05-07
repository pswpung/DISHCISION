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

    getMeeting: async (meetingId: string) => {
        const response = await apiClient.get<MeetingResponse>(`/meetings/${meetingId}`);
        return response.data;
    },

    // Suggestion APIs
    getSuggestions: async (meetingId: string) => {
        const response = await apiClient.post(`/restaurant/suggest/${meetingId}`);
        return response.data;
    },

    searchRestaurants: async (keyword: string, price?: number | string) => {
        try {
            let url = `/restaurant/search?keyword=${encodeURIComponent(keyword)}`;
            if (price) {
                url += `&price=${price}`;
            }
            const response = await apiClient.get(url);
            return response.data;
        } catch (error) {
            return [];
        }
    }
};
