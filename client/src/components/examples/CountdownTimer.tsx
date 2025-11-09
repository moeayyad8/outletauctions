import { CountdownTimer } from '../CountdownTimer';

export default function CountdownTimerExample() {
  const endingSoon = new Date(Date.now() + 30 * 60 * 1000);
  const endingToday = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const endingLater = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  return (
    <div className="p-4 space-y-4 bg-background">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Ending in 30 minutes</p>
        <CountdownTimer endTime={endingSoon} />
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Ending in 5 hours</p>
        <CountdownTimer endTime={endingToday} />
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Ending in 2 days</p>
        <CountdownTimer endTime={endingLater} />
      </div>
    </div>
  );
}
