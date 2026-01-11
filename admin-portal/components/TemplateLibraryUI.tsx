/**
 * Template Library Marketplace UI
 * 
 * Features:
 * - Browse community templates
 * - Filter by category and type
 * - Search functionality
 * - Star ratings
 * - Save to personal collection
 * - Preview templates
 * - Customize before saving
 * - Featured templates showcase
 */

import React, { useState, useEffect } from 'react';

interface Template {
  id: string;
  type: string;
  name: string;
  content: string;
  variables: string[];
  category: string;
  subcategory?: string;
  description: string;
  ratingAverage: number;
  ratingCount: number;
  usageCount: number;
  favoriteCount: number;
  isFeatured: boolean;
  isVerified: boolean;
  tags: string[];
  createdAt: string;
}

interface SavedTemplate extends Template {
  customizedContent?: string;
  savedAt: string;
  isActive: boolean;
}

export const TemplateLibraryUI: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'saved'>('browse');
  
  // Filters
  const [category, setCategory] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<'rating' | 'popular' | 'recent'>('rating');
  
  // Preview
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [customContent, setCustomContent] = useState<string>('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchSavedTemplates();
  }, [category, type, search, sort]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.append('category', category);
      if (type !== 'all') params.append('type', type);
      if (search) params.append('search', search);
      params.append('sort', sort);

      const response = await fetch(`/template-library?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedTemplates = async () => {
    try {
      const response = await fetch('/template-library/saved', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setSavedTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching saved templates:', error);
    }
  };

  const saveTemplate = async (templateId: string, customized?: string) => {
    try {
      await fetch(`/template-library/${templateId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          customizedContent: customized
        })
      });
      
      fetchSavedTemplates();
      setShowSaveDialog(false);
      setPreviewTemplate(null);
      alert('Template saved successfully! ✓');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  const rateTemplate = async (templateId: string, rating: number) => {
    try {
      await fetch(`/template-library/${templateId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ rating })
      });
      
      fetchTemplates();
    } catch (error) {
      console.error('Error rating template:', error);
    }
  };

  const openPreview = (template: Template) => {
    setPreviewTemplate(template);
    setCustomContent(template.content);
  };

  const categories = ['all', 'residential', 'commercial', 'luxury', 'general'];
  const types = ['all', 'booking_confirmation', 'review_request', 'job_complete', 'follow_up', 'running_late'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">📚 Template Library</h2>
        <p className="opacity-90">Discover and use professional message templates from the community</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-6 py-3 font-semibold transition ${
            activeTab === 'browse'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Browse Library ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-6 py-3 font-semibold transition ${
            activeTab === 'saved'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          My Saved ({savedTemplates.length})
        </button>
      </div>

      {activeTab === 'browse' ? (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="rating">Top Rated</option>
                  <option value="popular">Most Popular</option>
                  <option value="recent">Newest</option>
                </select>
              </div>
            </div>
          </div>

          {/* Featured Templates */}
          {templates.some(t => t.isFeatured) && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">⭐ Featured Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.filter(t => t.isFeatured).map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onPreview={openPreview}
                    onSave={saveTemplate}
                    onRate={rateTemplate}
                    isSaved={savedTemplates.some(s => s.id === template.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Templates */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">All Templates</h3>
            {loading ? (
              <div className="text-center py-12">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No templates found. Try adjusting your filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onPreview={openPreview}
                    onSave={saveTemplate}
                    onRate={rateTemplate}
                    isSaved={savedTemplates.some(s => s.id === template.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Saved Templates Tab */
        <div>
          {savedTemplates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Saved Templates</h3>
              <p className="text-gray-600 mb-4">Browse the library to save templates you like</p>
              <button
                onClick={() => setActiveTab('browse')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Browse Library
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedTemplates.map(template => (
                <SavedTemplateCard
                  key={template.id}
                  template={template}
                  onPreview={openPreview}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview/Customize Dialog */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{previewTemplate.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{previewTemplate.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="flex items-center text-sm text-gray-600">
                      ⭐ {previewTemplate.ratingAverage.toFixed(1)} ({previewTemplate.ratingCount})
                    </span>
                    <span className="flex items-center text-sm text-gray-600">
                      📊 {previewTemplate.usageCount} uses
                    </span>
                    {previewTemplate.isVerified && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Variables Info */}
              {previewTemplate.variables.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Available Variables:</h4>
                  <div className="flex flex-wrap gap-2">
                    {previewTemplate.variables.map(variable => (
                      <code key={variable} className="px-2 py-1 bg-white text-blue-700 rounded text-sm">
                        {`{${variable}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Original Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Template:
                </label>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-sm">
                  {previewTemplate.content}
                </div>
              </div>

              {/* Customize */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customize (Optional):
                </label>
                <textarea
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Customize the template to match your style..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can edit the template or use it as-is
                </p>
              </div>

              {/* Tags */}
              {previewTemplate.tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags:</label>
                  <div className="flex flex-wrap gap-2">
                    {previewTemplate.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={() => saveTemplate(previewTemplate.id, customContent)}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  💾 Save to My Collection
                </button>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TemplateCard: React.FC<{
  template: Template;
  onPreview: (template: Template) => void;
  onSave: (id: string) => void;
  onRate: (id: string, rating: number) => void;
  isSaved: boolean;
}> = ({ template, onPreview, onSave, onRate, isSaved }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{template.name}</h4>
          <p className="text-xs text-gray-600 mt-1">{template.category}</p>
        </div>
        {template.isFeatured && (
          <span className="text-yellow-500">⭐</span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.description}</p>

      {/* Stats */}
      <div className="flex items-center space-x-3 text-xs text-gray-500 mb-3">
        <span className="flex items-center">
          ⭐ {template.ratingAverage.toFixed(1)}
        </span>
        <span>📊 {template.usageCount}</span>
        {template.isVerified && <span className="text-blue-600">✓</span>}
      </div>

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={() => onPreview(template)}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
        >
          Preview
        </button>
        {isSaved ? (
          <span className="px-4 py-2 bg-green-100 text-green-700 rounded text-sm font-medium">
            ✓ Saved
          </span>
        ) : (
          <button
            onClick={() => onSave(template.id)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
};

const SavedTemplateCard: React.FC<{
  template: SavedTemplate;
  onPreview: (template: Template) => void;
}> = ({ template, onPreview }) => {
  return (
    <div className="bg-white border-2 border-green-200 rounded-lg p-4 hover:shadow-lg transition">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{template.name}</h4>
          <p className="text-xs text-gray-600 mt-1">Saved {new Date(template.savedAt).toLocaleDateString()}</p>
        </div>
        <span className="text-green-600">✓</span>
      </div>

      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {template.customizedContent || template.content}
      </p>

      <button
        onClick={() => onPreview(template)}
        className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
      >
        Use Template
      </button>
    </div>
  );
};

export default TemplateLibraryUI;

