import { format, parseISO, differenceInMinutes } from 'date-fns';
import { sv } from 'date-fns/locale';

function BookingDetailModal({ booking, onClose, crewName }) {
  if (!booking) return null;

  const isAppointment = booking.type === 'appointment';
  const isUnfilled = booking.type === 'unfilled';
  const isVehicle = booking.type === 'vehicle';
  
  const start = parseISO(booking.start);
  const end = parseISO(booking.end);
  const durationMinutes = differenceInMinutes(end, start);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  
  const formatDuration = () => {
    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} tim`;
    return `${hours} tim ${minutes} min`;
  };

  const getStatusBadge = (status) => {
    const statusLower = (status || '').toLowerCase();
    const statusStyles = {
      confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      optie: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      option: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      concept: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
    };
    return statusStyles[statusLower] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
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
        {/* Header with color bar */}
        <div 
          className="h-2 rounded-t-xl"
          style={{ backgroundColor: booking.color || booking.projectColor || '#3b82f6' }}
        />
        
        <div className="p-6">
          {/* Title and type badge */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {booking.projectName || 'Bokning'}
              </h2>
              {booking.role && booking.role !== booking.projectName && (
                <p className="text-gray-500 dark:text-gray-400 mt-1">{booking.role}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {isAppointment && (
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
                  Kalenderbokning
                </span>
              )}
              {isUnfilled && (
                <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">
                  Otillsatt
                </span>
              )}
              {isVehicle && (
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                  🚐 Fordon
                </span>
              )}
              {booking.projectStatus && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(booking.projectStatus)}`}>
                  {booking.projectStatus}
                </span>
              )}
            </div>
          </div>

          {/* Time info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium">
                  {format(start, 'EEEE d MMMM yyyy', { locale: sv })}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {format(start, 'HH:mm')} - {format(end, 'HH:mm')} ({formatDuration()})
                </div>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="space-y-3">
            {crewName && (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Crewmedlem</div>
                  <div className="text-gray-900 dark:text-white">{crewName}</div>
                </div>
              </div>
            )}

            {booking.projectNumber && (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Projektnummer</div>
                  <div className="text-gray-900 dark:text-white">#{booking.projectNumber}</div>
                </div>
              </div>
            )}

            {booking.accountManager && (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Account Manager</div>
                  <div className="text-gray-900 dark:text-white">{booking.accountManager}</div>
                </div>
              </div>
            )}

            {booking.customer && (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Kund</div>
                  <div className="text-gray-900 dark:text-white">{booking.customer}</div>
                </div>
              </div>
            )}

            {booking.location && (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Plats</div>
                  <div className="text-gray-900 dark:text-white">{booking.location}</div>
                </div>
              </div>
            )}

            {booking.remark && (
              <div className="flex items-start gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Anteckning</div>
                  <div className="text-gray-900 dark:text-white whitespace-pre-wrap">{booking.remark}</div>
                </div>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-6 w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

export default BookingDetailModal;
