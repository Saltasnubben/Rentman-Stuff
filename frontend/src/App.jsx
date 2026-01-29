import { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import CrewSelector from './components/CrewSelector';
import DateRangePicker from './components/DateRangePicker';
import Timeline from './components/Timeline';
import StatusBar from './components/StatusBar';
import ThemeSelector from './components/ThemeSelector';
import ViewToggle from './components/ViewToggle';
import { fetchCrew, fetchBookings } from './services/api';

function App() {
  const [crew, setCrew] = useState([]);
  const [selectedCrew, setSelectedCrew] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [viewMode, setViewMode] = useState('crew'); // 'crew' or 'project'
  const [showAppointments, setShowAppointments] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: startOfDay(new Date()),
    end: startOfDay(addDays(new Date(), 7))
  });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Load crew members on mount
  useEffect(() => {
    async function loadCrew() {
      try {
        setLoading(true);
        const response = await fetchCrew();
        setCrew(response.data);
        setAvailableTags(response.availableTags || []);
        setApiStatus('connected');
      } catch (err) {
        console.error('Failed to load crew:', err);
        setError('Kunde inte ladda crewmedlemmar. Kontrollera API-token.');
        setApiStatus('error');
      } finally {
        setLoading(false);
      }
    }
    loadCrew();
  }, []);

  // Load bookings when selection changes
  const loadBookings = useCallback(async () => {
    if (selectedCrew.length === 0) {
      setBookings([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetchBookings({
        crewIds: selectedCrew.map(c => c.id),
        startDate: dateRange.start,
        endDate: dateRange.end,
        includeAppointments: showAppointments
      });

      setBookings(response.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setError('Kunde inte ladda bokningar. Försök igen.');
    } finally {
      setLoading(false);
    }
  }, [selectedCrew, dateRange, showAppointments]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh || selectedCrew.length === 0) return;

    const interval = setInterval(() => {
      loadBookings();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadBookings, selectedCrew.length]);

  // Manual refresh handler
  const handleRefresh = () => {
    if (!loading) {
      loadBookings();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Rentman Booking Visualizer.</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Din livboj i personal-djungeln.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Refresh controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={loading || selectedCrew.length === 0}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Uppdatera data"
                >
                  <svg
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Uppdatera
                </button>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Auto (30s)</span>
                </label>
              </div>
              <ThemeSelector />
              <StatusBar status={apiStatus} loading={loading} />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Välj crewmedlemmar
              </label>
              <CrewSelector
                crew={crew}
                selected={selectedCrew}
                onChange={setSelectedCrew}
                loading={loading && crew.length === 0}
                availableTags={availableTags}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Välj tidsperiod (1-14 dagar)
              </label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                minDays={1}
                maxDays={14}
              />
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {selectedCrew.length === 0 && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Välj crewmedlemmar</h3>
            <p className="text-gray-500 dark:text-gray-400">Välj en eller flera crewmedlemmar för att se deras bokningar.</p>
          </div>
        )}

        {/* View toggle and Timeline */}
        {selectedCrew.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              {/* Appointments toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAppointments}
                  onChange={(e) => setShowAppointments(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Visa kalenderbokningar
                </span>
              </label>

              <ViewToggle view={viewMode} onChange={setViewMode} />
            </div>
            <Timeline
              crew={selectedCrew}
              bookings={bookings}
              dateRange={dateRange}
              loading={loading}
              viewMode={viewMode}
            />
          </>
        )}

        {/* Stats */}
        {selectedCrew.length > 0 && bookings.length > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCrew.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Valda crewmedlemmar</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {bookings.filter(b => b.type === 'project').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Projektbokningar</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {bookings.filter(b => b.type === 'appointment').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Kalenderbokningar</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {new Set(bookings.filter(b => b.projectId).map(b => b.projectId)).size}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Unika projekt</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24))}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Dagar</div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Rentman Booking Visualizer &middot; By Saltasnubben
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
