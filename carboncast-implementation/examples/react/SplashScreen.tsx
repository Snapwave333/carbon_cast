import "./splash-screen.css";

export interface SplashScreenProps {
  stage?: string;
  progress?: number;
}

export function SplashScreen({
  stage = "Loading channel sources",
  progress = 0,
}: SplashScreenProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <main className="cc-splash" aria-label="CarbonCast IPTV is starting">
      <img className="cc-splash__logo" src="/branding/logos/logo-stacked-dark.svg" alt="CarbonCast IPTV" />
      <div className="cc-splash__status" aria-live="polite">{stage}</div>
      <div className="cc-splash__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress}>
        <span style={{ width: `${safeProgress}%` }} />
      </div>
    </main>
  );
}
