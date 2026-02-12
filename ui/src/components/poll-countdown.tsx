"use client";

import React, { useEffect, useState } from "react";

interface PollCountdownProps {
  pollInterval: number;
  lastUpdatedAt: number | Date | null;
}

export function PollCountdown({ pollInterval, lastUpdatedAt }: PollCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(pollInterval);

  useEffect(() => {
    if (!lastUpdatedAt || pollInterval <= 0) return;

    const updateTimeLeft = () => {
        const now = Date.now();
        const lastUpdateTime = lastUpdatedAt instanceof Date ? lastUpdatedAt.getTime() : lastUpdatedAt;
        const elapsed = Math.floor((now - lastUpdateTime) / 1000);
        const remaining = Math.max(0, pollInterval - elapsed);
        setTimeLeft(remaining);
    };

    updateTimeLeft(); // Initial update

    const timer = setInterval(() => {
        updateTimeLeft();
    }, 1000);

    return () => clearInterval(timer);
  }, [pollInterval, lastUpdatedAt]);

  if (pollInterval <= 0 || !lastUpdatedAt) return null;

  return (
    <div>
      Next poll in: {timeLeft}s
    </div>
  );
}
