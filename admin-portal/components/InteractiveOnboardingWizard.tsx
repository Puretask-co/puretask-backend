/**
 * Interactive Onboarding Wizard Component
 * 
 * Features:
 * - Multi-step wizard with progress bar
 * - Real-time progress tracking
 * - Achievement unlocks
 * - Profile completion percentage
 * - Animated transitions
 */

import React, { useState, useEffect } from 'react';

interface OnboardingProgress {
  completionPercentage: number;
  wizardCompleted: boolean;
  currentStep: number;
  photoUploaded: boolean;
  bioCompleted: boolean;
  servicesDefined: boolean;
  availabilitySet: boolean;
  pricingConfigured: boolean;
  aiPersonalitySet: boolean;
  templatesCustomized: number;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: string;
  requiredFields: string[];
  points: number;
}

const ONBOARDING_STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to PureTask!',
    description: 'Let\'s get you set up for success',
    icon: '👋',
    requiredFields: [],
    points: 0,
  },
  {
    id: 'profile',
    title: 'Complete Your Profile',
    description: 'Help clients get to know you',
    icon: '👤',
    requiredFields: ['photoUploaded', 'bioCompleted'],
    points: 20,
  },
  {
    id: 'services',
    title: 'Define Your Services',
    description: 'What cleaning services do you offer?',
    icon: '🧹',
    requiredFields: ['servicesDefined', 'pricingConfigured'],
    points: 20,
  },
  {
    id: 'availability',
    title: 'Set Your Availability',
    description: 'When are you available to clean?',
    icon: '📅',
    requiredFields: ['availabilitySet'],
    points: 15,
  },
  {
    id: 'ai_setup',
    title: 'Configure Your AI Assistant',
    description: 'Let AI help you grow your business',
    icon: '🤖',
    requiredFields: ['aiPersonalitySet'],
    points: 25,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start accepting bookings',
    icon: '🎉',
    requiredFields: [],
    points: 20,
  },
];

export const InteractiveOnboardingWizard: React.FC = () => {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newAchievements, setNewAchievements] = useState<any[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      const response = await fetch('/cleaner/onboarding/progress', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setProgress(data);
      setCurrentStep(data.currentStep || 0);
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (updates: Partial<OnboardingProgress>) => {
    try {
      await fetch('/cleaner/onboarding/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      
      // Check for new achievements
      const achievementsRes = await fetch('/cleaner/achievements', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const achievementsData = await achievementsRes.json();
      const unseen = Object.values(achievementsData.achievements).flat()
        .filter((a: any) => a.earned && !a.seen);
      
      if (unseen.length > 0) {
        setNewAchievements(unseen);
        setTimeout(() => setNewAchievements([]), 5000);
      }

      fetchProgress();
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const nextStep = async () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      await updateProgress({ setup_wizard_step: newStep });

      if (newStep === ONBOARDING_STEPS.length - 1) {
        await updateProgress({ setup_wizard_completed: true });
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isStepComplete = (step: Step): boolean => {
    if (!progress || step.requiredFields.length === 0) return true;
    return step.requiredFields.every((field: string) => progress[field as keyof OnboardingProgress]);
  };

  const getTotalPoints = (): number => {
    let total = 0;
    for (let i = 0; i <= currentStep && i < ONBOARDING_STEPS.length; i++) {
      if (isStepComplete(ONBOARDING_STEPS[i])) {
        total += ONBOARDING_STEPS[i].points;
      }
    }
    return total;
  };

  const renderStepContent = () => {
    const step = ONBOARDING_STEPS[currentStep];

    switch (step.id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="text-6xl mb-4">{step.icon}</div>
            <h2 className="text-3xl font-bold text-gray-900">Welcome to PureTask!</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We're excited to have you! Let's take just 5 minutes to set up your profile and AI Assistant. 
              You'll be ready to accept bookings in no time!
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="font-semibold text-blue-900 mb-2">What you'll get:</h3>
              <ul className="text-left text-blue-800 space-y-2">
                <li>✅ AI Assistant to automate messaging</li>
                <li>✅ Professional profile that attracts clients</li>
                <li>✅ Easy booking management</li>
                <li>✅ Achievement badges & certifications</li>
              </ul>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-3">{step.icon}</div>
              <h2 className="text-2xl font-bold text-gray-900">{step.title}</h2>
              <p className="text-gray-600 mt-2">{step.description}</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <div className={`border-2 rounded-lg p-4 ${progress?.photoUploaded ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Profile Photo</h3>
                    <p className="text-sm text-gray-600">Upload a professional photo</p>
                  </div>
                  {progress?.photoUploaded ? (
                    <span className="text-green-600 text-2xl">✓</span>
                  ) : (
                    <button 
                      onClick={() => updateProgress({ profile_photo_uploaded: true })}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Upload Photo
                    </button>
                  )}
                </div>
              </div>

              <div className={`border-2 rounded-lg p-4 ${progress?.bioCompleted ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">About You</h3>
                    <p className="text-sm text-gray-600">Tell clients about yourself</p>
                  </div>
                  {progress?.bioCompleted ? (
                    <span className="text-green-600 text-2xl">✓</span>
                  ) : (
                    <button 
                      onClick={() => updateProgress({ bio_completed: true })}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Complete Bio
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'services':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-3">{step.icon}</div>
              <h2 className="text-2xl font-bold text-gray-900">{step.title}</h2>
              <p className="text-gray-600 mt-2">{step.description}</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <div className={`border-2 rounded-lg p-4 ${progress?.servicesDefined ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Services Offered</h3>
                    <p className="text-sm text-gray-600">Define what you clean</p>
                  </div>
                  {progress?.servicesDefined ? (
                    <span className="text-green-600 text-2xl">✓</span>
                  ) : (
                    <button 
                      onClick={() => updateProgress({ services_defined: true })}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add Services
                    </button>
                  )}
                </div>
              </div>

              <div className={`border-2 rounded-lg p-4 ${progress?.pricingConfigured ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Pricing</h3>
                    <p className="text-sm text-gray-600">Set your rates</p>
                  </div>
                  {progress?.pricingConfigured ? (
                    <span className="text-green-600 text-2xl">✓</span>
                  ) : (
                    <button 
                      onClick={() => updateProgress({ pricing_configured: true })}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Set Pricing
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'availability':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-3">{step.icon}</div>
              <h2 className="text-2xl font-bold text-gray-900">{step.title}</h2>
              <p className="text-gray-600 mt-2">{step.description}</p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className={`border-2 rounded-lg p-6 ${progress?.availabilitySet ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                <div className="text-center">
                  <h3 className="font-semibold text-gray-900 mb-2">Set Your Schedule</h3>
                  <p className="text-sm text-gray-600 mb-4">Let clients know when you're available</p>
                  {progress?.availabilitySet ? (
                    <span className="text-green-600 text-3xl">✓</span>
                  ) : (
                    <button 
                      onClick={() => updateProgress({ availability_set: true })}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Configure Availability
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'ai_setup':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-3">{step.icon}</div>
              <h2 className="text-2xl font-bold text-gray-900">{step.title}</h2>
              <p className="text-gray-600 mt-2">{step.description}</p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6">
                <h3 className="font-semibold text-purple-900 mb-3">🚀 AI Assistant Benefits:</h3>
                <ul className="space-y-2 text-purple-800 mb-6">
                  <li>✅ Respond to clients instantly (even while cleaning)</li>
                  <li>✅ Save 5-10 hours per week</li>
                  <li>✅ Never miss a booking opportunity</li>
                  <li>✅ Increase booking rate by 40%</li>
                </ul>
                {progress?.aiPersonalitySet ? (
                  <div className="text-center">
                    <span className="text-green-600 text-3xl">✓</span>
                    <p className="text-green-700 font-semibold mt-2">AI Assistant Configured!</p>
                  </div>
                ) : (
                  <button 
                    onClick={() => updateProgress({ ai_personality_set: true })}
                    className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-semibold"
                  >
                    Set Up AI Assistant
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="text-6xl mb-4 animate-bounce">{step.icon}</div>
            <h2 className="text-3xl font-bold text-gray-900">Congratulations!</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              You've completed your onboarding! You're now ready to accept bookings and grow your cleaning business.
            </p>
            
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="font-semibold text-green-900 mb-4">You've Earned:</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-green-800">🏆 Points Earned</span>
                  <span className="font-bold text-green-900">{getTotalPoints()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-800">✅ Profile Complete</span>
                  <span className="font-bold text-green-900">{progress?.completionPercentage}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-800">🎓 Certification</span>
                  <span className="font-bold text-green-900">Beginner</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 font-semibold text-lg"
            >
              Go to Dashboard →
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Getting Started</h1>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Progress:</span>
              <span className="font-bold text-blue-600">{Math.round((currentStep / (ONBOARDING_STEPS.length - 1)) * 100)}%</span>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="relative">
            <div className="h-2 bg-gray-200 rounded-full">
              <div 
                className="h-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${(currentStep / (ONBOARDING_STEPS.length - 1)) * 100}%` }}
              />
            </div>
            
            {/* Step Indicators */}
            <div className="flex justify-between mt-4">
              {ONBOARDING_STEPS.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all ${
                      index < currentStep 
                        ? 'bg-green-500 text-white' 
                        : index === currentStep 
                        ? 'bg-blue-600 text-white scale-110' 
                        : 'bg-gray-300 text-gray-500'
                    }`}
                  >
                    {index < currentStep ? '✓' : step.icon}
                  </div>
                  <span className={`text-xs mt-2 text-center ${index === currentStep ? 'font-bold text-blue-600' : 'text-gray-600'}`}>
                    {step.title.substring(0, 15)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          
          <div className="text-center">
            <div className="text-sm text-gray-600">Step {currentStep + 1} of {ONBOARDING_STEPS.length}</div>
            <div className="text-lg font-bold text-blue-600">+{ONBOARDING_STEPS[currentStep].points} points</div>
          </div>

          {currentStep < ONBOARDING_STEPS.length - 1 ? (
            <button
              onClick={nextStep}
              disabled={!isStepComplete(ONBOARDING_STEPS[currentStep])}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              Finish →
            </button>
          )}
        </div>
      </div>

      {/* Achievement Notification */}
      {newAchievements.length > 0 && (
        <div className="fixed bottom-4 right-4 space-y-2 z-50">
          {newAchievements.map((achievement: any) => (
            <div 
              key={achievement.id}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-4 rounded-lg shadow-lg animate-bounce"
            >
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{achievement.icon}</span>
                <div>
                  <div className="font-bold">Achievement Unlocked!</div>
                  <div className="text-sm">{achievement.name}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Celebration Animation */}
      {showCelebration && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-9xl animate-ping">🎉</div>
        </div>
      )}
    </div>
  );
};

export default InteractiveOnboardingWizard;

