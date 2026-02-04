import { useMemo } from 'react';

const STATUS_CONFIG = {
  confirmed: { label: 'Bekräftad', color: 'bg-green-500', textColor: 'text-green-700 dark:text-green-400' },
  optie: { label: 'Optie', color: 'bg-yellow-500', textColor: 'text-yellow-700 dark:text-yellow-400' },
  option: { label: 'Option', color: 'bg-yellow-500', textColor: 'text-yellow-700 dark:text-yellow-400' },
  concept: { label: 'Koncept', color: 'bg-gray-400', textColor: 'text-gray-600 dark:text-gray-400' },
  cancelled: { label: 'Avbokad', color: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400' },
};

function StatusFilter({ bookings, activeStatuses, onChange }) {
  // Count bookings per status
  const statusCounts = useMemo(() => {
    const counts = {};
    bookings.forEach(booking => {
      if (booking.type === 'project') {
        const status = (booking.projectStatus || 'unknown').toLowerCase();
        counts[status] = (counts[status] || 0) + 1;
      }
    });
    return counts;
  }, [bookings]);

  const availableStatuses = Object.keys(statusCounts).filter(s => s !== 'unknown');

  if (availableStatuses.length === 0) {
    return null;
  }

  const handleToggle = (status) => {
    if (activeStatuses.includes(status)) {
      onChange(activeStatuses.filter(s => s !== status));
    } else {
      onChange([...activeStatuses, status]);
    }
  };

  const handleSelectAll = () => {
    onChange(availableStatuses);
  };

  const handleSelectNone = () => {
    onChange([]);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status:</span>
      
      {availableStatuses.map(status => {
        const config = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-400', textColor: 'text-gray-600' };
        const isActive = activeStatuses.length === 0 || activeStatuses.includes(status);
        const count = statusCounts[status] || 0;
        
        return (
          <button
            key={status}
            onClick={() => handleToggle(status)}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all
              ${isActive 
                ? `${config.textColor} bg-gray-100 dark:bg-gray-700 ring-1 ring-current` 
                : 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 opacity-50'
              }
              hover:opacity-100
            `}
          >
            <span className={`w-2 h-2 rounded-full ${config.color}`} />
            {config.label}
            <span className="opacity-60">({count})</span>
          </button>
        );
      })}

      {activeStatuses.length > 0 && activeStatuses.length < availableStatuses.length && (
        <button
          onClick={handleSelectAll}
          className="text-xs text-primary-500 hover:text-primary-600 ml-1"
        >
          Visa alla
        </button>
      )}
    </div>
  );
}

export default StatusFilter;
