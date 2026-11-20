import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PILOT } from '../lib/pilot';

/**
 * What the server does for every report. The request is a single call with no progress events,
 * so this lists the steps without claiming which one is running; only the elapsed time is live.
 */
const STEPS = [
  'Gather map facts for your pin',
  'Search official sites with Google Search',
  'Open every cited page to check it',
  'Write your email',
];

export function Investigating({ hasPhoto, onCancel }: { hasPhoto: boolean; onCancel: () => void }) {
  const title = PILOT ? 'Writing your email' : 'Finding who fixes it';
  const steps = PILOT
    ? [
        hasPhoto ? 'Read the problem from your photo and note' : 'Read the problem from your note',
        `Check ${PILOT.shortName}’s website for its email address`,
        'Write your email',
      ]
    : STEPS;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    headingRef.current?.focus();
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="investigating" aria-labelledby="investigating-title" aria-busy="true">
      <p className="kicker">Working on it</p>
      <h2 id="investigating-title" className="display investigating-title" tabIndex={-1} ref={headingRef}>
        {title}
      </h2>
      <div
        className="working"
        role="progressbar"
        aria-label={PILOT ? title : 'Looking up who fixes it'}
        aria-valuetext={`${seconds} seconds so far`}
      >
        <span className="working-bar" />
      </div>
      <p className="investigating-time" aria-hidden="true">
        <span className="investigating-seconds">{seconds}s</span> · {PILOT ? 'usually under 15 seconds' : 'usually 15–30 seconds'}
      </p>
      <h3 className="block-title">What happens now</h3>
      <ol className="steps-now" role="list">
        {steps.map((step, index) => (
          <li key={step}>
            <span className="steps-now-num" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <button type="button" className="btn" onClick={onCancel}>
        <X size={18} aria-hidden="true" />
        Cancel
      </button>
    </section>
  );
}
