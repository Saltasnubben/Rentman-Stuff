function StatusBar({ status, loading }) {
  const getStatusDisplay = () => {
    if (loading) {
      return {
        color: 'bg-yellow-500',
        text: 'Laddar...',
        pulse: true
      };
    }

    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-500',
          text: 'Ansluten',
          pulse: false
        };
      case 'error':
        return {
          color: 'bg-red-500',
          text: 'Fel',
          pulse: false
        };
      default:
        return {
          color: 'bg-gray-400',
          text: 'Inte ansluten',
          pulse: false
        };
    }
  };

  const { color, text, pulse } = getStatusDisplay();

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <div className="relative">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        {pulse && (
          <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${color} animate-ping`} />
        )}
      </div>
      <span>{text}</span>
    </div>
  );
}

export default StatusBar;
