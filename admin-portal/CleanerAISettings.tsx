/**
 * Cleaner AI Assistant Settings Component
 * 
 * Allows cleaners to configure their AI Assistant's behavior, templates, and preferences
 */

import React, { useState, useEffect } from 'react';

interface AISettings {
  [category: string]: Array<{
    key: string;
    value: any;
    description: string;
    enabled: boolean;
  }>;
}

interface Template {
  id: string;
  type: string;
  name: string;
  content: string;
  variables: string[];
  isDefault: boolean;
  active: boolean;
  usageCount: number;
}

interface QuickResponse {
  id: string;
  category: string;
  triggerKeywords: string[];
  text: string;
  favorite: boolean;
  usageCount: number;
}

interface AIPreferences {
  communicationTone: string;
  formalityLevel: number;
  emojiUsage: string;
  responseSpeed: string;
  fullAutomationEnabled: boolean;
  requireApprovalForBookings: boolean;
  priorityGoal: string;
  targetWeeklyHours?: number;
}

const CleanerAISettings: React.FC = () => {
  const [settings, setSettings] = useState<AISettings>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [quickResponses, setQuickResponses] = useState<QuickResponse[]>([]);
  const [preferences, setPreferences] = useState<AIPreferences | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'templates' | 'responses' | 'preferences'>('settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [settingsRes, templatesRes, responsesRes, prefsRes] = await Promise.all([
        fetch('/cleaner/ai/settings', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/cleaner/ai/templates', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/cleaner/ai/quick-responses', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/cleaner/ai/preferences', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const settingsData = await settingsRes.json();
      const templatesData = await templatesRes.json();
      const responsesData = await responsesRes.json();
      const prefsData = await prefsRes.json();

      setSettings(settingsData.settings || {});
      setTemplates(templatesData.templates || []);
      setQuickResponses(responsesData.responses || []);
      setPreferences(prefsData.preferences || null);
    } catch (error) {
      console.error('Error fetching AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any, enabled: boolean) => {
    try {
      await fetch(`/cleaner/ai/settings/${key}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ value, enabled })
      });
      fetchAllData();
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  const updatePreferences = async (updates: Partial<AIPreferences>) => {
    setSaving(true);
    try {
      await fetch('/cleaner/ai/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      fetchAllData();
    } catch (error) {
      console.error('Error updating preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async (template: Partial<Template>) => {
    try {
      await fetch('/cleaner/ai/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          templateType: template.type,
          templateName: template.name,
          templateContent: template.content,
          variables: template.variables
        })
      });
      fetchAllData();
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await fetch(`/cleaner/ai/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      fetchAllData();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading AI Settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🤖 AI Assistant Settings
        </h1>
        <p className="text-gray-600">
          Configure how your AI Assistant communicates and operates on your behalf
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📝 Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('responses')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'responses'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            💬 Quick Responses ({quickResponses.length})
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'preferences'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🎛️ AI Behavior
          </button>
        </nav>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {Object.entries(settings).map(([category, categorySettings]) => (
            <div key={category} className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 capitalize">
                {category} Settings
              </h2>
              <div className="space-y-4">
                {categorySettings.map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-700">
                          {setting.key.split('.').pop()?.replace(/_/g, ' ')}
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{setting.description}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      {typeof setting.value === 'boolean' ? (
                        <button
                          onClick={() => updateSetting(setting.key, !setting.value, setting.enabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            setting.value ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              setting.value ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      ) : typeof setting.value === 'number' ? (
                        <input
                          type="number"
                          value={setting.value}
                          onChange={(e) => updateSetting(setting.key, parseInt(e.target.value), setting.enabled)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">{JSON.stringify(setting.value)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                  <span className="text-xs text-gray-500 uppercase">{template.type}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Used {template.usageCount} times</span>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded border border-gray-200 mb-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{template.content}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Variables:</span>
                {template.variables.map((variable) => (
                  <span key={variable} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {`{${variable}}`}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              const name = prompt('Template name:');
              const type = prompt('Template type (e.g., booking_confirmation):');
              const content = prompt('Template content:');
              if (name && type && content) {
                createTemplate({ name, type, content, variables: [] });
              }
            }}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
          >
            + Add New Template
          </button>
        </div>
      )}

      {/* Quick Responses Tab */}
      {activeTab === 'responses' && (
        <div className="space-y-4">
          {quickResponses.map((response) => (
            <div key={response.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 capitalize">{response.category}</h3>
                  <span className="text-xs text-gray-500">Used {response.usageCount} times</span>
                </div>
                {response.favorite && <span className="text-yellow-500">⭐</span>}
              </div>
              <p className="text-sm text-gray-700 mb-3">{response.text}</p>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Triggers:</span>
                {response.triggerKeywords.map((keyword) => (
                  <span key={keyword} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <button className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition">
            + Add New Quick Response
          </button>
        </div>
      )}

      {/* AI Preferences Tab */}
      {activeTab === 'preferences' && preferences && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Communication Style */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Communication Style</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                <select
                  value={preferences.communicationTone}
                  onChange={(e) => updatePreferences({ communicationTone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="professional_friendly">Professional & Friendly</option>
                  <option value="casual">Casual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formality Level: {preferences.formalityLevel}
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={preferences.formalityLevel}
                  onChange={(e) => updatePreferences({ formalityLevel: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Casual</span>
                  <span>Very Formal</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Emoji Usage</label>
                <select
                  value={preferences.emojiUsage}
                  onChange={(e) => updatePreferences({ emojiUsage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="none">None</option>
                  <option value="minimal">Minimal</option>
                  <option value="moderate">Moderate</option>
                  <option value="frequent">Frequent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Automation Level */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Automation Level</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Full Automation</label>
                  <p className="text-xs text-gray-500">Let AI handle everything automatically</p>
                </div>
                <button
                  onClick={() => updatePreferences({ fullAutomationEnabled: !preferences.fullAutomationEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.fullAutomationEnabled ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.fullAutomationEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Require Booking Approval</label>
                  <p className="text-xs text-gray-500">Review bookings before they're confirmed</p>
                </div>
                <button
                  onClick={() => updatePreferences({ requireApprovalForBookings: !preferences.requireApprovalForBookings })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.requireApprovalForBookings ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.requireApprovalForBookings ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Goals & Priorities */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Goals & Priorities</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority Goal</label>
                <select
                  value={preferences.priorityGoal}
                  onChange={(e) => updatePreferences({ priorityGoal: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="maximize_bookings">Maximize Bookings</option>
                  <option value="quality_clients">Quality Clients</option>
                  <option value="balanced">Balanced</option>
                  <option value="work_life_balance">Work-Life Balance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Weekly Hours</label>
                <input
                  type="number"
                  value={preferences.targetWeeklyHours || ''}
                  onChange={(e) => updatePreferences({ targetWeeklyHours: parseInt(e.target.value) || undefined })}
                  placeholder="e.g., 30"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="border-t border-gray-200 pt-6">
            <button
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : '💾 Save All Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleanerAISettings;

