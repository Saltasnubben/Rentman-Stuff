import { useMemo } from 'react';
import { format, parseISO, areIntervalsOverlapping } from 'date-fns';
import { sv } from 'date-fns/locale';

function ConflictModal({ crewName, bookings, onClose, onBookingClick }) {
  // Find all overlapping pairs
  const conflicts = useMemo(() => {
    const pairs = [];
    const projectBookings = bookings.filter(b => b.type === 'project');
    
    for (let i = 0; i < projectBookings.length; i++) {
      for (let j = i + 1; j < projectBookings.length; j++) {
        const a = projectBookings[i];
        const b = projectBookings[j];
        try {
          const overlaps = areIntervalsOverlapping(
            { start: parseISO(a.start), end: parseISO(a.end) },
            { start: parseISO(b.start), end: parseISO(b.end) }
          );
          if (overlaps) {
            pairs.push({ a, b });
          }
        } catch (e) {
          // Invalid date, skip
        }
      }
    }
    return pairs;
  }, [bookings]);

  const formatTime = (dateStr) => {
    try {
      return format(parseISO(dateStr), 'd MMM HH:mm', { locale: sv });
    } catch {
      return dateStr;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Överlappande bokningar
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {crewName} har {conflicts.length} {conflicts.length === 1 ? 'konflikt' : 'konflikter'}
              </p>
            </div>
          </div>
        </div>

        {/* Conflicts list */}
        <div className="p-4 space-y-4">
          {conflicts.map((conflict, index) => (
            <div 
              key={index}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4"
            >
              <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-3">
                Konflikt {index + 1}
              </div>
              
              <div className="space-y-3">
                {/* Booking A */}
                <button
                  onClick={() => {
                    onBookingClick?.(conflict.a);
                    onClose();
                  }}
                  className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: conflict.a.color || conflict.a.projectColor || '#3b82f6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {conflict.a.projectName}
                      </div>
                      {conflict.a.role && conflict.a.role !== conflict.a.projectName && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {conflict.a.role}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatTime(conflict.a.start)} → {formatTime(conflict.a.end)}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Overlap indicator */}
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-2 text-xs text-red-500 dark:text-red-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span>Överlappar</span>
                  </div>
                </div>

                {/* Booking B */}
                <button
                  onClick={() => {
                    onBookingClick?.(conflict.b);
                    onClose();
                  }}
                  className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: conflict.b.color || conflict.b.projectColor || '#3b82f6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {conflict.b.projectName}
                      </div>
                      {conflict.b.role && conflict.b.role !== conflict.b.projectName && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {conflict.b.role}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatTime(conflict.b.start)} → {formatTime(conflict.b.end)}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          ))}

          {conflicts.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Inga konflikter hittades
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConflictModal;
