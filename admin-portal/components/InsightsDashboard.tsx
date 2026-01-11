/**
 * InsightsDashboard Component
 * 
 * Visual analytics dashboard for AI Assistant performance and usage
 */

import React, { useState, useEffect } from 'react';

interface TemplateStats {
  template_type: string;
  count: number;
  total_usage: number;
}

interface ResponseStats {
  response_category: string;
  count: number;
  total_usage: number;
  favorites: number;
}

interface SettingsStats {
  enabled: number;
  disabled: number;
}

interface InsightsData {
  templates: TemplateStats[];
  quickResponses: ResponseStats[];
  settings: SettingsStats;
  generatedAt: string;
}

interface InsightsDashboardProps {
  cleanerId?: string;
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({ cleanerId }) => {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch('/cleaner/ai/insights', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-600">Loading insights...</div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No insights available yet.</p>
      </div>
    );
  }

  const totalTemplateUsage = insights.templates.reduce((sum, t) => sum + t.total_usage, 0);
  const totalResponseUsage = insights.quickResponses.reduce((sum, r) => sum + r.total_usage, 0);
  const totalAIInteractions = totalTemplateUsage + totalResponseUsage;

  // Calculate percentages for visual bars
  const getPercentage = (value: number, total: number) => {
    return total > 0 ? (value / total) * 100 : 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Performance Insights</h2>
          <p className="text-sm text-gray-600 mt-1">
            Track your AI Assistant's activity and effectiveness
          </p>
        </div>
        <button
          onClick={fetchInsights}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="text-3xl font-bold mb-1">{totalAIInteractions}</div>
          <div className="text-blue-100 text-sm">Total AI Interactions</div>
          <div className="mt-3 text-xs text-blue-100">
            📈 All-time total
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="text-3xl font-bold mb-1">
            {insights.templates.reduce((sum, t) => sum + t.count, 0)}
          </div>
          <div className="text-green-100 text-sm">Active Templates</div>
          <div className="mt-3 text-xs text-green-100">
            📝 {totalTemplateUsage} total uses
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="text-3xl font-bold mb-1">
            {insights.quickResponses.reduce((sum, r) => sum + r.count, 0)}
          </div>
          <div className="text-purple-100 text-sm">Quick Responses</div>
          <div className="mt-3 text-xs text-purple-100">
            💬 {totalResponseUsage} total uses
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="text-3xl font-bold mb-1">{insights.settings.enabled}</div>
          <div className="text-orange-100 text-sm">Active Settings</div>
          <div className="mt-3 text-xs text-orange-100">
            ⚙️ {insights.settings.disabled} disabled
          </div>
        </div>
      </div>

      {/* Template Usage Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <span>📝</span>
          <span>Template Usage by Type</span>
        </h3>

        {insights.templates.length > 0 ? (
          <div className="space-y-3">
            {insights.templates
              .sort((a, b) => b.total_usage - a.total_usage)
              .map((template) => {
                const percentage = getPercentage(template.total_usage, totalTemplateUsage);
                return (
                  <div key={template.template_type} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700 capitalize">
                        {template.template_type.replace(/_/g, ' ')} ({template.count})
                      </span>
                      <span className="text-gray-600">{template.total_usage} uses</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No template usage data yet</p>
        )}
      </div>

      {/* Quick Response Analytics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <span>💬</span>
          <span>Quick Response Analytics</span>
        </h3>

        {insights.quickResponses.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Chart */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Usage by Category</h4>
              <div className="space-y-3">
                {insights.quickResponses
                  .sort((a, b) => b.total_usage - a.total_usage)
                  .slice(0, 5)
                  .map((response) => {
                    const percentage = getPercentage(response.total_usage, totalResponseUsage);
                    return (
                      <div key={response.response_category} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-gray-700 capitalize">
                            {response.response_category.replace(/_/g, ' ')}
                          </span>
                          <span className="text-gray-600">{response.total_usage}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Category Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Category Overview</h4>
              <div className="space-y-2">
                {insights.quickResponses.map((response) => (
                  <div
                    key={response.response_category}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-sm text-gray-900 capitalize">
                        {response.response_category.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {response.count} responses • {response.favorites} ⭐ favorites
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-purple-600">{response.total_usage}</div>
                      <div className="text-xs text-gray-500">uses</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No quick response data yet</p>
        )}
      </div>

      {/* Settings Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <span>⚙️</span>
          <span>Settings Configuration</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Breakdown */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Status Breakdown</h4>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-700">Enabled Settings</span>
                  <span className="font-semibold text-green-600">{insights.settings.enabled}</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{
                      width: `${getPercentage(
                        insights.settings.enabled,
                        insights.settings.enabled + insights.settings.disabled
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-700">Disabled Settings</span>
                  <span className="font-semibold text-gray-600">{insights.settings.disabled}</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-400 rounded-full"
                    style={{
                      width: `${getPercentage(
                        insights.settings.disabled,
                        insights.settings.enabled + insights.settings.disabled
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Donut Chart Visualization */}
          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Enabled segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="20"
                  strokeDasharray={`${getPercentage(
                    insights.settings.enabled,
                    insights.settings.enabled + insights.settings.disabled
                  ) * 2.51} 251`}
                />
                {/* Disabled segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="20"
                  strokeDasharray={`${getPercentage(
                    insights.settings.disabled,
                    insights.settings.enabled + insights.settings.disabled
                  ) * 2.51} 251`}
                  strokeDashoffset={`-${getPercentage(
                    insights.settings.enabled,
                    insights.settings.enabled + insights.settings.disabled
                  ) * 2.51}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-gray-900">
                  {insights.settings.enabled + insights.settings.disabled}
                </div>
                <div className="text-sm text-gray-500">Total Settings</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
          <span>💡</span>
          <span>AI Recommendations</span>
        </h3>
        <ul className="space-y-2">
          {totalAIInteractions === 0 && (
            <li className="flex items-start space-x-2 text-sm text-gray-700">
              <span>•</span>
              <span>Start using your AI templates and quick responses to track performance!</span>
            </li>
          )}
          {insights.templates.some(t => t.total_usage === 0) && (
            <li className="flex items-start space-x-2 text-sm text-gray-700">
              <span>•</span>
              <span>Some templates haven't been used yet. Consider customizing them to match your style.</span>
            </li>
          )}
          {insights.settings.disabled > insights.settings.enabled && (
            <li className="flex items-start space-x-2 text-sm text-gray-700">
              <span>•</span>
              <span>You have more disabled settings than enabled. Review your settings to maximize AI effectiveness.</span>
            </li>
          )}
          {totalTemplateUsage > totalResponseUsage * 2 && (
            <li className="flex items-start space-x-2 text-sm text-gray-700">
              <span>•</span>
              <span>Your quick responses are underutilized. Consider adding more relevant responses.</span>
            </li>
          )}
          {insights.quickResponses.some(r => r.favorites === 0) && (
            <li className="flex items-start space-x-2 text-sm text-gray-700">
              <span>•</span>
              <span>Mark your most useful quick responses as favorites for easier access!</span>
            </li>
          )}
        </ul>
      </div>

      {/* Last Updated */}
      <div className="text-center text-xs text-gray-500">
        Last updated: {new Date(insights.generatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default InsightsDashboard;

