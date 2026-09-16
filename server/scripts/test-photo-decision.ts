import {
  decidePhotoOutcome,
  PHOTO_REJECT_REASONS,
  type ClothingItemMetadata,
  type PhotoRecognitionSignals,
} from '../src/photo-processing/photo-decision';

const SAMPLE_ITEM: ClothingItemMetadata = {
  baseName: 'Футболка',
  category: 'Футболка',
  color: 'Белый',
  pattern: 'Без принта',
  printDescription: null,
  style: 'Повседневный',
};

type Scenario = {
  name: string;
  signals: PhotoRecognitionSignals;
  expectedAccepted: boolean;
  expectedReason?: string;
};

const scenarios: Scenario[] = [
  {
    name: '1. вещь на однотонном фоне',
    signals: {
      clothingCount: 1,
      confidence: 0.88,
      background: 'simple',
      primaryItemClear: true,
      ambiguousMultipleItems: false,
      itemTooSmallOrObscured: false,
      item: SAMPLE_ITEM,
    },
    expectedAccepted: true,
  },
  {
    name: '2. вещь на кровати',
    signals: {
      clothingCount: 1,
      confidence: 0.76,
      background: 'moderate',
      primaryItemClear: true,
      ambiguousMultipleItems: false,
      itemTooSmallOrObscured: false,
      item: SAMPLE_ITEM,
    },
    expectedAccepted: true,
  },
  {
    name: '3. вещь на полу',
    signals: {
      clothingCount: 1,
      confidence: 0.72,
      background: 'moderate',
      primaryItemClear: true,
      ambiguousMultipleItems: false,
      itemTooSmallOrObscured: false,
      item: SAMPLE_ITEM,
    },
    expectedAccepted: true,
  },
  {
    name: '4. вещь на фоне комнаты',
    signals: {
      clothingCount: 1,
      confidence: 0.68,
      background: 'busy',
      primaryItemClear: true,
      ambiguousMultipleItems: false,
      itemTooSmallOrObscured: false,
      item: SAMPLE_ITEM,
    },
    expectedAccepted: true,
  },
  {
    name: '5a. несколько равнозначных вещей',
    signals: {
      clothingCount: 3,
      confidence: 0.71,
      background: 'moderate',
      primaryItemClear: false,
      ambiguousMultipleItems: true,
      itemTooSmallOrObscured: false,
      item: SAMPLE_ITEM,
    },
    expectedAccepted: false,
    expectedReason: PHOTO_REJECT_REASONS.MULTIPLE_ITEMS,
  },
  {
    name: '5b. несколько вещей, но primary ясен',
    signals: {
      clothingCount: 2,
      confidence: 0.55,
      background: 'busy',
      primaryItemClear: true,
      ambiguousMultipleItems: false,
      itemTooSmallOrObscured: false,
      item: SAMPLE_ITEM,
    },
    expectedAccepted: true,
  },
  {
    name: '6. нет одежды',
    signals: {
      clothingCount: 0,
      confidence: 0.12,
      background: 'simple',
      primaryItemClear: false,
      ambiguousMultipleItems: false,
      itemTooSmallOrObscured: false,
      item: null,
    },
    expectedAccepted: false,
    expectedReason: PHOTO_REJECT_REASONS.NOT_CLOTHING,
  },
  {
    name: '7. вещь плохо видна',
    signals: {
      clothingCount: 1,
      confidence: 0.33,
      background: 'moderate',
      primaryItemClear: true,
      ambiguousMultipleItems: false,
      itemTooSmallOrObscured: true,
      item: SAMPLE_ITEM,
    },
    expectedAccepted: false,
    expectedReason: PHOTO_REJECT_REASONS.ITEM_NOT_CLEAR,
  },
  {
    name: 'borderline confidence 0.52 с одной вещью',
    signals: {
      clothingCount: 1,
      confidence: 0.52,
      background: 'busy',
      primaryItemClear: true,
      ambiguousMultipleItems: false,
      itemTooSmallOrObscured: false,
      item: SAMPLE_ITEM,
    },
    expectedAccepted: true,
  },
];

let failed = 0;

for (const scenario of scenarios) {
  const result = decidePhotoOutcome(scenario.signals);
  const reasonMatches =
    scenario.expectedReason === undefined || result.rejectReason === scenario.expectedReason;
  const passed = result.accepted === scenario.expectedAccepted && reasonMatches;

  if (!passed) {
    failed += 1;
    console.error(
      `FAIL ${scenario.name}: expected accepted=${scenario.expectedAccepted}${scenario.expectedReason ? ` reason=${scenario.expectedReason}` : ''}, got accepted=${result.accepted} reason=${result.rejectReason}`,
    );
    continue;
  }

  console.log(`PASS ${scenario.name}`);
}

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} scenario(s) failed.`);
} else {
  console.log(`\nAll ${scenarios.length} scenarios passed.`);
}
