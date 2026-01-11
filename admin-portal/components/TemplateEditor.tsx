/**
 * TemplateEditor Component
 * 
 * Rich template editor with variable picker, preview, and validation
 */

import React, { useState, useEffect } from 'react';

interface Template {
  id?: string;
  type: string;
  name: string;
  content: string;
  variables: string[];
  active?: boolean;
}

interface TemplateEditorProps {
  template?: Template;
  onSave: (template: Partial<Template>) => Promise<void>;
  onCancel: () => void;
  availableVariables?: string[];
  templateTypes?: { value: string; label: string }[];
}

const DEFAULT_VARIABLES = [
  'client_name',
  'cleaner_name',
  'date',
  'time',
  'address',
  'property_type',
  'amount',
  'eta',
  'rooms_cleaned',
];

const DEFAULT_TEMPLATE_TYPES = [
  { value: 'booking_confirmation', label: 'Booking Confirmation' },
  { value: 'pre_cleaning_reminder', label: 'Pre-Cleaning Reminder' },
  { value: 'on_my_way', label: 'On My Way' },
  { value: 'job_complete', label: 'Job Complete' },
  { value: 'review_request', label: 'Review Request' },
  { value: 'rescheduling', label: 'Rescheduling' },
  { value: 'running_late', label: 'Running Late' },
  { value: 'payment_thanks', label: 'Payment Thank You' },
  { value: 'custom', label: 'Custom' },
];

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  onCancel,
  availableVariables = DEFAULT_VARIABLES,
  templateTypes = DEFAULT_TEMPLATE_TYPES,
}) => {
  const [formData, setFormData] = useState<Partial<Template>>({
    type: template?.type || 'custom',
    name: template?.name || '',
    content: template?.content || '',
    variables: template?.variables || [],
    active: template?.active ?? true,
  });

  const [preview, setPreview] = useState('');
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Extract variables from content
  useEffect(() => {
    const variableRegex = /\{([^}]+)\}/g;
    const matches = [...formData.content!.matchAll(variableRegex)];
    const usedVars = matches.map(m => m[1]);
    setFormData(prev => ({ ...prev, variables: [...new Set(usedVars)] }));

    // Generate preview
    generatePreview(formData.content!, sampleData);
  }, [formData.content]);

  const generatePreview = (content: string, data: Record<string, string>) => {
    let previewText = content;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      previewText = previewText.replace(regex, value || `{${key}}`);
    }
    setPreview(previewText);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = formData.content!.substring(0, start);
      const after = formData.content!.substring(end);
      const newContent = `${before}{${variable}}${after}`;
      
      setFormData(prev => ({ ...prev, content: newContent }));
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 2, start + variable.length + 2);
      }, 0);
    }
  };

  const updateSampleData = (variable: string, value: string) => {
    const newSampleData = { ...sampleData, [variable]: value };
    setSampleData(newSampleData);
    generatePreview(formData.content!, newSampleData);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = 'Template name is required';
    }

    if (!formData.content || formData.content.trim().length === 0) {
      newErrors.content = 'Template content is required';
    }

    if (formData.content && formData.content.length > 1000) {
      newErrors.content = 'Template content must be under 1000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {template ? 'Edit Template' : 'Create New Template'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Create personalized message templates with dynamic variables
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Column */}
        <div className="space-y-4">
          {/* Template Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {templateTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., My Booking Confirmation"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Template Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Content * ({formData.content?.length || 0}/1000)
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Write your message here... Use {variable_name} for dynamic content."
              rows={8}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                errors.content ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.content && (
              <p className="text-xs text-red-600 mt-1">{errors.content}</p>
            )}
          </div>

          {/* Available Variables */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Variables
            </label>
            <div className="flex flex-wrap gap-2">
              {availableVariables.map((variable) => (
                <button
                  key={variable}
                  onClick={() => insertVariable(variable)}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-200 transition"
                >
                  + {variable}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click to insert into template. Variables will be replaced with actual data when sent.
            </p>
          </div>

          {/* Used Variables */}
          {formData.variables && formData.variables.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variables in This Template
              </label>
              <div className="flex flex-wrap gap-2">
                {formData.variables.map((variable) => (
                  <span
                    key={variable}
                    className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"
                  >
                    {'{' + variable + '}'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preview Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Live Preview
            </label>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 min-h-[200px]">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {preview || 'Your preview will appear here...'}
              </p>
            </div>
          </div>

          {/* Sample Data for Preview */}
          {formData.variables && formData.variables.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sample Data (for preview)
              </label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {formData.variables.map((variable) => (
                  <div key={variable}>
                    <label className="text-xs text-gray-600">{variable}</label>
                    <input
                      type="text"
                      value={sampleData[variable] || ''}
                      onChange={(e) => updateSampleData(variable, e.target.value)}
                      placeholder={`Sample ${variable}`}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Character Counter */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Characters</span>
              <span className={`font-semibold ${
                (formData.content?.length || 0) > 900 ? 'text-red-600' : 'text-blue-600'
              }`}>
                {formData.content?.length || 0} / 1000
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-700">Variables</span>
              <span className="font-semibold text-blue-600">
                {formData.variables?.length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;

