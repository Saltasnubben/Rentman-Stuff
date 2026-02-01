import Select from 'react-select';
import { useTheme } from '../contexts/ThemeContext';

function VehicleSelector({ vehicles, selected, onChange, loading }) {
  const { theme } = useTheme();

  // Determine if we're in dark mode
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const options = vehicles.map(vehicle => ({
    value: vehicle.id,
    label: vehicle.name,
    data: vehicle
  }));

  const selectedOptions = selected.map(vehicle => ({
    value: vehicle.id,
    label: vehicle.name,
    data: vehicle
  }));

  const handleChange = (newValue) => {
    const selectedVehicles = newValue
      ? newValue.map(option => option.data)
      : [];
    onChange(selectedVehicles);
  };

  const customStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '44px',
      backgroundColor: isDark ? '#374151' : 'white',
      borderColor: state.isFocused ? '#f59e0b' : isDark ? '#4b5563' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #f59e0b' : 'none',
      '&:hover': {
        borderColor: '#f59e0b'
      }
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: isDark ? '#374151' : 'white',
      border: isDark ? '1px solid #4b5563' : '1px solid #d1d5db',
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: isDark ? '#92400e' : '#fef3c7',
      borderRadius: '6px'
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: isDark ? '#fcd34d' : '#92400e',
      fontWeight: 500
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: isDark ? '#fcd34d' : '#92400e',
      ':hover': {
        backgroundColor: isDark ? '#78350f' : '#fde68a',
        color: isDark ? '#fde68a' : '#78350f'
      }
    }),
    option: (base, { isSelected, isFocused }) => ({
      ...base,
      backgroundColor: isSelected
        ? '#f59e0b'
        : isFocused
        ? isDark ? '#4b5563' : '#fef3c7'
        : isDark ? '#374151' : 'white',
      color: isSelected ? 'white' : isDark ? '#f3f4f6' : '#1f2937',
      cursor: 'pointer'
    }),
    placeholder: (base) => ({
      ...base,
      color: isDark ? '#9ca3af' : '#9ca3af'
    }),
    singleValue: (base) => ({
      ...base,
      color: isDark ? '#f3f4f6' : '#1f2937'
    }),
    input: (base) => ({
      ...base,
      color: isDark ? '#f3f4f6' : '#1f2937'
    }),
  };

  const formatOptionLabel = ({ label, data }) => (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center bg-amber-100 dark:bg-amber-900">
        <svg className="w-3 h-3 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h8m-4 5v-5m-8 5h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <span>{label}</span>
      {data?.licenseplate && (
        <span className="text-xs text-gray-400 ml-auto font-mono">{data.licenseplate}</span>
      )}
    </div>
  );

  return (
    <Select
      isMulti
      options={options}
      value={selectedOptions}
      onChange={handleChange}
      isLoading={loading}
      placeholder="Sök och välj fordon..."
      noOptionsMessage={() => 'Inga fordon hittades'}
      loadingMessage={() => 'Laddar...'}
      styles={customStyles}
      formatOptionLabel={formatOptionLabel}
      closeMenuOnSelect={false}
      className="vehicle-selector"
      classNamePrefix="vehicle-select"
    />
  );
}

export default VehicleSelector;
