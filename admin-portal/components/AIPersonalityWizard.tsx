/**
 * AIPersonalityWizard Component
 * 
 * Guided setup wizard for configuring AI Assistant personality and behavior
 */

import React, { useState } from 'react';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: string;
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

interface AIPersonalityWizardProps {
  onComplete: (preferences: Partial<AIPreferences>) => Promise<void>;
  onSkip: () => void;
  initialData?: Partial<AIPreferences>;
}

const STEPS: WizardStep[] = [
  {
    id: 'tone',
    title: 'Communication Tone',
    description: 'How should your AI Assistant communicate with clients?',
    icon: '💬',
  },
  {
    id: 'automation',
    title: 'Automation Level',
    description: 'How much control do you want to give your AI?',
    icon: '🤖',
  },
  {
    id: 'goals',
    title: 'Business Goals',
    description: 'What are your primary objectives?',
    icon: '🎯',
  },
  {
    id: 'review',
    title: 'Review & Confirm',
    description: 'Review your AI personality configuration',
    icon: '✅',
  },
];

export const AIPersonalityWizard: React.FC<AIPersonalityWizardProps> = ({
  onComplete,
  onSkip,
  initialData = {},
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<Partial<AIPreferences>>({
    communicationTone: initialData.communicationTone || 'professional_friendly',
    formalityLevel: initialData.formalityLevel || 3,
    emojiUsage: initialData.emojiUsage || 'moderate',
    responseSpeed: initialData.responseSpeed || 'balanced',
    fullAutomationEnabled: initialData.fullAutomationEnabled || false,
    requireApprovalForBookings: initialData.requireApprovalForBookings ?? true,
    priorityGoal: initialData.priorityGoal || 'balanced',
    targetWeeklyHours: initialData.targetWeeklyHours,
  });
  const [saving, setSaving] = useState(false);

  const updatePreference = (key: keyof AIPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await onComplete(preferences);
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'tone':
        return (
          <div className="space-y-6">
            {/* Communication Tone */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Communication Tone
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'professional', label: 'Professional', desc: 'Formal and business-like', emoji: '👔' },
                  { value: 'friendly', label: 'Friendly', desc: 'Warm and approachable', emoji: '😊' },
                  { value: 'professional_friendly', label: 'Professional & Friendly', desc: 'Best of both worlds', emoji: '🤝' },
                  { value: 'casual', label: 'Casual', desc: 'Relaxed and informal', emoji: '😎' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => updatePreference('communicationTone', option.value)}
                    className={`p-4 border-2 rounded-lg text-left transition ${
                      preferences.communicationTone === option.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-2xl">{option.emoji}</span>
                      <span className="font-semibold text-gray-900">{option.label}</span>
                    </div>
                    <p className="text-sm text-gray-600">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Formality Level */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Formality Level: {preferences.formalityLevel}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={preferences.formalityLevel}
                onChange={(e) => updatePreference('formalityLevel', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Very Casual</span>
                <span>Neutral</span>
                <span>Very Formal</span>
              </div>
            </div>

            {/* Emoji Usage */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Emoji Usage
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { value: 'none', label: 'None', emoji: '🚫' },
                  { value: 'minimal', label: 'Minimal', emoji: '😐' },
                  { value: 'moderate', label: 'Moderate', emoji: '🙂' },
                  { value: 'frequent', label: 'Frequent', emoji: '😄' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => updatePreference('emojiUsage', option.value)}
                    className={`p-3 border-2 rounded-lg text-center transition ${
                      preferences.emojiUsage === option.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{option.emoji}</div>
                    <div className="text-sm font-medium text-gray-900">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'automation':
        return (
          <div className="space-y-6">
            {/* Automation Level */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                How much should your AI do automatically?
              </label>
              <div className="space-y-3">
                {[
                  {
                    level: 'manual',
                    title: 'Manual Mode',
                    desc: 'AI suggests, you approve everything',
                    icon: '✋',
                    settings: { fullAutomationEnabled: false, requireApprovalForBookings: true },
                  },
                  {
                    level: 'assisted',
                    title: 'Assisted Mode (Recommended)',
                    desc: 'AI handles routine tasks, asks for important decisions',
                    icon: '🤝',
                    settings: { fullAutomationEnabled: false, requireApprovalForBookings: true },
                  },
                  {
                    level: 'full',
                    title: 'Full Automation',
                    desc: 'AI handles everything automatically',
                    icon: '🚀',
                    settings: { fullAutomationEnabled: true, requireApprovalForBookings: false },
                  },
                ].map(option => (
                  <button
                    key={option.level}
                    onClick={() => {
                      updatePreference('fullAutomationEnabled', option.settings.fullAutomationEnabled);
                      updatePreference('requireApprovalForBookings', option.settings.requireApprovalForBookings);
                    }}
                    className={`w-full p-4 border-2 rounded-lg text-left transition ${
                      preferences.fullAutomationEnabled === option.settings.fullAutomationEnabled
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-3xl">{option.icon}</span>
                      <div>
                        <div className="font-semibold text-gray-900">{option.title}</div>
                        <p className="text-sm text-gray-600 mt-1">{option.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Response Speed */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Response Speed
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: 'immediate', label: 'Immediate', desc: 'Quick, concise responses', icon: '⚡' },
                  { value: 'balanced', label: 'Balanced', desc: 'Thoughtful but timely', icon: '⚖️' },
                  { value: 'thoughtful', label: 'Thoughtful', desc: 'Detailed, comprehensive', icon: '🧠' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => updatePreference('responseSpeed', option.value)}
                    className={`p-4 border-2 rounded-lg text-center transition ${
                      preferences.responseSpeed === option.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{option.icon}</div>
                    <div className="font-semibold text-gray-900 mb-1">{option.label}</div>
                    <p className="text-xs text-gray-600">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-6">
            {/* Priority Goal */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                What's your primary business goal?
              </label>
              <div className="space-y-3">
                {[
                  {
                    value: 'maximize_bookings',
                    title: 'Maximize Bookings',
                    desc: 'Accept as many jobs as possible, grow fast',
                    icon: '📈',
                  },
                  {
                    value: 'quality_clients',
                    title: 'Quality Clients',
                    desc: 'Focus on high-value, reliable clients',
                    icon: '⭐',
                  },
                  {
                    value: 'balanced',
                    title: 'Balanced Growth',
                    desc: 'Mix of quantity and quality (recommended)',
                    icon: '⚖️',
                  },
                  {
                    value: 'work_life_balance',
                    title: 'Work-Life Balance',
                    desc: 'Respect time boundaries, avoid burnout',
                    icon: '🧘',
                  },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => updatePreference('priorityGoal', option.value)}
                    className={`w-full p-4 border-2 rounded-lg text-left transition ${
                      preferences.priorityGoal === option.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-3xl">{option.icon}</span>
                      <div>
                        <div className="font-semibold text-gray-900">{option.title}</div>
                        <p className="text-sm text-gray-600 mt-1">{option.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Weekly Hours */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Target Weekly Hours (Optional)
              </label>
              <input
                type="number"
                value={preferences.targetWeeklyHours || ''}
                onChange={(e) => updatePreference('targetWeeklyHours', parseInt(e.target.value) || undefined)}
                placeholder="e.g., 30"
                min="0"
                max="168"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                Your AI will help you stay within this target by managing your schedule
              </p>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-900 mb-2">🎉 Your AI Personality is Ready!</h4>
              <p className="text-sm text-blue-800">
                Review your settings below. You can always change these later in settings.
              </p>
            </div>

            {/* Summary Cards */}
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <span>💬</span>
                  <span>Communication Style</span>
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tone:</span>
                    <span className="font-medium capitalize">{preferences.communicationTone?.replace('_', ' & ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Formality:</span>
                    <span className="font-medium">{preferences.formalityLevel}/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Emoji Usage:</span>
                    <span className="font-medium capitalize">{preferences.emojiUsage}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <span>🤖</span>
                  <span>Automation Level</span>
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mode:</span>
                    <span className="font-medium">
                      {preferences.fullAutomationEnabled ? 'Full Automation' : 'Assisted Mode'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Response Speed:</span>
                    <span className="font-medium capitalize">{preferences.responseSpeed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Booking Approval:</span>
                    <span className="font-medium">
                      {preferences.requireApprovalForBookings ? 'Required' : 'Automatic'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <span>🎯</span>
                  <span>Business Goals</span>
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority Goal:</span>
                    <span className="font-medium capitalize">
                      {preferences.priorityGoal?.replace('_', ' ')}
                    </span>
                  </div>
                  {preferences.targetWeeklyHours && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Target Hours:</span>
                      <span className="font-medium">{preferences.targetWeeklyHours} hrs/week</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Personality Setup Wizard
          </h1>
          <p className="text-gray-600">
            Let's configure your AI Assistant in just a few steps!
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 transition ${
                      index === currentStep
                        ? 'bg-blue-600 text-white scale-110'
                        : index < currentStep
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {index < currentStep ? '✓' : step.icon}
                  </div>
                  <div className="text-center">
                    <div className={`text-sm font-medium ${index === currentStep ? 'text-blue-600' : 'text-gray-600'}`}>
                      {step.title}
                    </div>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`h-1 flex-1 mx-2 mb-8 ${index < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {STEPS[currentStep].title}
            </h2>
            <p className="text-gray-600">{STEPS[currentStep].description}</p>
          </div>

          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={onSkip}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            Skip for now
          </button>
          <div className="flex space-x-3">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                ← Back
              </button>
            )}
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={nextStep}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={saving}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : '🎉 Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPersonalityWizard;

