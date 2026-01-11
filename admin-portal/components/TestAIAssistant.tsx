/**
 * AI Assistant & Template Testing Page
 * 
 * A comprehensive testing interface to preview and test:
 * - AI Assistant settings and behavior
 * - Template rendering with variables
 * - Quick responses
 * - Different scenarios and outputs
 * 
 * Similar to test-notifications page but for AI/Templates
 */

import React, { useState, useEffect } from 'react';

interface AISettings {
  tone: string;
  formality_level: string;
  response_length: string;
  emoji_usage: string;
  auto_reply_enabled: boolean;
  weekend_mode: boolean;
  quiet_hours_enabled: boolean;
}

interface Template {
  id: string;
  template_type: string;
  template_name: string;
  template_content: string;
  variables: string[];
  is_active: boolean;
}

interface QuickResponse {
  id: string;
  trigger_phrase: string;
  response_text: string;
  category: string;
  is_favorite: boolean;
}

export const TestAIAssistant: React.FC = () => {
  // State
  const [aiSettings, setAISettings] = useState<AISettings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [quickResponses, setQuickResponses] = useState<QuickResponse[]>([]);
  const [loading, setLoading] = useState(false);

  // Test Inputs
  const [testScenario, setTestScenario] = useState('booking_inquiry');
  const [testMessage, setTestMessage] = useState('Hi, do you have availability on Friday?');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [testVariables, setTestVariables] = useState<Record<string, string>>({
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

  // Outputs
  const [aiOutput, setAIOutput] = useState('');
  const [templateOutput, setTemplateOutput] = useState('');
  const [matchedQuickResponse, setMatchedQuickResponse] = useState('');

  // Test scenarios
  const scenarios = [
    { value: 'booking_inquiry', label: 'Booking Inquiry', message: 'Hi, do you have availability on Friday?' },
    { value: 'pricing_question', label: 'Pricing Question', message: 'How much do you charge for a 2-bedroom apartment?' },
    { value: 'cancellation', label: 'Cancellation Request', message: 'I need to cancel my booking tomorrow' },
    { value: 'running_late', label: 'Running Late', message: 'Are you still coming? You were supposed to be here 10 minutes ago' },
    { value: 'complaint', label: 'Complaint', message: 'You missed cleaning the bathroom last time' },
    { value: 'praise', label: 'Praise', message: 'Wow, the house looks amazing! Thank you so much!' },
    { value: 'reschedule', label: 'Reschedule', message: 'Can we move my appointment to next week?' },
    { value: 'special_request', label: 'Special Request', message: 'Can you bring your own cleaning supplies? I have allergies' },
  ];

  useEffect(() => {
    loadTestData();
  }, []);

  const loadTestData = async () => {
    setLoading(true);
    try {
      // Try to load from API, but fall back to demo data if it fails
      try {
        const settingsRes = await fetch('/cleaner/ai/settings', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setAISettings(settingsData.settings);
        } else {
          throw new Error('API not available');
        }
      } catch {
        // Use demo AI settings
        setAISettings({
          tone: 'friendly',
          formality_level: 'casual',
          response_length: 'standard',
          emoji_usage: 'occasional',
          auto_reply_enabled: true,
          weekend_mode: false,
          quiet_hours_enabled: true,
        });
      }

      try {
        const templatesRes = await fetch('/cleaner/ai/templates', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          setTemplates(templatesData.templates || []);
        } else {
          throw new Error('API not available');
        }
      } catch {
        // Use demo templates
        setTemplates([
          {
            id: 'demo1',
            template_type: 'booking_confirmation',
            template_name: 'Warm Welcome Confirmation',
            template_content: 'Hi {client_name}! 🎉 Your {service_type} is confirmed for {date} at {time}! Looking forward to it! - {cleaner_name}',
            variables: ['client_name', 'service_type', 'date', 'time', 'cleaner_name'],
            is_active: true,
          },
          {
            id: 'demo2',
            template_type: 'review_request',
            template_name: 'Heartfelt Review Request',
            template_content: 'Hi {client_name}! ❤️ Hope you loved your clean space! Would you mind leaving a quick review? It means the world to me! 🙏',
            variables: ['client_name'],
            is_active: true,
          },
          {
            id: 'demo3',
            template_type: 'job_complete',
            template_name: 'Job Completion',
            template_content: 'Hi {client_name}! ✨ Your cleaning is complete! Services: {services_performed}. Everything looks amazing! - {cleaner_name}',
            variables: ['client_name', 'services_performed', 'cleaner_name'],
            is_active: true,
          },
        ]);
      }

      try {
        const quickRes = await fetch('/cleaner/ai/quick-responses', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (quickRes.ok) {
          const quickData = await quickRes.json();
          setQuickResponses(quickData.responses || []);
        } else {
          throw new Error('API not available');
        }
      } catch {
        // Use demo quick responses
        setQuickResponses([
          {
            id: 'qr1',
            trigger_phrase: 'how much',
            response_text: 'My rates start at $100 for a standard cleaning. Would you like a custom quote?',
            category: 'pricing',
            is_favorite: true,
          },
          {
            id: 'qr2',
            trigger_phrase: 'availability',
            response_text: 'I have availability this week! What day works best for you?',
            category: 'scheduling',
            is_favorite: false,
          },
          {
            id: 'qr3',
            trigger_phrase: 'cancel',
            response_text: 'No problem! I understand. Would you like to reschedule for another time?',
            category: 'cancellation',
            is_favorite: false,
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading test data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate AI response based on settings
  const generateAIResponse = () => {
    if (!aiSettings) return;

    let response = '';

    // Apply tone
    const toneStyles = {
      professional: 'Thank you for your message. ',
      friendly: 'Hi there! ',
      casual: 'Hey! ',
      enthusiastic: 'Hi! So glad to hear from you! ',
    };
    response += toneStyles[aiSettings.tone as keyof typeof toneStyles] || 'Hello, ';

    // Main response based on scenario
    const scenarioResponses: Record<string, string> = {
      booking_inquiry: "I'd be happy to check my availability for Friday. Could you please let me know what time works best for you and what type of cleaning service you need?",
      pricing_question: "For a 2-bedroom apartment, my standard cleaning service is $120 for 2-3 hours. This includes kitchen, bathrooms, bedrooms, living areas, and vacuuming. Would you like to book an appointment?",
      cancellation: "I understand you need to cancel tomorrow's appointment. No problem at all! Would you like to reschedule for another day, or should I simply cancel it?",
      running_late: "I sincerely apologize for running late! I'm currently on my way and should arrive in about 10 minutes. Thank you so much for your patience!",
      complaint: "I'm very sorry to hear that the bathroom wasn't cleaned to your satisfaction. This is not the standard I hold myself to. I'd be happy to come back and take care of it at no additional charge. When would work best for you?",
      praise: "Thank you so much! Your kind words really made my day! It was a pleasure cleaning for you, and I'm thrilled you're happy with the results. Looking forward to next time!",
      reschedule: "Of course! I'd be happy to reschedule to next week. What day and time would work best for you?",
      special_request: "Absolutely! I can bring my own eco-friendly cleaning supplies for clients with allergies. I have a full range of hypoallergenic products. Is there anything specific I should avoid?",
    };
    response += scenarioResponses[testScenario] || "Thanks for your message! I'll get back to you shortly.";

    // Apply formality
    if (aiSettings.formality_level === 'very_formal') {
      response = response.replace(/I'd/g, 'I would').replace(/I'm/g, 'I am');
    }

    // Apply length
    if (aiSettings.response_length === 'brief') {
      response = response.split('.')[0] + '.';
    } else if (aiSettings.response_length === 'detailed') {
      response += ' Please feel free to reach out if you have any other questions or concerns. I\'m here to help!';
    }

    // Apply emojis
    if (aiSettings.emoji_usage === 'frequent') {
      response = response.replace(/!/g, '! 😊').replace(/\?$/g, '? 🤔');
    } else if (aiSettings.emoji_usage === 'occasional') {
      response += ' 😊';
    }

    // Check weekend mode
    if (aiSettings.weekend_mode) {
      response += '\n\n[Weekend Mode: Response delayed until Monday]';
    }

    // Check quiet hours
    if (aiSettings.quiet_hours_enabled) {
      const now = new Date().getHours();
      if (now >= 22 || now < 8) {
        response += '\n\n[Quiet Hours: Response will be sent at 8 AM]';
      }
    }

    // Check auto-reply
    if (!aiSettings.auto_reply_enabled) {
      response = '[Auto-Reply Disabled - Manual response required]\n\nSuggested Response:\n' + response;
    }

    setAIOutput(response);
  };

  // Render template with variables
  const renderTemplate = () => {
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) {
      setTemplateOutput('Please select a template');
      return;
    }

    let output = template.template_content;
    
    // Replace all variables
    Object.keys(testVariables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      output = output.replace(regex, testVariables[key]);
    });

    setTemplateOutput(output);
  };

  // Check for quick response match
  const checkQuickResponse = () => {
    const matched = quickResponses.find(qr => 
      testMessage.toLowerCase().includes(qr.trigger_phrase.toLowerCase())
    );
    
    if (matched) {
      setMatchedQuickResponse(matched.response_text);
    } else {
      setMatchedQuickResponse('No quick response matched');
    }
  };

  // Update test scenario
  const handleScenarioChange = (scenarioValue: string) => {
    setTestScenario(scenarioValue);
    const scenario = scenarios.find(s => s.value === scenarioValue);
    if (scenario) {
      setTestMessage(scenario.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading test environment...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-lg shadow-2xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center">
                🧪 AI Assistant Testing Lab
              </h1>
              <p className="text-xl opacity-90">
                Test and preview AI responses, templates, and quick responses
              </p>
              <div className="mt-4 flex items-center space-x-4">
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                  {templates.length} Templates
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                  {quickResponses.length} Quick Responses
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                  {aiSettings ? '✅ AI Configured' : '⚠️ No Settings'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <button
                onClick={loadTestData}
                className="px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 font-semibold shadow-lg transition-all transform hover:scale-105"
              >
                🔄 Reload All
              </button>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Settings Panel */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-lg p-6 border-2 border-blue-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              🤖 Current AI Settings
              <span className="ml-auto text-xs px-2 py-1 bg-blue-600 text-white rounded-full">
                {aiSettings ? 'Active' : 'None'}
              </span>
            </h2>
            {aiSettings ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                  <span className="text-gray-600 font-medium">Tone:</span>
                  <span className="font-semibold capitalize px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                    {aiSettings.tone}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                  <span className="text-gray-600 font-medium">Formality:</span>
                  <span className="font-semibold capitalize px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
                    {aiSettings.formality_level.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                  <span className="text-gray-600 font-medium">Length:</span>
                  <span className="font-semibold capitalize px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full">
                    {aiSettings.response_length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                  <span className="text-gray-600 font-medium">Emojis:</span>
                  <span className="font-semibold capitalize px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                    {aiSettings.emoji_usage}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                  <span className="text-gray-600 font-medium">Auto-Reply:</span>
                  <span className={`font-semibold px-3 py-1 rounded-full ${aiSettings.auto_reply_enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {aiSettings.auto_reply_enabled ? '✓ ON' : '✗ OFF'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                  <span className="text-gray-600 font-medium">Weekend Mode:</span>
                  <span className={`font-semibold px-3 py-1 rounded-full ${aiSettings.weekend_mode ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                    {aiSettings.weekend_mode ? '✓ ON' : '✗ OFF'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                  <span className="text-gray-600 font-medium">Quiet Hours:</span>
                  <span className={`font-semibold px-3 py-1 rounded-full ${aiSettings.quiet_hours_enabled ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                    {aiSettings.quiet_hours_enabled ? '✓ ON' : '✗ OFF'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-800 text-sm font-medium">⚠️ No AI settings configured</p>
                <p className="text-yellow-600 text-xs mt-1">Configure AI settings to test responses</p>
              </div>
            )}
            <button
              onClick={loadTestData}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md transition-all"
            >
              🔄 Reload Settings
            </button>
          </div>

          {/* Templates Panel */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-lg p-6 border-2 border-green-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              📝 Templates
              <span className="ml-auto text-xs px-2 py-1 bg-green-600 text-white rounded-full">
                {templates.length}
              </span>
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {templates.length > 0 ? (
                templates.map(template => (
                  <div
                    key={template.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all transform hover:scale-102 ${
                      selectedTemplate === template.id
                        ? 'bg-green-600 text-white shadow-lg scale-102'
                        : 'bg-white hover:bg-green-50 border-2 border-green-200'
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className={`font-semibold text-sm ${selectedTemplate === template.id ? 'text-white' : 'text-gray-900'}`}>
                          {template.template_name}
                        </div>
                        <div className={`text-xs mt-1 ${selectedTemplate === template.id ? 'text-green-100' : 'text-gray-600'}`}>
                          {template.template_type.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${selectedTemplate === template.id ? 'bg-white/20' : 'bg-green-100 text-green-800'}`}>
                        {template.variables.length} vars
                      </div>
                    </div>
                    {selectedTemplate === template.id && (
                      <div className="mt-2 text-xs text-white/80">
                        ✓ Selected for testing
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-yellow-800 text-sm font-medium">📭 No templates available</p>
                  <p className="text-yellow-600 text-xs mt-1">Create templates to test them here</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Responses Panel */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-lg p-6 border-2 border-purple-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              ⚡ Quick Responses
              <span className="ml-auto text-xs px-2 py-1 bg-purple-600 text-white rounded-full">
                {quickResponses.length}
              </span>
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {quickResponses.length > 0 ? (
                quickResponses.map(qr => (
                  <div
                    key={qr.id}
                    className="p-3 bg-white border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                        {qr.category}
                      </span>
                      {qr.is_favorite && <span className="text-yellow-500">⭐</span>}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      "{qr.trigger_phrase}"
                    </div>
                    <div className="text-xs text-gray-600 line-clamp-2 bg-gray-50 p-2 rounded">
                      {qr.response_text}
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-yellow-800 text-sm font-medium">📭 No quick responses</p>
                  <p className="text-yellow-600 text-xs mt-1">Add quick responses to test matching</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Testing Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* AI Response Tester */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">🤖 Test AI Response</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Test Scenario:
                  </label>
                  <select
                    value={testScenario}
                    onChange={(e) => handleScenarioChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {scenarios.map(scenario => (
                      <option key={scenario.value} value={scenario.value}>
                        {scenario.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Message:
                  </label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Type a test message from a client..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={generateAIResponse}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold shadow-lg transition-all transform hover:scale-105"
                  >
                    🤖 Generate AI Response
                  </button>
                  <button
                    onClick={checkQuickResponse}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 font-semibold shadow-lg transition-all transform hover:scale-105"
                  >
                    ⚡ Check Quick Response
                  </button>
                </div>
              </div>
            </div>

            {/* Template Tester */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">📝 Test Template</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Template:
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select a template --</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.template_name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTemplate && (
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                    <h4 className="font-semibold text-sm text-gray-900 mb-2">Edit Test Variables:</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {templates.find(t => t.id === selectedTemplate)?.variables.map(variable => (
                        <div key={variable}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {variable}:
                          </label>
                          <input
                            type="text"
                            value={testVariables[variable] || ''}
                            onChange={(e) => setTestVariables({
                              ...testVariables,
                              [variable]: e.target.value
                            })}
                            className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={renderTemplate}
                  disabled={!selectedTemplate}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-semibold shadow-lg transition-all transform hover:scale-105 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:transform-none"
                >
                  📝 Render Template
                </button>
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            {/* AI Response Output */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                💬 AI Response Output
                {aiOutput && (
                  <span className="ml-auto text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                    ✓ Generated
                  </span>
                )}
              </h2>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4 min-h-[200px] shadow-inner">
                {aiOutput ? (
                  <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">{aiOutput}</div>
                ) : (
                  <div className="text-gray-400 italic flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-2">🤖</div>
                      <div>Click "Generate AI Response" to see output...</div>
                    </div>
                  </div>
                )}
              </div>
              {aiOutput && (
                <button
                  onClick={() => navigator.clipboard.writeText(aiOutput)}
                  className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-semibold shadow-md transition-all"
                >
                  📋 Copy to Clipboard
                </button>
              )}
            </div>

            {/* Template Output */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-green-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                📄 Template Output
                {templateOutput && templateOutput !== 'Please select a template' && (
                  <span className="ml-auto text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                    ✓ Rendered
                  </span>
                )}
              </h2>
              <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-4 min-h-[150px] shadow-inner">
                {templateOutput ? (
                  <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">{templateOutput}</div>
                ) : (
                  <div className="text-gray-400 italic flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📝</div>
                      <div>Select a template and click "Render Template"...</div>
                    </div>
                  </div>
                )}
              </div>
              {templateOutput && templateOutput !== 'Please select a template' && (
                <button
                  onClick={() => navigator.clipboard.writeText(templateOutput)}
                  className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 text-sm font-semibold shadow-md transition-all"
                >
                  📋 Copy to Clipboard
                </button>
              )}
            </div>

            {/* Quick Response Output */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-purple-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                ⚡ Quick Response Match
                {matchedQuickResponse && matchedQuickResponse !== 'No quick response matched' && (
                  <span className="ml-auto text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                    ✓ Match Found
                  </span>
                )}
              </h2>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-4 min-h-[100px] shadow-inner">
                {matchedQuickResponse ? (
                  <div className={`font-medium ${matchedQuickResponse === 'No quick response matched' ? 'text-gray-500 italic' : 'text-gray-800'}`}>
                    {matchedQuickResponse}
                  </div>
                ) : (
                  <div className="text-gray-400 italic flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-2">⚡</div>
                      <div>Click "Check Quick Response" to find matches...</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

          {/* Quick Actions */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">⚙️ Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={loadTestData}
              className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-semibold shadow-md transition-all transform hover:scale-105"
            >
              🔄 Refresh All Data
            </button>
            <button
              onClick={() => {
                setAIOutput('');
                setTemplateOutput('');
                setMatchedQuickResponse('');
              }}
              className="px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 text-sm font-semibold shadow-md transition-all transform hover:scale-105"
            >
              🗑️ Clear All Outputs
            </button>
            <button
              onClick={() => {
                setTestMessage('');
                setSelectedTemplate('');
              }}
              className="px-4 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white rounded-lg hover:from-yellow-700 hover:to-yellow-800 text-sm font-semibold shadow-md transition-all transform hover:scale-105"
            >
              ✨ Reset Inputs
            </button>
            <button
              onClick={() => {
                generateAIResponse();
                renderTemplate();
                checkQuickResponse();
              }}
              className="px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 text-sm font-semibold shadow-md transition-all transform hover:scale-105"
            >
              ⚡ Run All Tests
            </button>
          </div>
          
          {/* Info Banner */}
          <div className="mt-4 bg-blue-100 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> Use "Run All Tests" to generate all outputs at once, or test each feature individually above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestAIAssistant;

