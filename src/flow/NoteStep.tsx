import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { DETAILS_MAX_LENGTH } from '../../shared/types';
import { PILOT } from '../lib/pilot';

const SPOT_CLUES = [
  { label: 'Pole number', text: 'Pole number: ' },
  { label: 'Landmark', text: 'Near: ' },
];

/** Owner guesses steer the research. A pilot addresses every report to its partner, so it asks only where. */
const CLUES = PILOT
  ? [{ label: 'Building number', text: 'Building number: ' }, ...SPOT_CLUES]
  : [{ label: 'HOA', text: 'HOA: ' }, { label: 'Property manager', text: 'Property manager: ' }, ...SPOT_CLUES];

const COPY = PILOT
  ? {
      required: `Without a photo, this is how ${PILOT.shortName} knows what to fix. Say what’s wrong, and add a street, a building number, or a landmark if you can.`,
      optional: `A street, a building number, or a landmark helps ${PILOT.shortName} find it.`,
      requiredExample: 'Example: Deep pothole in the alley behind the townhouses, by the storm drain.',
      optionalExample: 'Example: Alley behind the townhouses, by the storm drain. It has been there for a week.',
    }
  : {
      required:
        'Without a photo, this is how the office knows what to fix. Say what’s wrong, and add a lane, a landmark, or a pole number if you can.',
      optional:
        'A lane, a landmark, a pole number, or who you think owns it. Clues like these often decide between the city, the state, and a utility.',
      requiredExample: 'Example: Deep pothole in the northbound lane, next to the bus stop.',
      optionalExample: 'Example: Northbound lane, next to the bus stop. The light has been out for a week.',
    };

const COUNTER_FROM = 200;

interface NoteStepProps {
  value: string;
  onChange: (value: string) => void;
  /** No photo: the note is the only description of the problem, so it's required. */
  required: boolean;
}

export function NoteStep({ value, onChange, required }: NoteStepProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const left = DETAILS_MAX_LENGTH - value.length;

  function addClue(text: string) {
    const separator = value === '' || value.endsWith('\n') ? '' : '\n';
    const next = (value + separator + text).slice(0, DETAILS_MAX_LENGTH);
    onChange(next);
    // Focus now, so typing right after the tap lands in the note; React then sets the value and the caret ends up after it.
    textareaRef.current?.focus();
  }

  return (
    <div className="note-step field">
      <label className="field-label" htmlFor="note">
        {required ? (
          'What’s broken, and where exactly?'
        ) : (
          <>
            Where exactly, and what did you notice? <span className="optional">Optional</span>
          </>
        )}
      </label>
      <p className="field-hint" id="note-hint">
        {required ? COPY.required : COPY.optional}
      </p>
      <ul role="list" className="clue-chips" aria-label="Add a clue">
        {CLUES.map((clue) => (
          <li key={clue.label}>
            <button type="button" className="clue-chip" onClick={() => addClue(clue.text)}>
              <Plus size={16} aria-hidden="true" />
              {clue.label}
            </button>
          </li>
        ))}
      </ul>
      <textarea
        ref={textareaRef}
        id="note"
        className="textarea"
        rows={4}
        maxLength={DETAILS_MAX_LENGTH}
        value={value}
        required={required}
        aria-describedby={left <= COUNTER_FROM ? 'note-hint note-count' : 'note-hint'}
        placeholder={required ? COPY.requiredExample : COPY.optionalExample}
        onChange={(event) => onChange(event.target.value)}
      />
      {left <= COUNTER_FROM && (
        <p className="note-count" id="note-count" data-empty={left === 0 || undefined}>
          {left === 0 ? 'You’ve reached the limit.' : `${left} ${left === 1 ? 'character' : 'characters'} left`}
        </p>
      )}
    </div>
  );
}
