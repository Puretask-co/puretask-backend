/**
 * QuickResponseManager Component
 * 
 * Manage quick responses with categories, favorites, and search
 */

import React, { useState } from 'react';

interface QuickResponse {
  id: string;
  category: string;
  triggerKeywords: string[];
  text: string;
  favorite: boolean;
  usageCount: number;
}

interface QuickResponseManagerProps {
  responses: QuickResponse[];
  onAdd: (response: Omit<QuickResponse, 'id' | 'usageCount'>) => Promise<void>;
  onEdit: (id: string, response: Partial<QuickResponse>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => Promise<void>;
}

const CATEGORIES = [
  { value: 'pricing', label: 'Pricing', icon: '💰' },
  { value: 'availability', label: 'Availability', icon: '📅' },
  { value: 'services', label: 'Services', icon: '🧹' },
  { value: 'payment', label: 'Payment', icon: '💳' },
  { value: 'cancellation', label: 'Cancellation', icon: '❌' },
  { value: 'pets', label: 'Pets', icon: '🐾' },
  { value: 'supplies', label: 'Supplies', icon: '🧴' },
  { value: 'special_requests', label: 'Special Requests', icon: '⭐' },
  { value: 'access', label: 'Access & Parking', icon: '🔑' },
  { value: 'issues', label: 'Issues', icon: '⚠️' },
  { value: 'tipping', label: 'Tipping', icon: '💵' },
  { value: 'other', label: 'Other', icon: '📝' },
];

export const QuickResponseManager: React.FC<QuickResponseManagerProps> = ({
  responses,
  onAdd,
  onEdit,
  onDelete,
  onToggleFavorite,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Partial<QuickResponse>>({
    category: 'other',
    triggerKeywords: [],
    text: '',
    favorite: false,
  });
  const [keywordInput, setKeywordInput] = useState('');

  const filteredResponses = responses.filter(response => {
    const matchesCategory = !selectedCategory || response.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      response.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      response.triggerKeywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const groupedResponses = filteredResponses.reduce((acc, response) => {
    if (!acc[response.category]) {
      acc[response.category] = [];
    }
    acc[response.category].push(response);
    return acc;
  }, {} as Record<string, QuickResponse[]>);

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !formData.triggerKeywords?.includes(keywordInput.trim())) {
      setFormData(prev => ({
        ...prev,
        triggerKeywords: [...(prev.triggerKeywords || []), keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      triggerKeywords: (prev.triggerKeywords || []).filter(k => k !== keyword)
    }));
  };

  const handleSubmit = async () => {
    if (editingId) {
      await onEdit(editingId, formData);
    } else {
      await onAdd(formData as Omit<QuickResponse, 'id' | 'usageCount'>);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      category: 'other',
      triggerKeywords: [],
      text: '',
      favorite: false,
    });
    setKeywordInput('');
    setEditingId(null);
    setShowAddModal(false);
  };

  const startEdit = (response: QuickResponse) => {
    setFormData(response);
    setEditingId(response.id);
    setShowAddModal(true);
  };

  const getCategoryInfo = (categoryValue: string) => {
    return CATEGORIES.find(c => c.value === categoryValue) || CATEGORIES[CATEGORIES.length - 1];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quick Response Library</h2>
          <p className="text-sm text-gray-600 mt-1">
            Pre-written responses to common client questions
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + Add Response
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search responses or keywords..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              !selectedCategory
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({responses.length})
          </button>
          {CATEGORIES.map(category => {
            const count = responses.filter(r => r.category === category.value).length;
            if (count === 0) return null;
            return (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === category.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.icon} {category.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Response Cards */}
      <div className="space-y-6">
        {Object.entries(groupedResponses).map(([category, categoryResponses]) => {
          const categoryInfo = getCategoryInfo(category);
          return (
            <div key={category}>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <span>{categoryInfo.icon}</span>
                <span>{categoryInfo.label}</span>
                <span className="text-sm text-gray-500 font-normal">
                  ({categoryResponses.length})
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryResponses
                  .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0))
                  .map(response => (
                    <div
                      key={response.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onToggleFavorite(response.id)}
                            className={`text-xl ${
                              response.favorite ? 'text-yellow-500' : 'text-gray-300'
                            } hover:text-yellow-500 transition`}
                          >
                            {response.favorite ? '⭐' : '☆'}
                          </button>
                          <span className="text-xs text-gray-500">
                            Used {response.usageCount} times
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => startEdit(response)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this quick response?')) {
                                onDelete(response.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-800 mb-3 line-clamp-3">
                        {response.text}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {response.triggerKeywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}

        {filteredResponses.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No quick responses found.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Create your first response
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {editingId ? 'Edit Quick Response' : 'Add Quick Response'}
              </h3>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Response Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Response Text * ({formData.text?.length || 0}/500)
                  </label>
                  <textarea
                    value={formData.text}
                    onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="Write your response here..."
                    rows={6}
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Trigger Keywords */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trigger Keywords
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                      placeholder="Add keyword..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAddKeyword}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.triggerKeywords?.map((keyword, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                      >
                        <span>{keyword}</span>
                        <button
                          onClick={() => handleRemoveKeyword(keyword)}
                          className="hover:text-purple-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Keywords help the AI suggest this response when clients ask related questions
                  </p>
                </div>

                {/* Mark as Favorite */}
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.favorite}
                    onChange={(e) => setFormData(prev => ({ ...prev, favorite: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Mark as favorite ⭐</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.text || formData.triggerKeywords?.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {editingId ? 'Update' : 'Add'} Response
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickResponseManager;

