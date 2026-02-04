import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  format,
  eachDayOfInterval,
  differenceInDays,
  startOfDay,
  parseISO,
  max,
  min,
  isWeekend,
  addDays,
  areIntervalsOverlapping
} from 'date-fns';
import { sv } from 'date-fns/locale';
import BookingDetailModal from './BookingDetailModal';
import ConflictBadge from './ConflictBadge';

// Icon för projektbokningar
const ProjectIcon = ({ className = "" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <rect x="2" y="2" width="16" height="3" rx="0.5" />
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

// Calendar icon for appointments
const CalendarIcon = () => (
  <svg className="w-4 h-4 text-white/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

function Timeline({ crew, bookings, vehicles = [], vehicleBookings = [], dateRange, loading, viewMode = 'crew', onDateRangeChange }) {
  // Refs
  const timelineRef = useRef(null);
  const namesRef = useRef(null);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragDeltaX, setDragDeltaX] = useState(0);

  // Modal state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedCrewName, setSelectedCrewName] = useState(null);

  // Sync vertical scroll between names and timeline
  const handleTimelineScroll = useCallback((e) => {
    if (namesRef.current) {
      namesRef.current.scrollTop = e.target.scrollTop;
    }
  }, []);

  // Get X position from mouse or touch event
  const getClientX = (e) => {
    if (e.touches && e.touches.length > 0) {
      return e.touches[0].clientX;
    }
    return e.clientX;
  };

  // Handle drag start
  const handleDragStart = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('[data-booking]')) return;
    
    setIsDragging(true);
    setDragStartX(getClientX(e));
    setDragDeltaX(0);
    if (e.preventDefault) e.preventDefault();
  }, []);

  // Handle drag move
  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    const clientX = getClientX(e);
    const deltaX = clientX - dragStartX;
    setDragDeltaX(deltaX);
  }, [isDragging, dragStartX]);

  // Calculate days from pixels
  const getDaysFromPixels = useCallback((pixels) => {
    const timelineWidth = timelineRef.current?.offsetWidth || 600;
    const totalDays = differenceInDays(dateRange.end, dateRange.start) + 1;
    const pixelsPerDay = timelineWidth / totalDays;
    return Math.round(-pixels / pixelsPerDay);
  }, [dateRange]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (isDragging && dragDeltaX !== 0 && onDateRangeChange) {
      const daysDelta = getDaysFromPixels(dragDeltaX);
      if (daysDelta !== 0) {
        const newStart = addDays(dateRange.start, daysDelta);
        const newEnd = addDays(dateRange.end, daysDelta);
        onDateRangeChange({
          start: startOfDay(newStart),
          end: startOfDay(newEnd)
        });
      }
    }
    setIsDragging(false);
    setDragDeltaX(0);
  }, [isDragging, dragDeltaX, dateRange, onDateRangeChange, getDaysFromPixels]);

  // Global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      const onMove = (e) => handleDragMove(e);
      const onEnd = () => handleDragEnd();
      
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
      
      return () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Calculate drag offset in days
  const dragDaysOffset = isDragging ? getDaysFromPixels(dragDeltaX) : 0;

  // Generate days - show preview dates during drag
  const days = useMemo(() => {
    if (isDragging && dragDaysOffset !== 0) {
      const previewStart = addDays(dateRange.start, dragDaysOffset);
      const previewEnd = addDays(dateRange.end, dragDaysOffset);
      return eachDayOfInterval({ start: previewStart, end: previewEnd });
    }
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange, isDragging, dragDaysOffset]);

  const totalDays = days.length;

  // Booking overlap check
  const bookingsOverlap = (a, b) => {
    const aStart = startOfDay(parseISO(a.start));
    const aEnd = startOfDay(parseISO(a.end));
    const bStart = startOfDay(parseISO(b.start));
    const bEnd = startOfDay(parseISO(b.end));
    return aStart <= bEnd && bStart <= aEnd;
  };

  // Assign bookings to rows
  const assignBookingsToRows = (bookingsList) => {
    const rows = [];
    bookingsList.forEach(booking => {
      let placed = false;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (!row.some(existing => bookingsOverlap(existing, booking))) {
          row.push(booking);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push([booking]);
    });
    
    const result = [];
    rows.forEach((row, rowIndex) => {
      row.forEach(booking => result.push({ ...booking, rowIndex }));
    });
    return { bookings: result, rowCount: rows.length };
  };

  // Group bookings by crew
  const bookingsByCrew = useMemo(() => {
    const grouped = {};
    crew.forEach(member => {
      const memberBookings = bookings.filter(b => b.crewId === member.id);
      grouped[member.id] = assignBookingsToRows(memberBookings);
    });
    return grouped;
  }, [crew, bookings]);

  // Detect conflicts (overlapping bookings) per crew member
  const conflictsByCrew = useMemo(() => {
    const conflicts = {};
    crew.forEach(member => {
      const memberBookings = bookings.filter(b => b.crewId === member.id && b.type === 'project');
      let conflictCount = 0;
      
      for (let i = 0; i < memberBookings.length; i++) {
        for (let j = i + 1; j < memberBookings.length; j++) {
          const a = memberBookings[i];
          const b = memberBookings[j];
          try {
            const overlaps = areIntervalsOverlapping(
              { start: parseISO(a.start), end: parseISO(a.end) },
              { start: parseISO(b.start), end: parseISO(b.end) }
            );
            if (overlaps) conflictCount++;
          } catch (e) {
            // Invalid date, skip
          }
        }
      }
      conflicts[member.id] = conflictCount;
    });
    return conflicts;
  }, [crew, bookings]);

  // Group bookings by vehicle
  const bookingsByVehicle = useMemo(() => {
    const grouped = {};
    vehicles.forEach(vehicle => {
      const vBookings = vehicleBookings.filter(b => b.vehicleId === vehicle.id);
      grouped[vehicle.id] = assignBookingsToRows(vBookings);
    });
    return grouped;
  }, [vehicles, vehicleBookings]);

  // Group bookings by project
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
    return Object.values(grouped)
      .map(project => ({ ...project, ...assignBookingsToRows(project.bookings) }))
      .sort((a, b) => (a.projectName || '').localeCompare(b.projectName || '', 'sv'));
  }, [bookings]);

  // Helper functions
  const getCrewName = (crewId) => crew.find(c => c.id === crewId)?.name || 'Okänd';
  const getVehicleName = (vehicleId) => vehicles.find(v => v.id === vehicleId)?.name || 'Okänt fordon';
  const getCrewColor = (crewId) => crew.find(c => c.id === crewId)?.color || '#3b82f6';

  const lightenColor = (hex, percent = 30) => {
    hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = Math.min(255, r + (255 - r) * (percent / 100));
    g = Math.min(255, g + (255 - g) * (percent / 100));
    b = Math.min(255, b + (255 - b) * (percent / 100));
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  };

  const getStripedBackground = (baseColor) => {
    const lighterColor = lightenColor(baseColor, 30);
    return `repeating-linear-gradient(45deg, ${baseColor}, ${baseColor} 8px, ${lighterColor} 8px, ${lighterColor} 16px)`;
  };

  const getDashedBackground = (baseColor) => {
    return `repeating-linear-gradient(90deg, ${baseColor}40, ${baseColor}40 10px, ${baseColor}20 10px, ${baseColor}20 20px)`;
  };

  // Calculate booking style - use original dateRange for positioning
  const getBookingStyle = (booking, color) => {
    const bookingStart = startOfDay(parseISO(booking.start));
    const bookingEnd = startOfDay(parseISO(booking.end));
    const visibleStart = max([bookingStart, dateRange.start]);
    const visibleEnd = min([bookingEnd, dateRange.end]);
    const startOffset = differenceInDays(visibleStart, dateRange.start);
    const duration = differenceInDays(visibleEnd, visibleStart) + 1;
    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    const isAppointment = booking.type === 'appointment';
    const isUnfilled = booking.type === 'unfilled';
    const isVehicle = booking.type === 'vehicle';
    const status = (booking.projectStatus || '').toLowerCase();
    const isConfirmed = isAppointment || isUnfilled || isVehicle || !status || status === 'confirmed';

    let baseColor;
    if (booking.color) {
      baseColor = booking.color.startsWith('#') ? booking.color : `#${booking.color}`;
    } else {
      baseColor = color || booking.projectColor || '#3b82f6';
    }

    const finalColor = isAppointment ? lightenColor(baseColor, 20) : baseColor;

    if (isUnfilled) {
      const isTransport = booking.isTransport || (booking.role && booking.role.toLowerCase().includes('transport'));
      const unfilledColor = isTransport ? '#f97316' : '#ef4444';
      return {
        left: `${Math.max(0, left)}%`,
        width: `${Math.min(100 - left, width)}%`,
        background: getDashedBackground(unfilledColor),
        border: `2px dashed ${unfilledColor}`,
      };
    }

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

  // Calculate row heights for crew view
  const crewRowHeights = useMemo(() => {
    return crew.map(member => {
      const { rowCount } = bookingsByCrew[member.id] || { rowCount: 0 };
      return Math.max(60, rowCount * 44 + 12);
    });
  }, [crew, bookingsByCrew]);

  // Calculate row heights for vehicles
  const vehicleRowHeights = useMemo(() => {
    return vehicles.map(vehicle => {
      const { rowCount } = bookingsByVehicle[vehicle.id] || { rowCount: 0 };
      return Math.max(60, rowCount * 44 + 12);
    });
  }, [vehicles, bookingsByVehicle]);

  // Calculate row heights for project view
  const projectRowHeights = useMemo(() => {
    return bookingsByProject.map(project => Math.max(60, project.rowCount * 44 + 12));
  }, [bookingsByProject]);

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

  // Handle booking click
  const handleBookingClick = (booking, crewName = null) => {
    setSelectedBooking(booking);
    setSelectedCrewName(crewName || getCrewName(booking.crewId));
  };

  // Booking bar component
  const BookingBar = ({ booking, color, showCrewName = false }) => {
    const isAppointment = booking.type === 'appointment';
    const isVehicle = booking.type === 'vehicle';
    const isUnfilled = booking.type === 'unfilled';
    const isTransport = isUnfilled && (booking.isTransport || (booking.role && booking.role.toLowerCase().includes('transport')));
    
    let displayName;
    let crewNameForModal;
    if (showCrewName) {
      if (isUnfilled) {
        displayName = isTransport ? 'Behöver transport' : 'Behöver personal';
        crewNameForModal = displayName;
      } else if (isVehicle) {
        displayName = getVehicleName(booking.vehicleId);
        crewNameForModal = displayName;
      } else {
        displayName = getCrewName(booking.crewId);
        crewNameForModal = displayName;
      }
    } else {
      displayName = booking.projectName;
      crewNameForModal = getCrewName(booking.crewId);
    }

    return (
      <div
        data-booking
        onClick={() => handleBookingClick(booking, crewNameForModal)}
        className={`absolute rounded sm:rounded-md shadow-sm cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md group ${
          isAppointment ? 'border sm:border-2 border-white/30' : ''
        }`}
        style={{
          ...getBookingStyle(booking, color),
          top: `${booking.rowIndex * 44 + 2}px`,
          height: '40px'
        }}
      >
        <div className="h-full px-1.5 sm:px-3 py-0.5 sm:py-1 flex items-center justify-between overflow-hidden">
          <div className="flex flex-col justify-center min-w-0 flex-1">
            <span className="text-white text-[10px] sm:text-sm font-semibold truncate drop-shadow-sm">
              {isVehicle && showCrewName ? `🚐 ${displayName}` : displayName}
            </span>
            <span className="text-white/80 text-[9px] sm:text-xs truncate drop-shadow-sm hidden sm:block">
              {booking.role && booking.role !== booking.projectName ? `${booking.role} · ` : ''}
              {format(parseISO(booking.start), 'HH:mm')} - {format(parseISO(booking.end), 'HH:mm')}
            </span>
          </div>
          <span className="hidden sm:block">{isAppointment && <CalendarIcon />}</span>
        </div>

        {/* Enhanced Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 hidden sm:block">
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-xs">
            <div className="font-semibold text-sm">{booking.projectName || displayName}</div>
            {booking.role && booking.role !== booking.projectName && (
              <div className="text-gray-300">{booking.role}</div>
            )}
            {booking.customer && (
              <div className="text-gray-400 flex items-center gap-1 mt-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {booking.customer}
              </div>
            )}
            {booking.location && (
              <div className="text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {booking.location}
              </div>
            )}
            <div className="text-gray-400 mt-1">
              {format(parseISO(booking.start), 'd MMM HH:mm', { locale: sv })} - {format(parseISO(booking.end), 'HH:mm', { locale: sv })}
            </div>
            <div className="text-primary-400 text-[10px] mt-1">Klicka för detaljer</div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
          </div>
        </div>
      </div>
    );
  };

  // Day header component
  const DayHeader = () => (
    <div className={`flex border-b border-gray-200 dark:border-gray-700 transition-colors ${isDragging && dragDaysOffset !== 0 ? 'bg-primary-50 dark:bg-primary-900/30' : 'bg-gray-50 dark:bg-gray-900'}`}>
      {days.map((day) => {
        const weekend = isWeekend(day);
        return (
          <div
            key={day.toISOString()}
            className={`flex-1 min-w-[3rem] sm:min-w-[4rem] px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm border-r border-gray-100 dark:border-gray-700 last:border-r-0 ${
              weekend ? 'bg-red-50 dark:bg-red-900/20' : ''
            }`}
          >
            <div className={`font-medium ${weekend ? 'text-red-600 dark:text-red-400' : isDragging && dragDaysOffset !== 0 ? 'text-primary-600 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
              {format(day, 'd', { locale: sv })}
            </div>
            <div className={`text-[10px] sm:text-xs ${weekend ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {format(day, 'EEE', { locale: sv })}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Day grid for booking rows
  const DayGrid = () => (
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
  );

  // Crew view
  const renderCrewView = () => (
    <div className="flex">
      {/* Left: Names column (fixed) */}
      <div className="w-28 sm:w-40 lg:w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="h-[52px] px-2 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 flex items-center">
          Crewmedlem
        </div>
        
        <div ref={namesRef} className="overflow-hidden" style={{ maxHeight: 'calc(70vh - 52px)' }}>
          {crew.map((member, i) => (
            <div
              key={member.id}
              className="px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-100 dark:border-gray-700 flex items-start gap-1.5 sm:gap-2 bg-gray-50/50 dark:bg-gray-900/50"
              style={{ height: `${crewRowHeights[i]}px` }}
            >
              <div
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 mt-0.5 sm:mt-1"
                style={{ backgroundColor: member.color || '#3b82f6' }}
              />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white truncate block">
                  {member.name}
                </span>
                {conflictsByCrew[member.id] > 0 && (
                  <ConflictBadge count={conflictsByCrew[member.id]} />
                )}
              </div>
            </div>
          ))}
          
          {vehicles.length > 0 && (
            <>
              <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-50 dark:bg-blue-900/20 border-t-2 border-b border-blue-300 dark:border-blue-700">
                <span className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300">🚐 Fordon</span>
              </div>
              {vehicles.map((vehicle, i) => (
                <div
                  key={`vehicle-${vehicle.id}`}
                  className="px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-100 dark:border-gray-700 flex items-start gap-1.5 sm:gap-2 bg-blue-50/30 dark:bg-blue-900/10"
                  style={{ height: `${vehicleRowHeights[i]}px` }}
                >
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 mt-0.5 sm:mt-1 bg-blue-500" />
                  <span className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                    {vehicle.name}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Right: Timeline (draggable) */}
      <div 
        ref={timelineRef}
        className={`flex-1 overflow-hidden ${isDragging ? 'cursor-grabbing' : onDateRangeChange ? 'cursor-grab' : ''}`}
        onMouseDown={onDateRangeChange ? handleDragStart : undefined}
        onTouchStart={onDateRangeChange ? handleDragStart : undefined}
      >
        <DayHeader />
        
        <div onScroll={handleTimelineScroll} className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 52px)' }}>
          {crew.map((member, i) => {
            const { bookings: memberBookings } = bookingsByCrew[member.id] || { bookings: [] };
            return (
              <div
                key={member.id}
                className="relative border-b border-gray-100 dark:border-gray-700"
                style={{ height: `${crewRowHeights[i]}px` }}
              >
                <DayGrid />
                {memberBookings.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs sm:text-sm text-gray-400 dark:text-gray-500">
                    Inga bokningar
                  </div>
                ) : (
                  memberBookings.map((booking) => (
                    <BookingBar key={booking.id} booking={booking} />
                  ))
                )}
              </div>
            );
          })}
          
          {vehicles.length > 0 && (
            <>
              <div className="h-[36px] bg-blue-50 dark:bg-blue-900/20 border-t-2 border-b border-blue-300 dark:border-blue-700" />
              {vehicles.map((vehicle, i) => {
                const { bookings: vBookings } = bookingsByVehicle[vehicle.id] || { bookings: [] };
                return (
                  <div
                    key={`vehicle-${vehicle.id}`}
                    className="relative border-b border-gray-100 dark:border-gray-700"
                    style={{ height: `${vehicleRowHeights[i]}px` }}
                  >
                    <DayGrid />
                    {vBookings.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs sm:text-sm text-gray-400 dark:text-gray-500">
                        Inga bokningar
                      </div>
                    ) : (
                      vBookings.map((booking) => (
                        <BookingBar key={booking.id} booking={booking} color="#3b82f6" />
                      ))
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Project view
  const renderProjectView = () => (
    <div className="flex">
      {/* Left: Project names (fixed) */}
      <div className="w-28 sm:w-40 lg:w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="h-[52px] px-2 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 flex items-center">
          Projekt
        </div>
        
        <div ref={namesRef} className="overflow-hidden" style={{ maxHeight: 'calc(70vh - 52px)' }}>
          {bookingsByProject.map((project, i) => (
            <div
              key={project.projectId || project.projectName}
              className="px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-100 dark:border-gray-700 flex flex-col justify-center gap-0.5 bg-gray-50/50 dark:bg-gray-900/50"
              style={{ height: `${projectRowHeights[i]}px` }}
            >
              <div className="flex items-start gap-1.5 sm:gap-2">
                {project.isUnfilled ? (
                  <UnfilledIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5 text-orange-500" />
                ) : project.isAppointment ? (
                  <CalendarIconSmall className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5 text-gray-400" />
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
              {(project.projectNumber || project.accountManager) && (
                <div className="ml-5 sm:ml-6 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                  {project.projectNumber && <span>#{project.projectNumber}</span>}
                  {project.projectNumber && project.accountManager && <span> · </span>}
                  {project.accountManager && <span>AM: {project.accountManager}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Timeline (draggable) */}
      <div 
        ref={timelineRef}
        className={`flex-1 overflow-hidden ${isDragging ? 'cursor-grabbing' : onDateRangeChange ? 'cursor-grab' : ''}`}
        onMouseDown={onDateRangeChange ? handleDragStart : undefined}
        onTouchStart={onDateRangeChange ? handleDragStart : undefined}
      >
        <DayHeader />
        
        <div onScroll={handleTimelineScroll} className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 52px)' }}>
          {bookingsByProject.map((project, i) => (
            <div
              key={project.projectId || project.projectName}
              className="relative border-b border-gray-100 dark:border-gray-700"
              style={{ height: `${projectRowHeights[i]}px` }}
            >
              <DayGrid />
              {project.bookings.map((booking) => {
                const isVehicle = booking.type === 'vehicle';
                const itemColor = isVehicle ? '#3b82f6' : getCrewColor(booking.crewId);
                return (
                  <BookingBar 
                    key={booking.id} 
                    booking={booking} 
                    color={itemColor}
                    showCrewName={true}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative select-none">
      {/* Drag indicator */}
      {isDragging && Math.abs(dragDaysOffset) >= 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-primary-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
            <span>{dragDaysOffset > 0 ? '→' : '←'}</span>
            <span>{Math.abs(dragDaysOffset)} {Math.abs(dragDaysOffset) === 1 ? 'dag' : 'dagar'}</span>
          </div>
        </div>
      )}
      
      {viewMode === 'crew' ? renderCrewView() : renderProjectView()}

      {/* Empty state */}
      {bookings.length === 0 && (
        <div className="p-8 text-center border-t border-gray-100 dark:border-gray-700">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">Inga bokningar hittades för vald period.</p>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          crewName={selectedCrewName}
          onClose={() => {
            setSelectedBooking(null);
            setSelectedCrewName(null);
          }}
        />
      )}
    </div>
  );
}

export default Timeline;
