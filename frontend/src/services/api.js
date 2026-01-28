import axios from 'axios';
import { format } from 'date-fns';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 min timeout for slow API calls
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Fetch all crew members
 */
export async function fetchCrew() {
  const response = await api.get('/crew');
  return response.data;
}

/**
 * Fetch a single crew member
 */
export async function fetchCrewMember(id) {
  const response = await api.get(`/crew/${id}`);
  return response.data;
}

/**
 * Fetch bookings for a single crew member within a date range
 */
export async function fetchCrewBookings(crewId, startDate, endDate) {
  const params = {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd')
  };

  const response = await api.get(`/crew/${crewId}/bookings`, { params });
  return response.data;
}

/**
 * Fetch bookings for multiple crew members within a date range
 * Fetches each crew member's bookings in parallel
 */
export async function fetchBookings({ crewIds, startDate, endDate }) {
  if (!crewIds || crewIds.length === 0) {
    return { data: [], count: 0 };
  }

  // Fetch bookings for each crew member in parallel
  const promises = crewIds.map(crewId =>
    fetchCrewBookings(crewId, startDate, endDate)
      .then(result => ({
        crewId,
        bookings: result.data || []
      }))
      .catch(err => {
        console.warn(`Failed to fetch bookings for crew ${crewId}:`, err);
        return { crewId, bookings: [] };
      })
  );

  const results = await Promise.all(promises);

  // Combine all bookings and add crewId to each
  const allBookings = results.flatMap(({ crewId, bookings }) =>
    bookings.map(booking => ({ ...booking, crewId }))
  );

  return {
    data: allBookings,
    count: allBookings.length
  };
}

/**
 * Fetch projects within a date range
 */
export async function fetchProjects({ startDate, endDate }) {
  const params = {};

  if (startDate) {
    params.startDate = format(startDate, 'yyyy-MM-dd');
  }
  if (endDate) {
    params.endDate = format(endDate, 'yyyy-MM-dd');
  }

  const response = await api.get('/projects', { params });
  return response.data;
}

/**
 * Check API health
 */
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data;
}

export default api;
