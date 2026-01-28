import { useState, useEffect } from 'react';
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';

function DateRangePicker({ value, onChange, minDays = 1, maxDays = 14 }) {
  const [startDate, setStartDate] = useState(format(value.start, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(value.end, 'yyyy-MM-dd'));

  const currentDays = differenceInDays(value.end, value.start);

  useEffect(() => {
    setStartDate(format(value.start, 'yyyy-MM-dd'));
    setEndDate(format(value.end, 'yyyy-MM-dd'));
  }, [value]);

  const handleStartChange = (e) => {
    const newStart = startOfDay(new Date(e.target.value));
    setStartDate(e.target.value);

    // Adjust end date if needed
    let newEnd = value.end;
    const daysDiff = differenceInDays(newEnd, newStart);

    if (daysDiff < minDays) {
      newEnd = addDays(newStart, minDays);
    } else if (daysDiff > maxDays) {
      newEnd = addDays(newStart, maxDays);
    }

    onChange({ start: newStart, end: newEnd });
  };

  const handleEndChange = (e) => {
    const newEnd = startOfDay(new Date(e.target.value));
    setEndDate(e.target.value);

    // Validate range
    const daysDiff = differenceInDays(newEnd, value.start);

    if (daysDiff >= minDays && daysDiff <= maxDays) {
      onChange({ ...value, end: newEnd });
    }
  };

  const handlePreset = (days) => {
    const today = startOfDay(new Date());
    onChange({
      start: today,
      end: addDays(today, days)
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handlePreset(1)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            currentDays === 1
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Idag
        </button>
        <button
          onClick={() => handlePreset(3)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            currentDays === 3
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          3 dagar
        </button>
        <button
          onClick={() => handlePreset(7)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            currentDays === 7
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          1 vecka
        </button>
        <button
          onClick={() => handlePreset(14)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            currentDays === 14
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          2 veckor
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Från</label>
          <input
            type="date"
            value={startDate}
            onChange={handleStartChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex-shrink-0 text-gray-400 dark:text-gray-500 mt-5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Till</label>
          <input
            type="date"
            value={endDate}
            onChange={handleEndChange}
            min={format(addDays(value.start, minDays), 'yyyy-MM-dd')}
            max={format(addDays(value.start, maxDays), 'yyyy-MM-dd')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Visar {currentDays} {currentDays === 1 ? 'dag' : 'dagar'}
      </div>
    </div>
  );
}

export default DateRangePicker;
