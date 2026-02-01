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
export async function fetchCrewBookings(crewId, startDate, endDate, includeAppointments = true) {
  const params = {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
    includeAppointments: includeAppointments ? 'true' : 'false'
  };

  const response = await api.get(`/crew/${crewId}/bookings`, { params });
  return response.data;
}

/**
 * Fetch bookings for multiple crew members within a date range
 * Uses the efficient /api/bookings endpoint that fetches all in one call
 */
export async function fetchBookings({ crewIds, startDate, endDate, includeAppointments = true }) {
  if (!crewIds || crewIds.length === 0) {
    return { data: [], count: 0 };
  }

  const params = {
    crewIds: crewIds.join(','),
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
    includeAppointments: includeAppointments ? 'true' : 'false'
  };

  const response = await api.get('/bookings', { params });

  // Add crewId to each booking if not present
  const bookings = (response.data.data || []).map(booking => ({
    ...booking,
    type: booking.type || 'project'
  }));

  return {
    data: bookings,
    count: bookings.length
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
 * Fetch all vehicles
 */
export async function fetchVehicles() {
  const response = await api.get('/vehicles');
  return response.data;
}

/**
 * Fetch vehicle bookings
 */
export async function fetchVehicleBookings({ vehicleIds, startDate, endDate }) {
  if (!vehicleIds || vehicleIds.length === 0) {
    return { data: [], count: 0 };
  }

  const params = {
    vehicleIds: vehicleIds.join(','),
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
  };

  const response = await api.get('/vehicles/bookings', { params });
  return {
    data: response.data.data || [],
    count: response.data.count || 0
  };
}

/**
 * Fetch unfilled project functions (positions without assigned crew)
 */
export async function fetchUnfilled({ startDate, endDate, projectIds = [] }) {
  const params = {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
  };

  if (projectIds.length > 0) {
    params.projectIds = projectIds.join(',');
  }

  const response = await api.get('/unfilled', { params });
  return {
    data: response.data.data || [],
    count: response.data.count || 0
  };
}

/**
 * Check API health
 */
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data;
}

export default api;
