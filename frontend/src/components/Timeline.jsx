import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  format,
  eachDayOfInterval,
  isWithinInterval,
  differenceInDays,
  differenceInHours,
  startOfDay,
  parseISO,
  max,
  min,
  isWeekend,
  addDays
} from 'date-fns';
import { sv } from 'date-fns/locale';

// Icon för projektbokningar (horisontell bar över tre vertikala staplar)
const ProjectIcon = ({ className = "" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    {/* Horisontell bar överst */}
    <rect x="2" y="2" width="16" height="3" rx="0.5" />
    {/* Tre vertikala staplar */}
    <rect x="3" y="7" width="3" height="11" rx="0.5" />
    <rect x="8.5" y="7" width="3" height="11" rx="0.5" />
    <rect x="14" y="7" width="3" height="11" rx="0.5" />
  </svg>
);

// Icon för kalenderbokningar
const CalendarIconSmall = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// Icon för otillsatta roller
const UnfilledIcon = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);

function Timeline({ crew, bookings, vehicles = [], vehicleBookings = [], dateRange, loading, viewMode = 'crew', onDateRangeChange }) {
  console.log('Timeline rendered, onDateRangeChange:', !!onDateRangeChange);
  
  // Drag-to-scroll state
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  // Get X position from mouse or touch event
  const getClientX = (e) => {
    if (e.touches && e.touches.length > 0) {
      return e.touches[0].clientX;
    }
    return e.clientX;
  };

  // Handle drag start (mouse)
  const handleMouseDown = useCallback((e) => {
    // Only handle left mouse button and only in the timeline area (not on booking bars)
    if (e.button !== 0) return;
    if (e.target.closest('[data-booking]')) return;
    
    console.log('Drag started at', e.clientX);
    setIsDragging(true);
    setDragStartX(e.clientX);
    setHasDragged(false);
    e.preventDefault();
  }, []);

  // Handle drag start (touch)
  const handleTouchStart = useCallback((e) => {
    if (e.target.closest('[data-booking]')) return;
    
    setIsDragging(true);
    setDragStartX(getClientX(e));
    setHasDragged(false);
  }, []);

  // Handle drag move
  const handleDragMove = useCallback((e) => {
    if (!isDragging || !onDateRangeChange) {
      console.log('Drag move skipped:', { isDragging, hasCallback: !!onDateRangeChange });
      return;
    }
    
    const clientX = getClientX(e);
    const deltaX = clientX - dragStartX;
    const containerWidth = containerRef.current?.offsetWidth || 800;
    const totalDays = differenceInDays(dateRange.end, dateRange.start) + 1;
    
    // Calculate how many days to shift (negative = move forward in time)
    const pixelsPerDay = (containerWidth - 224) / totalDays; // 224px = sidebar width
    const daysDelta = Math.round(-deltaX / pixelsPerDay);
    
    console.log('Drag move:', { deltaX, containerWidth, totalDays, pixelsPerDay, daysDelta });
    
    if (Math.abs(daysDelta) >= 1) {
      setHasDragged(true);
      const newStart = addDays(dateRange.start, daysDelta);
      const newEnd = addDays(dateRange.end, daysDelta);
      
      console.log('Updating date range:', { newStart, newEnd });
      onDateRangeChange({
        start: startOfDay(newStart),
        end: startOfDay(newEnd)
      });
      
      setDragStartX(clientX);
    }
  }, [isDragging, dragStartX, dateRange, onDateRangeChange]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      // Mouse events
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      // Touch events
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd);
      document.addEventListener('touchcancel', handleDragEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
        document.removeEventListener('touchcancel', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Generate days for the timeline header
  const days = useMemo(() => {
    return eachDayOfInterval({
      start: dateRange.start,
      end: dateRange.end
    });
  }, [dateRange]);

  const totalDays = days.length;

  // Check if two bookings overlap (same day)
  const bookingsOverlap = (a, b) => {
    const aStart = startOfDay(parseISO(a.start));
    const aEnd = startOfDay(parseISO(a.end));
    const bStart = startOfDay(parseISO(b.start));
    const bEnd = startOfDay(parseISO(b.end));

    // Overlap if one starts before the other ends and vice versa
    return aStart <= bEnd && bStart <= aEnd;
  };

  // Assign bookings to rows, packing them so non-overlapping bookings share rows
  const assignBookingsToRows = (bookingsList) => {
    const rows = []; // Each row is an array of bookings

    bookingsList.forEach(booking => {
      // Find a row where this booking doesn't overlap with any existing booking
      let placed = false;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const hasOverlap = row.some(existing => bookingsOverlap(existing, booking));
        if (!hasOverlap) {
          row.push(booking);
          placed = true;
          break;
        }
      }

      // If no suitable row found, create a new one
      if (!placed) {
        rows.push([booking]);
      }
    });

    // Return bookings with their assigned row index
    const result = [];
    rows.forEach((row, rowIndex) => {
      row.forEach(booking => {
        result.push({ ...booking, rowIndex });
      });
    });

    return { bookings: result, rowCount: rows.length };
  };

  // Group bookings by crew member with row assignments
  const bookingsByCrew = useMemo(() => {
    const grouped = {};

    crew.forEach(member => {
      const memberBookings = bookings.filter(b => b.crewId === member.id);
      grouped[member.id] = assignBookingsToRows(memberBookings);
    });

    return grouped;
  }, [crew, bookings]);

  // Group vehicle bookings by vehicle
  const bookingsByVehicle = useMemo(() => {
    const grouped = {};

    vehicles.forEach(vehicle => {
      const vBookings = vehicleBookings.filter(b => b.vehicleId === vehicle.id);
      grouped[vehicle.id] = assignBookingsToRows(vBookings);
    });

    return grouped;
  }, [vehicles, vehicleBookings]);

  // Group bookings by project (for project view) with row assignments
  const bookingsByProject = useMemo(() => {
    const grouped = {};

    bookings.forEach(booking => {
      const projectKey = booking.projectId || booking.projectName;
      if (!grouped[projectKey]) {
        grouped[projectKey] = {
          projectId: booking.projectId,
          projectName: booking.projectName,
          projectNumber: booking.projectNumber,
          accountManager: booking.accountManager,
          projectStatus: booking.projectStatus,
          statusId: booking.statusId,
          isAppointment: booking.type === 'appointment',
          isUnfilled: booking.type === 'unfilled',
          bookings: []
        };
      }
      grouped[projectKey].bookings.push(booking);
    });

    // Assign rows and sort projects by name
    return Object.values(grouped)
      .map(project => ({
        ...project,
        ...assignBookingsToRows(project.bookings)
      }))
      .sort((a, b) =>
        (a.projectName || '').localeCompare(b.projectName || '', 'sv')
      );
  }, [bookings]);

  // Get crew member name by ID
  const getCrewName = (crewId) => {
    const member = crew.find(c => c.id === crewId);
    return member ? member.name : 'Okänd';
  };

  // Get vehicle name by ID
  const getVehicleName = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? vehicle.name : 'Okänt fordon';
  };

  // Get crew member color by ID
  const getCrewColor = (crewId) => {
    const member = crew.find(c => c.id === crewId);
    return member?.color || '#3b82f6';
  };

  // Helper to lighten a color for appointments
  const lightenColor = (hex, percent = 30) => {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Lighten
    r = Math.min(255, r + (255 - r) * (percent / 100));
    g = Math.min(255, g + (255 - g) * (percent / 100));
    b = Math.min(255, b + (255 - b) * (percent / 100));

    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  };

  // Helper to create striped background for non-confirmed bookings
  const getStripedBackground = (baseColor) => {
    const lighterColor = lightenColor(baseColor, 30);
    return `repeating-linear-gradient(
      45deg,
      ${baseColor},
      ${baseColor} 8px,
      ${lighterColor} 8px,
      ${lighterColor} 16px
    )`;
  };

  // Helper to create dashed background for unfilled positions
  const getDashedBackground = (baseColor) => {
    return `repeating-linear-gradient(
      90deg,
      ${baseColor}40,
      ${baseColor}40 10px,
      ${baseColor}20 10px,
      ${baseColor}20 20px
    )`;
  };

  // Calculate position and width for a booking bar
  const getBookingStyle = (booking, color) => {
    const bookingStart = startOfDay(parseISO(booking.start));
    const bookingEnd = startOfDay(parseISO(booking.end));

    // Clamp to visible range
    const visibleStart = max([bookingStart, dateRange.start]);
    const visibleEnd = min([bookingEnd, dateRange.end]);

    const startOffset = differenceInDays(visibleStart, dateRange.start);
    const duration = differenceInDays(visibleEnd, visibleStart) + 1;

    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    const isAppointment = booking.type === 'appointment';
    const isUnfilled = booking.type === 'unfilled';
    const isVehicle = booking.type === 'vehicle';
    // Check for confirmed status (case-insensitive) - treat null/undefined as confirmed
    const status = (booking.projectStatus || '').toLowerCase();
    const isConfirmed = isAppointment || isUnfilled || isVehicle || !status || status === 'confirmed';

    // Debug: log status values (remove after testing)
    if (booking.projectStatus) {
      console.log('Project:', booking.projectName, 'Status:', booking.projectStatus);
    }

    // Use booking's own color if available, otherwise fall back to crew color
    let baseColor;
    if (booking.color) {
      // Rentman colors don't have # prefix
      baseColor = booking.color.startsWith('#') ? booking.color : `#${booking.color}`;
    } else {
      baseColor = color || booking.projectColor || '#3b82f6';
    }

    const finalColor = isAppointment ? lightenColor(baseColor, 20) : baseColor;

    // Use dashed background for unfilled positions
    // Transport = orange, Crew = red
    if (isUnfilled) {
      const isTransport = booking.isTransport || (booking.role && booking.role.toLowerCase().includes('transport'));
      const unfilledColor = isTransport ? '#f97316' : '#ef4444'; // Orange for transport, Red for crew
      return {
        left: `${Math.max(0, left)}%`,
        width: `${Math.min(100 - left, width)}%`,
        background: getDashedBackground(unfilledColor),
        border: `2px dashed ${unfilledColor}`,
      };
    }

    // Use striped background for non-confirmed projects
    if (!isConfirmed) {
      return {
        left: `${Math.max(0, left)}%`,
        width: `${Math.min(100 - left, width)}%`,
        background: getStripedBackground(finalColor)
      };
    }

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - left, width)}%`,
      backgroundColor: finalColor
    };
  };

  // Calendar icon component for appointments
  const CalendarIcon = () => (
    <svg className="w-4 h-4 text-white/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 dark:text-gray-400">Laddar bokningar...</span>
        </div>
      </div>
    );
  }

  // Render crew view (original view)
  const renderCrewView = () => (
    <>
      {/* Timeline header with days */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {/* Crew name column - sticky on mobile */}
        <div className="w-28 sm:w-40 lg:w-56 flex-shrink-0 px-2 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10">
          Crewmedlem
        </div>

        {/* Days - scrollable area */}
        <div className="flex-1 flex min-w-0 overflow-x-auto">
          {days.map((day, index) => {
            const weekend = isWeekend(day);
            return (
              <div
                key={day.toISOString()}
                className={`flex-1 min-w-[3rem] sm:min-w-[4rem] px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm border-r border-gray-100 dark:border-gray-700 last:border-r-0 ${
                  weekend ? 'bg-red-50 dark:bg-red-900/20' : ''
                }`}
              >
                <div className={`font-medium ${weekend ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {format(day, 'd', { locale: sv })}
                </div>
                <div className={`text-[10px] sm:text-xs ${weekend ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {format(day, 'EEE', { locale: sv })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {crew.map(member => {
          const { bookings: memberBookings, rowCount } = bookingsByCrew[member.id] || { bookings: [], rowCount: 0 };
          const rowHeight = Math.max(60, rowCount * 44 + 12);

          return (
            <div key={member.id} className="flex" style={{ minHeight: `${rowHeight}px` }}>
              {/* Crew name - sticky on mobile */}
              <div className="w-28 sm:w-40 lg:w-56 flex-shrink-0 px-2 sm:px-4 py-2 sm:py-3 border-r border-gray-200 dark:border-gray-700 flex items-start gap-1.5 sm:gap-2 bg-gray-50/50 dark:bg-gray-900/50 sticky left-0 z-10">
                <div
                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 mt-0.5 sm:mt-1"
                  style={{ backgroundColor: member.color || '#3b82f6' }}
                />
                <span className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                  {member.name}
                </span>
              </div>

              {/* Bookings area */}
              <div className="flex-1 relative py-1 sm:py-2 px-0.5 sm:px-1 min-w-0 overflow-x-auto">
                {/* Day grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {days.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`flex-1 min-w-[3rem] sm:min-w-[4rem] border-r border-gray-50 dark:border-gray-700/50 last:border-r-0 ${
                        isWeekend(day) ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                      }`}
                    />
                  ))}
                </div>

                {/* Booking bars */}
                {memberBookings.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs sm:text-sm text-gray-400 dark:text-gray-500">
                    Inga bokningar
                  </div>
                ) : (
                  <div className="relative h-full">
                    {memberBookings.map((booking) => {
                      const isAppointment = booking.type === 'appointment';
                      return (
                        <div
                          key={booking.id}
                          data-booking
                          className={`absolute rounded sm:rounded-md shadow-sm cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md group ${
                            isAppointment ? 'border sm:border-2 border-white/30' : ''
                          }`}
                          style={{
                            ...getBookingStyle(booking),
                            top: `${booking.rowIndex * 44 + 2}px`,
                            height: '40px'
                          }}
                          title={`${booking.projectName}\n${booking.role}\n${format(parseISO(booking.start), 'HH:mm')} - ${format(parseISO(booking.end), 'HH:mm')}`}
                        >
                          <div className="h-full px-1.5 sm:px-3 py-0.5 sm:py-1 flex items-center justify-between overflow-hidden">
                            <div className="flex flex-col justify-center min-w-0 flex-1">
                              <span className="text-white text-[10px] sm:text-sm font-semibold truncate drop-shadow-sm">
                                {booking.projectName}
                              </span>
                              <span className="text-white/80 text-[9px] sm:text-xs truncate drop-shadow-sm hidden sm:block">
                                {booking.role && booking.role !== booking.projectName ? `${booking.role} · ` : ''}
                                {format(parseISO(booking.start), 'HH:mm')} - {format(parseISO(booking.end), 'HH:mm')}
                              </span>
                            </div>
                            <span className="hidden sm:block">{isAppointment && <CalendarIcon />}</span>
                          </div>

                          {/* Tooltip - hidden on mobile (touch) */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden sm:block">
                            <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                              <div className="font-semibold text-sm flex items-center gap-2">
                                {booking.projectName}
                                {isAppointment && <span className="text-xs text-gray-400">(Kalender)</span>}
                              </div>
                              {booking.role && booking.role !== booking.projectName && (
                                <div className="text-gray-300">{booking.role}</div>
                              )}
                              <div className="text-gray-400 mt-1">
                                {format(parseISO(booking.start), 'd MMM HH:mm', { locale: sv })} -{' '}
                                {format(parseISO(booking.end), 'HH:mm', { locale: sv })}
                              </div>
                              {booking.remark && (
                                <div className="text-gray-400 mt-1 max-w-xs truncate">
                                  {booking.remark}
                                </div>
                              )}
                              <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Vehicle rows */}
        {vehicles.length > 0 && (
          <>
            {/* Vehicle section header */}
            <div className="flex bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-300 dark:border-blue-700">
              <div className="w-28 sm:w-40 lg:w-56 flex-shrink-0 px-2 sm:px-4 py-1.5 sm:py-2 border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-blue-50 dark:bg-blue-900/20 z-10">
                <span className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300">🚐 Fordon</span>
              </div>
              <div className="flex-1" />
            </div>

            {vehicles.map(vehicle => {
              const { bookings: vBookings, rowCount } = bookingsByVehicle[vehicle.id] || { bookings: [], rowCount: 0 };
              const rowHeight = Math.max(60, rowCount * 44 + 12);

              return (
                <div key={`vehicle-${vehicle.id}`} className="flex" style={{ minHeight: `${rowHeight}px` }}>
                  {/* Vehicle name - sticky on mobile */}
                  <div className="w-28 sm:w-40 lg:w-56 flex-shrink-0 px-2 sm:px-4 py-2 sm:py-3 border-r border-gray-200 dark:border-gray-700 flex items-start gap-1.5 sm:gap-2 bg-blue-50/30 dark:bg-blue-900/10 sticky left-0 z-10">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 mt-0.5 sm:mt-1 bg-blue-500" />
                    <span className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                      {vehicle.name}
                    </span>
                  </div>

                  {/* Bookings area */}
                  <div className="flex-1 relative py-1 sm:py-2 px-0.5 sm:px-1 min-w-0 overflow-x-auto">
                    {/* Day grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {days.map((day) => (
                        <div
                          key={day.toISOString()}
                          className={`flex-1 min-w-[3rem] sm:min-w-[4rem] border-r border-gray-50 dark:border-gray-700/50 last:border-r-0 ${
                            isWeekend(day) ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                          }`}
                        />
                      ))}
                    </div>

                    {/* Vehicle booking bars */}
                    {vBookings.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs sm:text-sm text-gray-400 dark:text-gray-500">
                        Inga bokningar
                      </div>
                    ) : (
                      <div className="relative h-full">
                        {vBookings.map((booking) => (
                          <div
                            key={booking.id}
                            data-booking
                            className="absolute rounded sm:rounded-md shadow-sm cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md group"
                            style={{
                              ...getBookingStyle(booking, '#3b82f6'),
                              top: `${booking.rowIndex * 44 + 2}px`,
                              height: '40px'
                            }}
                            title={`${booking.projectName}\n${format(parseISO(booking.start), 'HH:mm')} - ${format(parseISO(booking.end), 'HH:mm')}`}
                          >
                            <div className="h-full px-1.5 sm:px-3 py-0.5 sm:py-1 flex items-center justify-between overflow-hidden">
                              <div className="flex flex-col justify-center min-w-0 flex-1">
                                <span className="text-white text-[10px] sm:text-sm font-semibold truncate drop-shadow-sm">
                                  {booking.projectName}
                                </span>
                                <span className="text-white/80 text-[9px] sm:text-xs truncate drop-shadow-sm hidden sm:block">
                                  {format(parseISO(booking.start), 'HH:mm')} - {format(parseISO(booking.end), 'HH:mm')}
                                </span>
                              </div>
                            </div>

                            {/* Tooltip - hidden on mobile */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden sm:block">
                              <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                                <div className="font-semibold text-sm">{booking.projectName}</div>
                                <div className="text-gray-400 mt-1">
                                  {format(parseISO(booking.start), 'd MMM HH:mm', { locale: sv })} -{' '}
                                  {format(parseISO(booking.end), 'HH:mm', { locale: sv })}
                                </div>
                                {booking.remark && (
                                  <div className="text-gray-400 mt-1 max-w-xs truncate">{booking.remark}</div>
                                )}
                                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );

  // Render project view (new view)
  const renderProjectView = () => (
    <>
      {/* Timeline header with days */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {/* Project name column - sticky on mobile */}
        <div className="w-28 sm:w-40 lg:w-56 flex-shrink-0 px-2 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10">
          Projekt
        </div>

        {/* Days - scrollable area */}
        <div className="flex-1 flex min-w-0 overflow-x-auto">
          {days.map((day) => {
            const weekend = isWeekend(day);
            return (
              <div
                key={day.toISOString()}
                className={`flex-1 min-w-[3rem] sm:min-w-[4rem] px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm border-r border-gray-100 dark:border-gray-700 last:border-r-0 ${
                  weekend ? 'bg-red-50 dark:bg-red-900/20' : ''
                }`}
              >
                <div className={`font-medium ${weekend ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {format(day, 'd', { locale: sv })}
                </div>
                <div className={`text-[10px] sm:text-xs ${weekend ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {format(day, 'EEE', { locale: sv })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline rows - one per project */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {bookingsByProject.map(project => {
          const projectBookings = project.bookings;
          const rowHeight = Math.max(60, project.rowCount * 44 + 12);

          return (
            <div key={project.projectId || project.projectName} className="flex" style={{ minHeight: `${rowHeight}px` }}>
              {/* Project name - sticky on mobile */}
              <div className="w-28 sm:w-40 lg:w-56 flex-shrink-0 px-2 sm:px-4 py-2 sm:py-3 border-r border-gray-200 dark:border-gray-700 flex flex-col justify-center gap-0.5 bg-gray-50/50 dark:bg-gray-900/50 sticky left-0 z-10">
                <div className="flex items-start gap-1.5 sm:gap-2">
                  {/* Icon baserat på typ och status */}
                  {project.isUnfilled ? (
                    <UnfilledIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5 text-orange-500" />
                  ) : project.isAppointment ? (
                    <CalendarIconSmall className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                  ) : (
                    <ProjectIcon 
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5 ${
                        project.statusId === 3 || project.projectStatus === 'confirmed' 
                          ? 'text-green-500' 
                          : 'text-yellow-500'
                      }`} 
                    />
                  )}
                  <span className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                    {project.projectName}
                  </span>
                </div>
                {/* Projektnummer och Account Manager */}
                {(project.projectNumber || project.accountManager) && (
                  <div className="ml-5 sm:ml-6 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                    {project.projectNumber && <span>#{project.projectNumber}</span>}
                    {project.projectNumber && project.accountManager && <span> · </span>}
                    {project.accountManager && <span>AM: {project.accountManager}</span>}
                  </div>
                )}
              </div>

              {/* Bookings area */}
              <div className="flex-1 relative py-1 sm:py-2 px-0.5 sm:px-1 min-w-0 overflow-x-auto">
                {/* Day grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {days.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`flex-1 min-w-[3rem] sm:min-w-[4rem] border-r border-gray-50 dark:border-gray-700/50 last:border-r-0 ${
                        isWeekend(day) ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                      }`}
                    />
                  ))}
                </div>

                {/* Booking bars - showing crew members or vehicles */}
                <div className="relative h-full">
                  {projectBookings.map((booking) => {
                    const isVehicle = booking.type === 'vehicle';
                    const isAppointment = booking.type === 'appointment';
                    const displayName = isVehicle ? getVehicleName(booking.vehicleId) : getCrewName(booking.crewId);
                    const itemColor = isVehicle ? '#3b82f6' : getCrewColor(booking.crewId); // Blue for vehicles
                    return (
                      <div
                        key={booking.id}
                        data-booking
                        className={`absolute rounded sm:rounded-md shadow-sm cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md group ${
                          isAppointment ? 'border sm:border-2 border-white/30' : ''
                        }`}
                        style={{
                          ...getBookingStyle(booking, itemColor),
                          top: `${booking.rowIndex * 44 + 2}px`,
                          height: '40px'
                        }}
                        title={`${displayName}\n${booking.role}\n${format(parseISO(booking.start), 'HH:mm')} - ${format(parseISO(booking.end), 'HH:mm')}`}
                      >
                        <div className="h-full px-1.5 sm:px-3 py-0.5 sm:py-1 flex items-center justify-between overflow-hidden">
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-white text-[10px] sm:text-sm font-semibold truncate drop-shadow-sm">
                              {isVehicle ? `🚐 ${displayName}` : displayName}
                            </span>
                            <span className="text-white/80 text-[9px] sm:text-xs truncate drop-shadow-sm hidden sm:block">
                              {booking.role && booking.role !== booking.projectName ? `${booking.role} · ` : ''}
                              {format(parseISO(booking.start), 'HH:mm')} - {format(parseISO(booking.end), 'HH:mm')}
                            </span>
                          </div>
                          <span className="hidden sm:block">{isAppointment && <CalendarIcon />}</span>
                        </div>

                        {/* Tooltip - hidden on mobile */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden sm:block">
                          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                            <div className="font-semibold text-sm flex items-center gap-2">
                              {isVehicle ? `🚐 ${displayName}` : displayName}
                              {isAppointment && <span className="text-xs text-gray-400">(Kalender)</span>}
                              {isVehicle && <span className="text-xs text-gray-400">(Fordon)</span>}
                            </div>
                            {booking.role && (
                              <div className="text-gray-300">{booking.role}</div>
                            )}
                            <div className="text-gray-400 mt-1">
                              {format(parseISO(booking.start), 'd MMM HH:mm', { locale: sv })} -{' '}
                              {format(parseISO(booking.end), 'HH:mm', { locale: sv })}
                            </div>
                            {booking.remark && (
                              <div className="text-gray-400 mt-1 max-w-xs truncate">
                                {booking.remark}
                              </div>
                            )}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div 
      ref={containerRef}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto ${isDragging ? 'cursor-grabbing select-none' : onDateRangeChange ? 'cursor-grab' : ''}`}
      onMouseDown={onDateRangeChange ? handleMouseDown : undefined}
      onTouchStart={onDateRangeChange ? handleTouchStart : undefined}
    >
      {viewMode === 'crew' ? renderCrewView() : renderProjectView()}

      {/* Empty state */}
      {((viewMode === 'crew' && crew.length > 0) || (viewMode === 'project' && bookingsByProject.length === 0)) && bookings.length === 0 && (
        <div className="p-8 text-center border-t border-gray-100 dark:border-gray-700">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">Inga bokningar hittades för vald period.</p>
        </div>
      )}
    </div>
  );
}

export default Timeline;
