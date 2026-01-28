import Select from 'react-select';
import { useTheme } from '../contexts/ThemeContext';

function CrewSelector({ crew, selected, onChange, loading, availableTags = [], onTagFilter }) {
  const { theme } = useTheme();

  // Determine if we're in dark mode
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const options = crew.map(member => ({
    value: member.id,
    label: member.name,
    data: member
  }));

  const selectedOptions = selected.map(member => ({
    value: member.id,
    label: member.name,
    data: member
  }));

  const tagOptions = availableTags.map(tag => ({
    value: tag,
    label: tag
  }));

  const handleChange = (newValue) => {
    const selectedMembers = newValue
      ? newValue.map(option => option.data)
      : [];
    onChange(selectedMembers);
  };

  const handleTagSelect = (selectedTag) => {
    if (selectedTag) {
      // Filtrera crew baserat på tag och lägg till alla
      const crewWithTag = crew.filter(member =>
        member.tags && member.tags.includes(selectedTag.value)
      );
      // Lägg till de som inte redan är valda
      const newSelected = [...selected];
      crewWithTag.forEach(member => {
        if (!newSelected.find(s => s.id === member.id)) {
          newSelected.push(member);
        }
      });
      onChange(newSelected);
    }
  };

  const customStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '44px',
      backgroundColor: isDark ? '#374151' : 'white',
      borderColor: state.isFocused ? '#3b82f6' : isDark ? '#4b5563' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
      '&:hover': {
        borderColor: '#3b82f6'
      }
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: isDark ? '#374151' : 'white',
      border: isDark ? '1px solid #4b5563' : '1px solid #d1d5db',
    }),
    multiValue: (base, { data }) => ({
      ...base,
      backgroundColor: data.data?.color ? `${data.data.color}20` : isDark ? '#1e40af' : '#dbeafe',
      borderRadius: '6px'
    }),
    multiValueLabel: (base, { data }) => ({
      ...base,
      color: isDark ? '#93c5fd' : (data.data?.color || '#1e40af'),
      fontWeight: 500
    }),
    multiValueRemove: (base, { data }) => ({
      ...base,
      color: isDark ? '#93c5fd' : (data.data?.color || '#1e40af'),
      ':hover': {
        backgroundColor: data.data?.color ? `${data.data.color}40` : isDark ? '#1e3a8a' : '#bfdbfe',
        color: isDark ? '#bfdbfe' : '#1e3a8a'
      }
    }),
    option: (base, { isSelected, isFocused }) => ({
      ...base,
      backgroundColor: isSelected
        ? '#3b82f6'
        : isFocused
        ? isDark ? '#4b5563' : '#eff6ff'
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
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: data?.color || '#3b82f6' }}
      />
      <span>{label}</span>
      {data?.function && (
        <span className="text-xs text-gray-400 ml-auto">{data.function}</span>
      )}
    </div>
  );

  const tagSelectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '36px',
      backgroundColor: isDark ? '#374151' : 'white',
      borderColor: state.isFocused ? '#10b981' : isDark ? '#4b5563' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #10b981' : 'none',
      '&:hover': {
        borderColor: '#10b981'
      }
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: isDark ? '#374151' : 'white',
      border: isDark ? '1px solid #4b5563' : '1px solid #d1d5db',
    }),
    option: (base, { isSelected, isFocused }) => ({
      ...base,
      backgroundColor: isSelected
        ? '#10b981'
        : isFocused
        ? isDark ? '#4b5563' : '#d1fae5'
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

  return (
    <div className="space-y-2">
      {/* Tag filter */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Lägg till via tag:</span>
          <Select
            options={tagOptions}
            onChange={handleTagSelect}
            value={null}
            placeholder="Välj tag..."
            isClearable
            styles={tagSelectStyles}
            className="flex-1"
            classNamePrefix="tag-select"
          />
        </div>
      )}

      {/* Crew selector */}
      <Select
        isMulti
        options={options}
        value={selectedOptions}
        onChange={handleChange}
        isLoading={loading}
        placeholder="Sök och välj crewmedlemmar..."
        noOptionsMessage={() => 'Inga crewmedlemmar hittades'}
        loadingMessage={() => 'Laddar...'}
        styles={customStyles}
        formatOptionLabel={formatOptionLabel}
        closeMenuOnSelect={false}
        className="crew-selector"
        classNamePrefix="crew-select"
      />
    </div>
  );
}

export default CrewSelector;
