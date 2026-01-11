/**
 * Achievement Display Component
 * 
 * Features:
 * - Grid display of all achievements
 * - Earned vs locked states
 * - Progress tracking
 * - Unlock animations
 * - Category filtering
 * - Points display
 */

import React, { useState, useEffect } from 'react';

interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  icon: string;
  points: number;
  earned: boolean;
  earnedAt?: string;
  seen: boolean;
  progressPercentage?: number;
}

interface AchievementStats {
  earnedPoints: number;
  totalPoints: number;
  earnedCount: number;
  totalCount: number;
}

const TIER_COLORS = {
  bronze: 'from-amber-600 to-amber-800',
  silver: 'from-gray-400 to-gray-600',
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-purple-400 to-purple-600',
  special: 'from-pink-400 to-pink-600',
};

const TIER_GLOW = {
  bronze: 'shadow-amber-500/50',
  silver: 'shadow-gray-500/50',
  gold: 'shadow-yellow-500/50',
  platinum: 'shadow-purple-500/50',
  special: 'shadow-pink-500/50',
};

export const AchievementDisplay: React.FC = () => {
  const [achievements, setAchievements] = useState<Record<string, Achievement[]>>({});
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [newUnlock, setNewUnlock] = useState<Achievement | null>(null);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    setLoading(true);
    try {
      const response = await fetch('/cleaner/achievements', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setAchievements(data.achievements);
      setStats(data.stats);

      // Check for new unseen achievements
      const unseen = Object.values(data.achievements).flat()
        .find((a: Achievement) => a.earned && !a.seen);
      if (unseen) {
        setNewUnlock(unseen);
        setTimeout(() => {
          markAsSeen(unseen.id);
          setNewUnlock(null);
        }, 5000);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsSeen = async (achievementId: string) => {
    try {
      await fetch(`/cleaner/achievements/${achievementId}/mark-seen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Error marking achievement:', error);
    }
  };

  const categories = ['all', ...Object.keys(achievements)];

  const filteredAchievements = selectedCategory === 'all'
    ? Object.values(achievements).flat()
    : achievements[selectedCategory] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading achievements...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-4">🏆 Your Achievements</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/20 backdrop-blur rounded-lg p-4">
            <div className="text-3xl font-bold">{stats?.earnedCount}</div>
            <div className="text-sm opacity-90">Earned</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-lg p-4">
            <div className="text-3xl font-bold">{stats?.totalCount}</div>
            <div className="text-sm opacity-90">Total</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-lg p-4">
            <div className="text-3xl font-bold">{stats?.earnedPoints}</div>
            <div className="text-sm opacity-90">Points Earned</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-lg p-4">
            <div className="text-3xl font-bold">
              {stats ? Math.round((stats.earnedCount / stats.totalCount) * 100) : 0}%
            </div>
            <div className="text-sm opacity-90">Complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ 
                width: `${stats ? (stats.earnedPoints / stats.totalPoints) * 100 : 0}%` 
              }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1 opacity-90">
            <span>{stats?.earnedPoints} / {stats?.totalPoints} points</span>
            <span>Keep going!</span>
          </div>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
            {category !== 'all' && achievements[category] && (
              <span className="ml-2 text-xs opacity-75">
                ({achievements[category].filter(a => a.earned).length}/{achievements[category].length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>

      {/* New Unlock Animation */}
      {newUnlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md mx-4 animate-scale-in">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-bounce">{newUnlock.icon}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Achievement Unlocked!
              </h3>
              <h4 className="text-xl font-semibold text-blue-600 mb-2">
                {newUnlock.name}
              </h4>
              <p className="text-gray-600 mb-4">{newUnlock.description}</p>
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full font-bold">
                <span>+{newUnlock.points} points</span>
                <span className="text-2xl">🎉</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AchievementCard: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  const tierColor = TIER_COLORS[achievement.tier as keyof typeof TIER_COLORS] || TIER_COLORS.bronze;
  const tierGlow = TIER_GLOW[achievement.tier as keyof typeof TIER_GLOW] || TIER_GLOW.bronze;

  return (
    <div
      className={`relative rounded-lg p-6 transition-all duration-300 ${
        achievement.earned
          ? `bg-gradient-to-br ${tierColor} text-white shadow-lg ${tierGlow} hover:scale-105`
          : 'bg-gray-100 text-gray-400 opacity-60 hover:opacity-80'
      }`}
    >
      {/* Tier Badge */}
      <div className="absolute top-2 right-2">
        <span className={`text-xs px-2 py-1 rounded-full ${
          achievement.earned 
            ? 'bg-white/30 text-white' 
            : 'bg-gray-300 text-gray-600'
        }`}>
          {achievement.tier.toUpperCase()}
        </span>
      </div>

      {/* Icon */}
      <div className={`text-5xl mb-3 ${achievement.earned ? 'filter-none' : 'grayscale'}`}>
        {achievement.earned ? achievement.icon : '🔒'}
      </div>

      {/* Name */}
      <h3 className={`text-lg font-bold mb-2 ${
        achievement.earned ? 'text-white' : 'text-gray-600'
      }`}>
        {achievement.name}
      </h3>

      {/* Description */}
      <p className={`text-sm mb-4 ${
        achievement.earned ? 'text-white/90' : 'text-gray-500'
      }`}>
        {achievement.description}
      </p>

      {/* Points */}
      <div className="flex items-center justify-between">
        <span className={`font-bold ${
          achievement.earned ? 'text-white' : 'text-gray-600'
        }`}>
          {achievement.points} pts
        </span>
        
        {achievement.earned && achievement.earnedAt && (
          <span className="text-xs text-white/70">
            {new Date(achievement.earnedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Progress Bar (for in-progress achievements) */}
      {!achievement.earned && achievement.progressPercentage !== undefined && (
        <div className="mt-3">
          <div className="h-2 bg-gray-300 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${achievement.progressPercentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 mt-1 text-center">
            {achievement.progressPercentage}% complete
          </div>
        </div>
      )}

      {/* Locked Overlay */}
      {!achievement.earned && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 rounded-lg">
          <div className="text-4xl">🔒</div>
        </div>
      )}
    </div>
  );
};

export default AchievementDisplay;

