/**
 * Template Creator & Editor Component
 * 
 * Features:
 * - Rich template editor with variable insertion
 * - Live preview with variable substitution
 * - Save to personal collection
 * - Publish to marketplace
 * - Apply template directly
 * - Template metadata management
 * - Category and tag selection
 * - Variable picker
 * - Character count
 * - Template testing
 */

import React, { useState, useEffect } from 'react';

interface Variable {
  key: string;
  label: string;
  description: string;
  example: string;
}

interface Template {
  id?: string;
  templateType: string;
  templateName: string;
  templateContent: string;
  variables: string[];
  category: string;
  subcategory?: string;
  description: string;
  tags: string[];
}

const AVAILABLE_VARIABLES: Variable[] = [
  { key: 'client_name', label: 'Client Name', description: 'The client\'s first name', example: 'John' },
  { key: 'client_full_name', label: 'Client Full Name', description: 'The client\'s full name', example: 'John Smith' },
  { key: 'cleaner_name', label: 'Your Name', description: 'Your first name', example: 'Sarah' },
  { key: 'cleaner_full_name', label: 'Your Full Name', description: 'Your full name', example: 'Sarah Johnson' },
  { key: 'date', label: 'Date', description: 'Booking date', example: 'January 15, 2025' },
  { key: 'time', label: 'Time', description: 'Booking time', example: '2:00 PM' },
  { key: 'property_type', label: 'Property Type', description: 'Type of property', example: 'apartment' },
  { key: 'property_address', label: 'Address', description: 'Property address', example: '123 Main St' },
  { key: 'service_type', label: 'Service Type', description: 'Type of cleaning service', example: 'Deep Clean' },
  { key: 'duration', label: 'Duration', description: 'Service duration', example: '3 hours' },
  { key: 'price', label: 'Price', description: 'Service price', example: '$150' },
  { key: 'booking_id', label: 'Booking ID', description: 'Unique booking number', example: '#BK-12345' },
  { key: 'special_instructions', label: 'Special Instructions', description: 'Client\'s special requests', example: 'Please use eco-friendly products' },
  { key: 'services_performed', label: 'Services Performed', description: 'List of completed services', example: 'Kitchen, bathrooms, bedrooms' },
  { key: 'payment_method', label: 'Payment Method', description: 'How client will pay', example: 'Credit Card' },
  { key: 'next_booking_date', label: 'Next Booking', description: 'Next scheduled date', example: 'February 15, 2025' },
];

const TEMPLATE_TYPES = [
  { value: 'booking_confirmation', label: 'Booking Confirmation' },
  { value: 'reminder', label: 'Booking Reminder' },
  { value: 'running_late', label: 'Running Late' },
  { value: 'on_the_way', label: 'On The Way' },
  { value: 'job_complete', label: 'Job Complete' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'review_request', label: 'Review Request' },
  { value: 'thank_you', label: 'Thank You' },
  { value: 'reschedule', label: 'Reschedule Request' },
  { value: 'cancellation', label: 'Cancellation' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'special_offer', label: 'Special Offer' },
  { value: 'holiday_greeting', label: 'Holiday Greeting' },
  { value: 'custom', label: 'Custom' },
];

const CATEGORIES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'general', label: 'General' },
];

const SUGGESTED_TAGS = [
  'professional', 'friendly', 'formal', 'casual', 'urgent', 
  'detailed', 'brief', 'warm', 'enthusiastic', 'polite',
  'reminder', 'confirmation', 'follow-up', 'thank-you', 'apology'
];

export const TemplateCreator: React.FC = () => {
  // Template Data
  const [templateType, setTemplateType] = useState('booking_confirmation');
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [subcategory, setSubcategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');

  // UI State
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Preview Data
  const [previewData, setPreviewData] = useState<Record<string, string>>({
    client_name: 'John',
    client_full_name: 'John Smith',
    cleaner_name: 'Sarah',
    cleaner_full_name: 'Sarah Johnson',
    date: 'January 15, 2025',
    time: '2:00 PM',
    property_type: 'apartment',
    property_address: '123 Main St, Apt 4B',
    service_type: 'Deep Clean',
    duration: '3 hours',
    price: '$150',
    booking_id: '#BK-12345',
    special_instructions: 'Please use eco-friendly products',
    services_performed: 'Kitchen, 2 bathrooms, 2 bedrooms, living room',
    payment_method: 'Credit Card',
    next_booking_date: 'February 15, 2025',
  });

  // Detect variables in template
  const detectedVariables = React.useMemo(() => {
    const regex = /\{([^}]+)\}/g;
    const matches = [...templateContent.matchAll(regex)];
    return [...new Set(matches.map(m => m[1]))];
  }, [templateContent]);

  // Insert variable at cursor position
  const insertVariable = (variableKey: string) => {
    const before = templateContent.substring(0, cursorPosition);
    const after = templateContent.substring(cursorPosition);
    const newContent = `${before}{${variableKey}}${after}`;
    setTemplateContent(newContent);
    setCursorPosition(before.length + variableKey.length + 2);
    setShowVariablePicker(false);
  };

  // Generate preview with variable substitution
  const generatePreview = () => {
    let preview = templateContent;
    detectedVariables.forEach(variable => {
      const value = previewData[variable] || `{${variable}}`;
      preview = preview.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
    });
    return preview;
  };

  // Add tag
  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setCustomTag('');
    }
  };

  // Remove tag
  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // Save to personal collection
  const saveToPersonal = async () => {
    if (!templateName || !templateContent) {
      alert('Please provide a template name and content');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/cleaner/ai/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          template_type: templateType,
          template_name: templateName,
          template_content: templateContent,
          variables: detectedVariables,
          is_active: true,
        })
      });

      if (response.ok) {
        alert('✅ Template saved to your collection!');
        // Update onboarding progress
        await fetch('/cleaner/onboarding/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            created_custom_template: true,
            templates_customized: 1,
          })
        });
      } else {
        throw new Error('Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('❌ Failed to save template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Publish to marketplace
  const publishToMarketplace = async () => {
    if (!templateName || !templateContent || !description) {
      alert('Please provide template name, content, and description');
      return;
    }

    if (tags.length === 0) {
      alert('Please add at least one tag');
      return;
    }

    setPublishing(true);
    try {
      // First save to personal collection
      await saveToPersonal();

      // Then publish to marketplace (admin API would handle this)
      const response = await fetch('/template-library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          template_type: templateType,
          template_name: templateName,
          template_content: templateContent,
          variables: detectedVariables,
          category,
          subcategory,
          description,
          tags,
        })
      });

      if (response.ok) {
        alert('🎉 Template published to marketplace! It will be reviewed by our team.');
        resetForm();
      } else {
        throw new Error('Failed to publish template');
      }
    } catch (error) {
      console.error('Error publishing template:', error);
      alert('❌ Failed to publish template. You can still use it personally.');
    } finally {
      setPublishing(false);
    }
  };

  // Apply template (use immediately)
  const applyTemplate = () => {
    if (!templateContent) {
      alert('Please create a template first');
      return;
    }

    const preview = generatePreview();
    // Copy to clipboard
    navigator.clipboard.writeText(preview).then(() => {
      alert('✅ Template copied to clipboard! Paste it in your message.');
    }).catch(() => {
      alert('Template preview:\n\n' + preview);
    });
  };

  // Reset form
  const resetForm = () => {
    setTemplateType('booking_confirmation');
    setTemplateName('');
    setTemplateContent('');
    setDescription('');
    setCategory('general');
    setSubcategory('');
    setTags([]);
  };

  // Load template examples
  const loadExample = () => {
    const examples: Record<string, { name: string; content: string; description: string }> = {
      booking_confirmation: {
        name: 'Friendly Booking Confirmation',
        content: 'Hi {client_name}! 🎉 Great news - your {service_type} is confirmed for {date} at {time}! I\'ll arrive at {property_address} with all professional supplies. Looking forward to making your {property_type} sparkle! If you have any questions, just let me know. See you soon! - {cleaner_name}',
        description: 'A warm and enthusiastic booking confirmation that makes clients feel welcome'
      },
      review_request: {
        name: 'Heartfelt Review Request',
        content: 'Hi {client_name}! ❤️ I hope you\'re loving your freshly cleaned {property_type}! Your feedback means the world to me as a small business owner. If you were happy with my {service_type}, would you mind taking 30 seconds to leave a quick review? It truly makes a huge difference! Thank you so much for your support! 🙏 - {cleaner_name}',
        description: 'Emotional and compelling review request with high conversion rate'
      },
      job_complete: {
        name: 'Detailed Completion Report',
        content: 'Hi {client_name}! ✨ Your cleaning is complete! Here\'s what I did today: {services_performed}. Total time: {duration}. Your {property_type} looks amazing! Please inspect and let me know if anything needs attention. It was a pleasure serving you today! - {cleaner_name}',
        description: 'Professional completion message with service summary'
      },
    };

    const example = examples[templateType];
    if (example) {
      setTemplateName(example.name);
      setTemplateContent(example.content);
      setDescription(example.description);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-3xl font-bold mb-2">✨ Template Creator</h2>
        <p className="text-lg opacity-90">
          Create custom message templates for your cleaning business
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Type & Name */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Template Details</h3>
              <button
                onClick={loadExample}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                📖 Load Example
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Type *
                </label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {TEMPLATE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Warm Welcome Confirmation"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of when to use this template"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subcategory (Optional)
                </label>
                <input
                  type="text"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="e.g., Move-in/Move-out"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Template Editor */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Template Content *</h3>
              <button
                onClick={() => setShowVariablePicker(!showVariablePicker)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                + Insert Variable
              </button>
            </div>

            <div className="relative">
              <textarea
                value={templateContent}
                onChange={(e) => {
                  setTemplateContent(e.target.value);
                  setCursorPosition(e.target.selectionStart);
                }}
                onSelect={(e: any) => setCursorPosition(e.target.selectionStart)}
                rows={12}
                placeholder="Type your message here... Use {variable_name} for dynamic content.

Example:
Hi {client_name}! Your {service_type} is confirmed for {date} at {time}. Looking forward to cleaning your {property_type}! - {cleaner_name}"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
              
              {/* Character Count */}
              <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white px-2 py-1 rounded">
                {templateContent.length} characters
                {templateContent.length > 1000 && (
                  <span className="text-orange-600 ml-2">⚠️ Long message</span>
                )}
              </div>
            </div>

            {/* Variable Picker Dropdown */}
            {showVariablePicker && (
              <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50 max-h-96 overflow-y-auto">
                <h4 className="font-semibold text-gray-900 mb-3">Click to Insert Variable:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {AVAILABLE_VARIABLES.map(variable => (
                    <button
                      key={variable.key}
                      onClick={() => insertVariable(variable.key)}
                      className="text-left p-3 bg-white border border-gray-300 rounded-lg hover:bg-blue-100 hover:border-blue-500 transition"
                    >
                      <div className="font-medium text-gray-900 text-sm">
                        {`{${variable.key}}`}
                      </div>
                      <div className="text-xs text-gray-600">{variable.label}</div>
                      <div className="text-xs text-gray-500 italic mt-1">
                        Ex: {variable.example}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Detected Variables */}
            {detectedVariables.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">
                  ✓ Detected Variables ({detectedVariables.length}):
                </h4>
                <div className="flex flex-wrap gap-2">
                  {detectedVariables.map(variable => (
                    <code key={variable} className="px-3 py-1 bg-white text-green-700 rounded-full text-sm border border-green-300">
                      {`{${variable}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-900">Tags (Optional)</h3>
            
            {/* Selected Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-2 text-blue-500 hover:text-blue-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Suggested Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suggested Tags:
              </label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TAGS.filter(tag => !tags.includes(tag)).map(tag => (
                  <button
                    key={tag}
                    onClick={() => addTag(tag)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Tag Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag(customTag)}
                placeholder="Add custom tag..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => addTag(customTag)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Add
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={saveToPersonal}
                disabled={saving || !templateName || !templateContent}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? '💾 Saving...' : '💾 Save to My Collection'}
              </button>

              <button
                onClick={publishToMarketplace}
                disabled={publishing || !templateName || !templateContent || !description}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {publishing ? '🌍 Publishing...' : '🌍 Publish to Marketplace'}
              </button>

              <button
                onClick={applyTemplate}
                disabled={!templateContent}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                📋 Copy & Use Now
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-3 text-center">
              💡 Tip: Save to your collection first, then publish to share with others!
            </p>
          </div>
        </div>

        {/* Preview Panel - Right Side */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">📱 Preview</h3>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {showPreview ? 'Hide' : 'Show'}
              </button>
            </div>

            {showPreview && (
              <>
                <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 min-h-[200px]">
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {generatePreview() || (
                      <span className="text-gray-400 italic">
                        Your template preview will appear here...
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit Preview Data */}
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                    🔧 Edit Preview Data
                  </summary>
                  <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                    {detectedVariables.map(variable => (
                      <div key={variable}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {variable}:
                        </label>
                        <input
                          type="text"
                          value={previewData[variable] || ''}
                          onChange={(e) => setPreviewData({
                            ...previewData,
                            [variable]: e.target.value
                          })}
                          className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </details>
              </>
            )}

            {/* Quick Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <h4 className="font-semibold text-blue-900 mb-2">💡 Quick Tips:</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>✓ Use {`{variables}`} for dynamic content</li>
                <li>✓ Keep messages under 1000 characters</li>
                <li>✓ Be professional yet friendly</li>
                <li>✓ Include a clear call-to-action</li>
                <li>✓ Test with preview before saving</li>
                <li>✓ Add relevant tags for discoverability</li>
              </ul>
            </div>

            {/* Template Stats */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">📊 Stats:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Characters:</span>
                  <span className="font-medium">{templateContent.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Variables:</span>
                  <span className="font-medium">{detectedVariables.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tags:</span>
                  <span className="font-medium">{tags.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Words:</span>
                  <span className="font-medium">
                    {templateContent.split(/\s+/).filter(w => w.length > 0).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateCreator;

