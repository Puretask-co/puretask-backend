/**
 * Tooltip System Component
 * 
 * Features:
 * - Contextual tooltips for first-time users
 * - Positioned overlays (top, bottom, left, right)
 * - Sequential tutorial flow
 * - Dismiss functionality
 * - Helpful feedback
 * - Auto-positioning to avoid viewport edges
 */

import React, { useState, useEffect, useRef } from 'react';

interface Tooltip {
  id: string;
  key: string;
  targetElement: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  triggerCondition?: string;
  displayOrder: number;
  category: string;
  dismissed: boolean;
}

interface TooltipSystemProps {
  enabled?: boolean;
  showAll?: boolean; // For demo/preview mode
}

export const TooltipSystem: React.FC<TooltipSystemProps> = ({ 
  enabled = true,
  showAll = false 
}) => {
  const [tooltips, setTooltips] = useState<Tooltip[]>([]);
  const [currentTooltipIndex, setCurrentTooltipIndex] = useState(0);
  const [positions, setPositions] = useState<Record<string, { top: number; left: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (enabled) {
      fetchTooltips();
    }
  }, [enabled]);

  useEffect(() => {
    if (tooltips.length > 0) {
      calculatePositions();
      window.addEventListener('resize', calculatePositions);
      return () => window.removeEventListener('resize', calculatePositions);
    }
  }, [tooltips, currentTooltipIndex]);

  const fetchTooltips = async () => {
    setLoading(true);
    try {
      const response = await fetch('/tooltips', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setTooltips(data.tooltips || []);
    } catch (error) {
      console.error('Error fetching tooltips:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePositions = () => {
    const newPositions: Record<string, { top: number; left: number }> = {};

    tooltips.forEach(tooltip => {
      const targetElement = document.querySelector(tooltip.targetElement);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const tooltipWidth = 320;
        const tooltipHeight = 150;
        const offset = 16;

        let top = 0;
        let left = 0;

        switch (tooltip.position) {
          case 'top':
            top = rect.top - tooltipHeight - offset;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case 'bottom':
            top = rect.bottom + offset;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case 'left':
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = rect.left - tooltipWidth - offset;
            break;
          case 'right':
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = rect.right + offset;
            break;
        }

        // Adjust if off-screen
        if (left < 10) left = 10;
        if (left + tooltipWidth > window.innerWidth - 10) {
          left = window.innerWidth - tooltipWidth - 10;
        }
        if (top < 10) top = 10;
        if (top + tooltipHeight > window.innerHeight - 10) {
          top = window.innerHeight - tooltipHeight - 10;
        }

        newPositions[tooltip.id] = { top, left };
      }
    });

    setPositions(newPositions);
  };

  const dismissTooltip = async (tooltipId: string, helpful: boolean) => {
    try {
      await fetch(`/tooltips/${tooltipId}/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ helpful })
      });

      setTooltips(prev => prev.filter(t => t.id !== tooltipId));
      
      if (currentTooltipIndex < tooltips.length - 1) {
        setCurrentTooltipIndex(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error dismissing tooltip:', error);
    }
  };

  const nextTooltip = () => {
    if (currentTooltipIndex < tooltips.length - 1) {
      setCurrentTooltipIndex(prev => prev + 1);
    }
  };

  const prevTooltip = () => {
    if (currentTooltipIndex > 0) {
      setCurrentTooltipIndex(prev => prev - 1);
    }
  };

  const skipTutorial = async () => {
    // Dismiss all tooltips
    for (const tooltip of tooltips) {
      await dismissTooltip(tooltip.id, false);
    }
    setTooltips([]);
  };

  if (!enabled || loading || tooltips.length === 0) {
    return null;
  }

  const currentTooltip = tooltips[currentTooltipIndex];
  const position = positions[currentTooltip?.id];

  if (!currentTooltip || !position) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" />

      {/* Spotlight on target element */}
      {(() => {
        const targetElement = document.querySelector(currentTooltip.targetElement);
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          return (
            <div
              className="fixed z-40 pointer-events-none"
              style={{
                top: rect.top - 4,
                left: rect.left - 4,
                width: rect.width + 8,
                height: rect.height + 8,
                boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
                borderRadius: '8px',
              }}
            />
          );
        }
        return null;
      })()}

      {/* Tooltip Card */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-2xl p-6 max-w-sm animate-scale-in"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: '320px',
        }}
      >
        {/* Progress indicator */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 rounded-t-lg overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((currentTooltipIndex + 1) / tooltips.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-900">{currentTooltip.title}</h3>
            <span className="text-xs text-gray-500">
              {currentTooltipIndex + 1}/{tooltips.length}
            </span>
          </div>
          <p className="text-sm text-gray-600">{currentTooltip.content}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={skipTutorial}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Skip Tutorial
          </button>
          
          <div className="flex items-center space-x-2">
            {currentTooltipIndex > 0 && (
              <button
                onClick={prevTooltip}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                ← Back
              </button>
            )}
            
            {currentTooltipIndex < tooltips.length - 1 ? (
              <button
                onClick={nextTooltip}
                className="px-4 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => dismissTooltip(currentTooltip.id, true)}
                className="px-4 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Got it! ✓
              </button>
            )}
          </div>
        </div>

        {/* Helpful feedback (on last tooltip) */}
        {currentTooltipIndex === tooltips.length - 1 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 mb-2">Was this tutorial helpful?</p>
            <div className="flex space-x-2">
              <button
                onClick={() => dismissTooltip(currentTooltip.id, true)}
                className="flex-1 px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                👍 Yes
              </button>
              <button
                onClick={() => dismissTooltip(currentTooltip.id, false)}
                className="flex-1 px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                👎 No
              </button>
            </div>
          </div>
        )}

        {/* Arrow pointer */}
        <div
          className={`absolute w-4 h-4 bg-white transform rotate-45 ${
            currentTooltip.position === 'top' ? 'bottom-[-8px] left-1/2 -translate-x-1/2' :
            currentTooltip.position === 'bottom' ? 'top-[-8px] left-1/2 -translate-x-1/2' :
            currentTooltip.position === 'left' ? 'right-[-8px] top-1/2 -translate-y-1/2' :
            'left-[-8px] top-1/2 -translate-y-1/2'
          }`}
        />
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg p-3 text-xs text-gray-600">
        <div className="flex items-center space-x-4">
          <span>Keyboard:</span>
          <span className="px-2 py-1 bg-gray-100 rounded">← →</span>
          <span>Navigate</span>
          <span className="px-2 py-1 bg-gray-100 rounded">ESC</span>
          <span>Skip</span>
        </div>
      </div>
    </>
  );
};

// Wrapper component to manage tooltip system globally
export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showTooltips, setShowTooltips] = useState(false);

  useEffect(() => {
    // Check if user should see tooltips (e.g., first time user, new feature)
    const hasSeenTooltips = localStorage.getItem('tooltips_seen');
    if (!hasSeenTooltips) {
      setShowTooltips(true);
    }
  }, []);

  const handleTooltipsComplete = () => {
    localStorage.setItem('tooltips_seen', 'true');
    setShowTooltips(false);
  };

  return (
    <>
      {children}
      {showTooltips && <TooltipSystem enabled={true} />}
    </>
  );
};

export default TooltipSystem;

