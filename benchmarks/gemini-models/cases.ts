// Test cases, scoring, and the results.jsonl row shape, shared by bench.ts and summarize.ts. Each case pairs a pin
// whose maintaining office is certain with fixed map facts (the same input for every model), a photo or none, and a
// note that exercises the note analysis: an exact spot, a fact about the problem, and in three cases a wrong guess
// about who owns it.
import type { AreaFact, InvestigationRequest, IssueKind, LocationContext, PlaceAddress } from '../../shared/types';

/** One Gemini call inside a report, as bench.ts recorded it. */
export interface CallRecord {
  kind: 'research' | 'format';
  ms: number;
  status: number | null;
  thinkingLevel: string | null;
  /** The `model` field of the response: aliases answer as another model. */
  servedModel: string | null;
  usage: {
    total_input_tokens?: number;
    total_cached_tokens?: number;
    total_thought_tokens?: number;
    total_output_tokens?: number;
    total_tool_use_tokens?: number;
    total_tokens?: number;
  } | null;
  searches: number;
  error: string | null;
}

/** One line of results.jsonl: one full report for one variant and case. */
export interface RunRow {
  /** `model`, or `model@level` when the research call's thinking level was overridden. */
  variant: string;
  model: string;
  case: string;
  repeat: number;
  startedAt: string;
  ms: number;
  /** Phase timings from the pipeline's `onPhase`. */
  phases: Record<string, number>;
  /** ApiError code (or message) when the report failed, as the app would show an error. */
  error: string | null;
  calls: CallRecord[];
  report: (ReportFacts & { evidence: boolean; contact: boolean; sources: number; officialSources: number }) | null;
  /**
   * The office the format call named, before the server's checks. An unidentified verdict can hide a right answer
   * whose official pages didn't load, so this scores the model apart from the sites it cites.
   */
  named: { organization: string | null; department: string | null } | null;
}

/** A Gemini response as bench.ts keeps it in raw/. */
export interface RawResponse {
  kind: CallRecord['kind'];
  status: number;
  body: {
    steps?: Array<{ type?: string; content?: Array<{ text?: string }>; arguments?: { queries?: unknown[] } }>;
  } | null;
}

/** Organization and department from the last successful format call's JSON, or null if there is none. */
export function namedOffice(responses: RawResponse[]): RunRow['named'] {
  const format = responses.findLast((response) => response.kind === 'format' && response.status === 200);
  const text = (format?.body?.steps ?? [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .map((block) => block.text ?? '')
    .join('');
  try {
    // Same fence stripping as the pipeline's parseDraft.
    const draft = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as Record<string, unknown>;
    const field = (key: string) => (typeof draft[key] === 'string' ? (draft[key] as string) : null);
    return { organization: field('organization'), department: field('department') };
  } catch {
    return null;
  }
}

export interface BenchCase {
  id: string;
  /** One line for the write-up. */
  about: string;
  /** File in photos/, or null for a report without a photo. */
  photo: string | null;
  request: Omit<InvestigationRequest, 'photoDataUrl'>;
  context: LocationContext;
  expect: {
    kinds: IssueKind[];
    /** Matched against organization + department, so "City of New York" / "Department of Transportation" counts. */
    office: RegExp;
    /** Where exactly, from the note; must show up in `issue.spot`. */
    spot: RegExp;
    /** A fact the note adds about the problem; must show up in `issue.summary`. */
    fact: RegExp;
    /** The note's guess about the owner. It must not appear anywhere in the email. */
    ownerClaim: RegExp | null;
  };
}

const COLLEGE_PARK: AreaFact = {
  municipality: 'College Park',
  municipalityKind: 'city',
  incorporation: 'incorporated',
  county: "Prince George's County",
  state: 'Maryland',
  country: 'United States',
  countryCode: 'us',
};

const marylandAddress = (road: string, locality: string, postcode: string): PlaceAddress => ({
  houseNumber: null,
  road,
  locality,
  county: "Prince George's County",
  state: 'Maryland',
  postcode,
  country: 'United States',
  countryCode: 'us',
});

const BALTIMORE_AVE = {
  location: {
    latitude: 38.986822,
    longitude: -76.936241,
    label: 'Baltimore Avenue, College Park, Maryland',
    address: marylandAddress('Baltimore Avenue', 'College Park', '20742'),
  },
  context: {
    road: { name: 'Baltimore Avenue', ref: 'US 1', kind: 'primary', operator: null, distanceMeters: 0 },
    campus: null,
    streetLights: [],
    area: COLLEGE_PARK,
    partial: false,
  },
} satisfies { location: InvestigationRequest['location']; context: LocationContext };

const LIBRARY_LANE = {
  location: {
    latitude: 38.9859,
    longitude: -76.9442,
    label: 'Library Lane, College Park, Maryland',
    address: marylandAddress('Library Lane', 'College Park', '20742'),
  },
  context: {
    road: { name: 'Library Lane', ref: null, kind: 'footway', operator: null, distanceMeters: 8 },
    campus: { name: 'University of Maryland, College Park', operator: null, website: 'https://umd.edu/' },
    streetLights: [],
    area: COLLEGE_PARK,
    partial: false,
  },
} satisfies { location: InvestigationRequest['location']; context: LocationContext };

const SHA = /state highway administration|\bSHA\b|maryland department of transportation|\bMDOT\b/i;
const UMD_FACILITIES = /facilities management|university of maryland/i;

export const CASES: BenchCase[] = [
  {
    id: 'A',
    about: 'Pothole photo on US 1 in College Park; the note guesses the city owns it (the state does).',
    photo: 'caseA.jpg',
    request: {
      ...BALTIMORE_AVE,
      details:
        'northbound right lane in front of the 7-Eleven. its been growing for 2 weeks and popped my tire yesterday. pretty sure the city owns this road',
    },
    context: BALTIMORE_AVE.context,
    expect: {
      kinds: ['pothole', 'road_damage'],
      office: SHA,
      spot: /7-?eleven/i,
      fact: /\b(two|2) weeks\b|tire/i,
      ownerClaim: /city owns|pretty sure/i,
    },
  },
  {
    id: 'B',
    about: 'Cracked sidewalk photo on a University of Maryland footway.',
    photo: 'caseB.jpg',
    request: {
      ...LIBRARY_LANE,
      details: "Slab lifted about 3 inches outside McKeldin Library's south entrance. Someone tripped on it last week.",
    },
    context: LIBRARY_LANE.context,
    expect: {
      kinds: ['sidewalk'],
      office: UMD_FACILITIES,
      spot: /mckeldin/i,
      fact: /\b(3|three)[- ]inch|trip/i,
      ownerClaim: null,
    },
  },
  {
    id: 'C',
    about: 'Broken streetlight photo on West 86th Street, Manhattan; the note gives a pole number.',
    photo: 'caseC.jpg',
    request: {
      location: {
        latitude: 40.787204,
        longitude: -73.973862,
        label: 'West 86th Street, New York, New York',
        address: {
          houseNumber: null,
          road: 'West 86th Street',
          locality: 'New York',
          county: 'New York County',
          state: 'New York',
          postcode: '10024',
          country: 'United States',
          countryCode: 'us',
        },
      },
      details: 'Pole number: 86-112\nBoth lamps smashed since last Friday, the block is dark at night.',
    },
    context: {
      road: { name: 'West 86th Street', ref: null, kind: 'secondary', operator: null, distanceMeters: 0 },
      campus: null,
      streetLights: [],
      area: {
        municipality: 'New York',
        municipalityKind: 'city',
        incorporation: 'incorporated',
        county: 'New York County',
        state: 'New York',
        country: 'United States',
        countryCode: 'us',
      },
      partial: false,
    },
    expect: {
      kinds: ['streetlight'],
      office:
        /(new york city|\bNYC\b|city of new york).*(department of transportation|\bDOT\b)|\bNYC ?DOT\b|department of transportation.*(new york city|\bNYC\b)/i,
      spot: /86-112/,
      fact: /friday|dark/i,
      ownerClaim: null,
    },
  },
  {
    id: 'D',
    about: 'Road cave-in photo in unincorporated Adelphi, MD (county roads); the note names an HOA.',
    photo: 'caseD.jpg',
    request: {
      location: {
        latitude: 39.001391,
        longitude: -76.969901,
        label: 'Tecumseh Street, Adelphi, Maryland',
        address: marylandAddress('Tecumseh Street', 'Adelphi', '20783'),
      },
      details: 'HOA: Adelphi Woods Homeowners Association\nRoad caved in next to the storm drain, about 4 feet across.',
    },
    context: {
      road: { name: 'Tecumseh Street', ref: null, kind: 'residential', operator: null, distanceMeters: 0 },
      campus: null,
      streetLights: [],
      area: { ...COLLEGE_PARK, municipality: null, municipalityKind: null, incorporation: 'unincorporated' },
      partial: false,
    },
    expect: {
      kinds: ['pothole', 'road_damage', 'drainage'],
      office: /prince george.?s county.*(public works|transportation|\bDPW)|\bDPW&?T\b|PGC ?311/i,
      spot: /storm drain/i,
      fact: /\b(4|four)[- ](feet|foot|ft)\b/i,
      ownerClaim: /adelphi woods|homeowners|\bHOA\b/i,
    },
  },
  {
    id: 'E',
    about: 'No photo: pothole on US 1 described in the note, which guesses a private property manager.',
    photo: null,
    request: {
      ...BALTIMORE_AVE,
      details:
        'Deep pothole in the southbound left lane at the Knox Road light. Cars swerve into the next lane to avoid it.\nProperty manager: Terrapin Row',
    },
    context: BALTIMORE_AVE.context,
    expect: {
      kinds: ['pothole', 'road_damage'],
      office: SHA,
      spot: /knox/i,
      fact: /swerv/i,
      ownerClaim: /terrapin row|property manager/i,
    },
  },
  {
    id: 'F',
    about: 'No photo: cracked campus sidewalk described in the note.',
    photo: null,
    request: {
      ...LIBRARY_LANE,
      details: "Big crack across the sidewalk by the bike racks. Wheelchairs can't get over it.",
    },
    context: LIBRARY_LANE.context,
    expect: {
      kinds: ['sidewalk'],
      office: UMD_FACILITIES,
      spot: /bike rack/i,
      fact: /wheelchair/i,
      ownerClaim: null,
    },
  },
];

const PHOTO_WORDS = /\b(photos?|pictures?|images?|attach\w*)\b/i;

/** The facts a run row stores about a finished report: enough to re-score without re-running. */
export interface ReportFacts {
  verdict: string;
  organization: string | null;
  department: string | null;
  kind: string;
  summary: string | null;
  spot: string | null;
  warnings: string[];
  email: { subject: string; body: string };
}

export interface Scores {
  kindOk: boolean;
  officeOk: boolean;
  spotOk: boolean;
  factOk: boolean;
  /** The note's owner guess reached the email. Always false for cases without one. */
  ownerLeak: boolean;
  /** A report without a photo mentions one. Always false for photo cases. */
  photoLeak: boolean;
}

export function score(benchCase: BenchCase, report: ReportFacts): Scores {
  const { expect } = benchCase;
  const email = `${report.email.subject}\n${report.email.body}`;
  return {
    kindOk: (expect.kinds as string[]).includes(report.kind),
    officeOk: report.organization !== null && expect.office.test(`${report.organization} ${report.department ?? ''}`),
    spotOk: report.spot !== null && expect.spot.test(report.spot),
    factOk: report.summary !== null && expect.fact.test(report.summary),
    ownerLeak: expect.ownerClaim !== null && expect.ownerClaim.test(email),
    photoLeak:
      benchCase.photo === null &&
      PHOTO_WORDS.test([email, report.summary ?? '', report.spot ?? '', ...report.warnings].join('\n')),
  };
}
