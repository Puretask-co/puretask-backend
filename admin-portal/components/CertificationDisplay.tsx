/**
 * Certification Display Component
 * 
 * Features:
 * - 4-tier certification program display
 * - Progress tracking for each level
 * - Requirements breakdown
 * - Benefits showcase
 * - Claim certification functionality
 * - Certificate download
 * - Visual progression path
 */

import React, { useState, useEffect } from 'react';

interface Certification {
  id: string;
  key: string;
  name: string;
  description: string;
  level: number;
  icon: string;
  badgeColor: string;
  requirements: Record<string, number>;
  benefits: string[];
  earned: boolean;
  earnedAt?: string;
  expiresAt?: string;
  certificateUrl?: string;
  isActive: boolean;
  progress: number;
  canEarn: boolean;
}

const LEVEL_NAMES = ['', 'Beginner', 'Pro', 'Expert', 'Master'];

export const CertificationDisplay: React.FC = () => {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCertifications();
  }, []);

  const fetchCertifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('/cleaner/certifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setCertifications(data.certifications || []);
      setCurrentLevel(data.currentLevel || 0);
    } catch (error) {
      console.error('Error fetching certifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimCertification = async (certificationId: string) => {
    setClaimingId(certificationId);
    try {
      const response = await fetch(`/cleaner/certifications/${certificationId}/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        alert('🎉 Certification earned! Congratulations!');
        fetchCertifications();
      } else {
        const error = await response.json();
        alert(error.error?.message || 'Requirements not yet met');
      }
    } catch (error) {
      console.error('Error claiming certification:', error);
      alert('Failed to claim certification');
    } finally {
      setClaimingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading certifications...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">🎓 Certification Program</h2>
            <p className="text-lg opacity-90">
              Master the AI Assistant and earn recognized certifications
            </p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold">{currentLevel}</div>
            <div className="text-sm opacity-90">Certifications Earned</div>
          </div>
        </div>
      </div>

      {/* Progression Path */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Your Progression Path</h3>
        
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute top-16 left-0 right-0 h-1 bg-gray-200 z-0" />
          <div 
            className="absolute top-16 left-0 h-1 bg-gradient-to-r from-green-500 to-blue-500 z-10 transition-all duration-500"
            style={{ width: `${(currentLevel / certifications.length) * 100}%` }}
          />
          
          {/* Certification Nodes */}
          <div className="relative z-20 flex justify-between">
            {certifications.map((cert, index) => (
              <div key={cert.id} className="flex flex-col items-center" style={{ width: `${100 / certifications.length}%` }}>
                <div 
                  className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl mb-3 transition-all ${
                    cert.earned 
                      ? 'bg-gradient-to-br from-green-500 to-blue-500 shadow-lg scale-110' 
                      : cert.canEarn
                      ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg animate-pulse'
                      : 'bg-gray-300'
                  }`}
                >
                  {cert.earned ? '✓' : cert.icon}
                </div>
                <div className="text-center">
                  <div className={`font-bold ${cert.earned ? 'text-green-600' : 'text-gray-600'}`}>
                    Level {cert.level}
                  </div>
                  <div className="text-sm text-gray-600">{LEVEL_NAMES[cert.level]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Certification Cards */}
      <div className="space-y-6">
        {certifications.map((cert) => (
          <CertificationCard
            key={cert.id}
            certification={cert}
            onClaim={claimCertification}
            isClaiming={claimingId === cert.id}
          />
        ))}
      </div>

      {/* Benefits Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">💎 Why Get Certified?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🏆</span>
            <div>
              <h4 className="font-semibold text-gray-900">Stand Out</h4>
              <p className="text-sm text-gray-600">Show clients your expertise with official badges</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-2xl">📈</span>
            <div>
              <h4 className="font-semibold text-gray-900">Get More Bookings</h4>
              <p className="text-sm text-gray-600">Certified cleaners get 40% more inquiries</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-2xl">💰</span>
            <div>
              <h4 className="font-semibold text-gray-900">Unlock Benefits</h4>
              <p className="text-sm text-gray-600">Priority support, revenue share, and more</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CertificationCard: React.FC<{
  certification: Certification;
  onClaim: (id: string) => void;
  isClaiming: boolean;
}> = ({ certification, onClaim, isClaiming }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div 
      className={`rounded-lg shadow-lg overflow-hidden transition-all ${
        certification.earned 
          ? 'border-4 border-green-500' 
          : certification.canEarn
          ? 'border-4 border-yellow-500'
          : 'border-2 border-gray-300'
      }`}
    >
      {/* Header */}
      <div 
        className={`p-6 text-white`}
        style={{ background: certification.badgeColor }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-6xl">{certification.icon}</div>
            <div>
              <div className="text-sm opacity-90">Level {certification.level}</div>
              <h3 className="text-2xl font-bold">{certification.name}</h3>
              <p className="text-sm opacity-90 mt-1">{certification.description}</p>
            </div>
          </div>
          
          {certification.earned && (
            <div className="bg-white/20 backdrop-blur rounded-full px-4 py-2 text-sm font-semibold">
              ✓ Earned
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 bg-white">
        {/* Progress Bar */}
        {!certification.earned && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Your Progress</span>
              <span className="text-sm font-bold text-blue-600">{certification.progress}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${certification.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Requirements */}
        <div className="mb-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="font-semibold text-gray-900">📋 Requirements</h4>
            <span className="text-gray-500">{showDetails ? '▼' : '▶'}</span>
          </button>
          
          {showDetails && (
            <div className="mt-3 space-y-2">
              {Object.entries(certification.requirements).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                  <span className="font-medium text-gray-900">{value}+</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Benefits */}
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">✨ Benefits</h4>
          <ul className="space-y-2">
            {certification.benefits.map((benefit, index) => (
              <li key={index} className="flex items-start text-sm text-gray-700">
                <span className="text-green-600 mr-2">✓</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Button */}
        {certification.earned ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-green-900">
                    Earned on {new Date(certification.earnedAt!).toLocaleDateString()}
                  </div>
                  {certification.expiresAt && (
                    <div className="text-sm text-green-700">
                      Expires: {new Date(certification.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {certification.certificateUrl && (
              <a
                href={certification.certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-6 py-3 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 font-semibold"
              >
                📄 Download Certificate
              </a>
            )}
          </div>
        ) : certification.canEarn ? (
          <button
            onClick={() => onClaim(certification.id)}
            disabled={isClaiming}
            className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed animate-pulse"
          >
            {isClaiming ? 'Claiming...' : '🎉 Claim Certification'}
          </button>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-gray-600 mb-2">
              <span className="font-semibold">{certification.progress}%</span> complete
            </div>
            <div className="text-sm text-gray-500">
              Keep using the AI Assistant to unlock this certification
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CertificationDisplay;

