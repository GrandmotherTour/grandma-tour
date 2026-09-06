import React, { createContext, useContext, useMemo, useState } from 'react';
import { calculatePreferenceWeights, createEmptySwipeResults } from '../utils/preferences.js';

const JaturipContext = createContext(null);

const defaultUserInput = {
  currentLocation: {
    name: '',
    lat: 37.5445,
    lng: 127.055,
  },
  nextScheduleLocation: {
    name: '',
    lat: 37.5133,
    lng: 127.1002,
  },
  nextScheduleTime: '',
  availableMinutes: 180,
  peopleCount: 2,
  transportMode: 'walk',
};

export function JaturipProvider({ children }) {
  const [userInput, setUserInput] = useState(defaultUserInput);
  const [swipeResults, setSwipeResults] = useState(createEmptySwipeResults());
  const [recommendationResult, setRecommendationResult] = useState(null);
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(0);

  const preferenceWeights = useMemo(() => calculatePreferenceWeights(swipeResults), [swipeResults]);

  const updateUserInput = (patch) => {
    setUserInput((current) => ({
      ...current,
      ...patch,
    }));
  };

  const updateLocation = (key, location) => {
    setUserInput((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...location,
      },
    }));
  };

  const recordSwipe = (tag, action) => {
    setSwipeResults((current) => {
      const existing = current[tag];
      const next = {
        ...existing,
        exposureCount: existing.exposureCount + 1,
      };

      if (action === 'like') next.likeCount += 1;
      if (action === 'dislike') next.dislikeCount += 1;
      if (action === 'skip') next.skipCount += 1;

      return {
        ...current,
        [tag]: next,
      };
    });
  };

  const resetFlow = () => {
    setSwipeResults(createEmptySwipeResults());
    setRecommendationResult(null);
    setSelectedCourseIndex(0);
  };

  const value = {
    userInput,
    updateUserInput,
    updateLocation,
    swipeResults,
    recordSwipe,
    preferenceWeights,
    recommendationResult,
    setRecommendationResult,
    selectedCourseIndex,
    setSelectedCourseIndex,
    resetFlow,
  };

  return <JaturipContext.Provider value={value}>{children}</JaturipContext.Provider>;
}

export function useJaturip() {
  const context = useContext(JaturipContext);
  if (!context) {
    throw new Error('useJaturip must be used inside JaturipProvider');
  }
  return context;
}
