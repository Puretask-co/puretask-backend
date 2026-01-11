/**
 * SettingsCard Component
 * 
 * Reusable settings card with toggle, description, and custom actions
 */

import React from 'react';

interface SettingsCardProps {
  title: string;
  description?: string;
  value: boolean | number | string;
  type?: 'boolean' | 'number' | 'text' | 'select';
  options?: { value: string; label: string }[];
  enabled?: boolean;
  onChange: (value: any) => void;
  onEnabledChange?: (enabled: boolean) => void;
  icon?: string;
  badge?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  value,
  type = 'boolean',
  options = [],
  enabled = true,
  onChange,
  onEnabledChange,
  icon,
  badge,
  min,
  max,
  step = 1,
  className = '',
}) => {
  const renderControl = () => {
    switch (type) {
      case 'boolean':
        return (
          <button
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? 'bg-blue-600' : 'bg-gray-200'
            } ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!enabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            min={min}
            max={max}
            step={step}
            disabled={!enabled}
            className={`w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !enabled ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
          />
        );

      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={!enabled}
            className={`w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !enabled ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={!enabled}
            className={`px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !enabled ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-4">
          <div className="flex items-center space-x-2 mb-1">
            {icon && <span className="text-xl">{icon}</span>}
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {badge && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {renderControl()}
          {onEnabledChange && (
            <button
              onClick={() => onEnabledChange(!enabled)}
              className={`text-xs px-2 py-1 rounded ${
                enabled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsCard;

