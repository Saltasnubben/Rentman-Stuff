import { useMemo } from 'react';
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
  isWeekend
} from 'date-fns';
import { sv } from 'date-fns/locale';

function Timeline({ crew, bookings, dateRange, loading, viewMode = 'crew' }) {
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

  // Group bookings by project (for project view) with row assignments
  const bookingsByProject = useMemo(() => {
    const grouped = {};

    bookings.forEach(booking => {
      const projectKey = booking.projectId || booking.projectName;
      if (!grouped[projectKey]) {
        grouped[projectKey] = {
          projectId: booking.projectId,
          projectName: booking.projectName,
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
    // Check for confirmed status (case-insensitive) - treat null/undefined as confirmed
    const status = (booking.projectStatus || '').toLowerCase();
    const isConfirmed = isAppointment || !status || status === 'confirmed';

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
        {/* Crew name column */}
        <div className="w-56 flex-shrink-0 px-4 py-3 font-medium text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
          Crewmedlem
        </div>

        {/* Days */}
        <div className="flex-1 flex">
          {days.map((day, index) => {
            const weekend = isWeekend(day);
            return (
              <div
                key={day.toISOString()}
                className={`flex-1 px-2 py-3 text-center text-sm border-r border-gray-100 dark:border-gray-700 last:border-r-0 ${
                  weekend ? 'bg-red-50 dark:bg-red-900/20' : ''
                }`}
              >
                <div className={`font-medium ${weekend ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {format(day, 'd', { locale: sv })}
                </div>
                <div className={`text-xs ${weekend ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
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
          const rowHeight = Math.max(80, rowCount * 52 + 16);

          return (
            <div key={member.id} className="flex" style={{ minHeight: `${rowHeight}px` }}>
              {/* Crew name */}
              <div className="w-56 flex-shrink-0 px-4 py-3 border-r border-gray-200 dark:border-gray-700 flex items-start gap-2 bg-gray-50/50 dark:bg-gray-900/50">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: member.color || '#3b82f6' }}
                />
                <span className="font-medium text-gray-900 dark:text-white">
                  {member.name}
                </span>
              </div>

              {/* Bookings area */}
              <div className="flex-1 relative py-2 px-1">
                {/* Day grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {days.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`flex-1 border-r border-gray-50 dark:border-gray-700/50 last:border-r-0 ${
                        isWeekend(day) ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                      }`}
                    />
                  ))}
                </div>

                {/* Booking bars */}
                {memberBookings.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                    Inga bokningar
                  </div>
                ) : (
                  <div className="relative h-full">
                    {memberBookings.map((booking) => {
                      const isAppointment = booking.type === 'appointment';
                      return (
                        <div
                          key={booking.id}
                          className={`absolute rounded-md shadow-sm cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md group ${
                            isAppointment ? 'border-2 border-white/30' : ''
                          }`}
                          style={{
                            ...getBookingStyle(booking),
                            top: `${booking.rowIndex * 52 + 4}px`,
                            height: '48px'
                          }}
                          title={`${booking.projectName}\n${booking.role}\n${format(parseISO(booking.start), 'HH:mm')} - ${format(parseISO(booking.end), 'HH:mm')}`}
                        >
                          <div className="h-full px-3 py-1 flex items-center justify-between overflow-hidden">
                            <div className="flex flex-col justify-center min-w-0 flex-1">
                              <span className="text-white text-sm font-semibold truncate drop-shadow-sm">
                                {booking.projectName}
                              </span>
                              <span className="text-white/80 text-xs truncate drop-shadow-sm">
                                {booking.role !== booking.projectName ? booking.role : ''}
                                {format(parseISO(booking.start), 'HH:mm')} - {format(parseISO(booking.end), 'HH:mm')}
                              </span>
                            </div>
                            {isAppointment && <CalendarIcon />}
                          </div>

                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
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
      </div>
    </>
  );

  // Render project view (new view)
  const renderProjectView = () => (
    <>
      {/* Timeline header with days */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {/* Project name column */}
        <div className="w-56 flex-shrink-0 px-4 py-3 font-medium text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
          Projekt
        </div>

        {/* Days */}
        <div className="flex-1 flex">
          {days.map((day) => {
            const weekend = isWeekend(day);
            return (
              <div
                key={day.toISOString()}
                className={`flex-1 px-2 py-3 text-center text-sm border-r border-gray-100 dark:border-gray-700 last:border-r-0 ${
                  weekend ? 'bg-red-50 dark:bg-red-900/20' : ''
                }`}
              >
                <div className={`font-medium ${weekend ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {format(day, 'd', { locale: sv })}
                </div>
                <div className={`text-xs ${weekend ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
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
          const rowHeight = Math.max(80, project.rowCount * 52 + 16);

          return (
            <div key={project.projectId || project.projectName} className="flex" style={{ minHeight: `${rowHeight}px` }}>
              {/* Project name */}
              <div className="w-56 flex-shrink-0 px-4 py-3 border-r border-gray-200 dark:border-gray-700 flex items-start gap-2 bg-gray-50/50 dark:bg-gray-900/50">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1 bg-primary-500"
                />
                <span className="font-medium text-gray-900 dark:text-white">
                  {project.projectName}
                </span>
              </div>

              {/* Bookings area */}
              <div className="flex-1 relative py-2 px-1">
                {/* Day grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {days.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`flex-1 border-r border-gray-50 dark:border-gray-700/50 last:border-r-0 ${
                        isWeekend(day) ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                      }`}
                    />
                  ))}
                </div>

                {/* Booking bars - showing crew members */}
                <div className="relative h-full">
                  {projectBookings.map((booking) => {
                    const crewColor = getCrewColor(booking.crewId);
                    const isAppointment = booking.type === 'appointment';
                    return (
                      <div
                        key={booking.id}
                        className={`absolute rounded-md shadow-sm cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md group ${
                          isAppointment ? 'border-2 border-white/30' : ''
                        }`}
                        style={{
                          ...getBookingStyle(booking, crewColor),
                          top: `${booking.rowIndex * 52 + 4}px`,
                          height: '48px'
                        }}
                        title={`${getCrewName(booking.crewId)}\n${booking.role}\n${format(parseISO(booking.start), 'HH:mm')} - ${format(parseISO(booking.end), 'HH:mm')}`}
                      >
                        <div className="h-full px-3 py-1 flex items-center justify-between overflow-hidden">
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-white text-sm font-semibold truncate drop-shadow-sm">
                              {getCrewName(booking.crewId)}
                            </span>
                            <span className="text-white/80 text-xs truncate drop-shadow-sm">
                              {booking.role && booking.role !== booking.projectName ? `${booking.role} · ` : ''}
                              {format(parseISO(booking.start), 'HH:mm')} - {format(parseISO(booking.end), 'HH:mm')}
                            </span>
                          </div>
                          {isAppointment && <CalendarIcon />}
                        </div>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                            <div className="font-semibold text-sm flex items-center gap-2">
                              {getCrewName(booking.crewId)}
                              {isAppointment && <span className="text-xs text-gray-400">(Kalender)</span>}
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
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
