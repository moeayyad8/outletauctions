import { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CountdownTimerProps {
  endTime: Date;
  className?: string;
}

export function CountdownTimer({ endTime, className = '' }: CountdownTimerProps) {
  const calculateTimeLeft = useCallback(() => {
    const difference = endTime.getTime() - new Date().getTime();
    
    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      total: difference,
    };
  }, [endTime]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  const getVariant = () => {
    if (timeLeft.total <= 0) return 'secondary';
    if (timeLeft.total < 3600000) return 'destructive';
    if (timeLeft.total < 86400000) return 'default';
    return 'secondary';
  };

  const formatTime = () => {
    if (timeLeft.total <= 0) return 'Ended';
    if (timeLeft.days > 0) return `${timeLeft.days}d ${timeLeft.hours}h`;
    if (timeLeft.hours > 0) return `${timeLeft.hours}h ${timeLeft.minutes}m`;
    return `${timeLeft.minutes}m ${timeLeft.seconds}s`;
  };

  return (
    <Badge variant={getVariant()} className={`gap-1 ${className}`} data-testid="badge-countdown">
      <Clock className="h-3 w-3" />
      <span className="font-mono text-xs">{formatTime()}</span>
    </Badge>
  );
}
