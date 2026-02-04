import { useEffect } from 'react';
import { addDays, startOfDay } from 'date-fns';

/**
 * Keyboard shortcuts for the timeline
 * 
 * Arrow Left/Right: Navigate days
 * Shift + Arrow: Navigate weeks
 * T: Jump to today
 * R: Refresh data
 * 1-4: Quick presets (1 day, 3 days, 1 week, 2 weeks)
 * Escape: Close modal
 */
export function useKeyboardShortcuts({
  dateRange,
  onDateRangeChange,
  onRefresh,
  onCloseModal,
  enabled = true
}) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // Don't trigger when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const days = dateRange ? Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)) : 7;

      switch (e.key) {
        case 'ArrowLeft':
          if (onDateRangeChange && dateRange) {
            e.preventDefault();
            const shift = e.shiftKey ? 7 : 1;
            onDateRangeChange({
              start: addDays(dateRange.start, -shift),
              end: addDays(dateRange.end, -shift)
            });
          }
          break;

        case 'ArrowRight':
          if (onDateRangeChange && dateRange) {
            e.preventDefault();
            const shift = e.shiftKey ? 7 : 1;
            onDateRangeChange({
              start: addDays(dateRange.start, shift),
              end: addDays(dateRange.end, shift)
            });
          }
          break;

        case 't':
        case 'T':
          if (onDateRangeChange) {
            e.preventDefault();
            const today = startOfDay(new Date());
            onDateRangeChange({
              start: today,
              end: addDays(today, days)
            });
          }
          break;

        case 'r':
        case 'R':
          if (onRefresh && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            onRefresh();
          }
          break;

        case '1':
          if (onDateRangeChange && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            const today = startOfDay(new Date());
            onDateRangeChange({ start: today, end: addDays(today, 1) });
          }
          break;

        case '2':
          if (onDateRangeChange && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            const today = startOfDay(new Date());
            onDateRangeChange({ start: today, end: addDays(today, 3) });
          }
          break;

        case '3':
          if (onDateRangeChange && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            const today = startOfDay(new Date());
            onDateRangeChange({ start: today, end: addDays(today, 7) });
          }
          break;

        case '4':
          if (onDateRangeChange && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            const today = startOfDay(new Date());
            onDateRangeChange({ start: today, end: addDays(today, 14) });
          }
          break;

        case 'Escape':
          if (onCloseModal) {
            e.preventDefault();
            onCloseModal();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dateRange, onDateRangeChange, onRefresh, onCloseModal, enabled]);
}

export default useKeyboardShortcuts;
