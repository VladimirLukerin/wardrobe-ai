import {
  buildDailyInputSignature,
  upsertDailyOutfit,
  type DailyOutfitResponse,
} from '../db/daily-outfits-repository';
import { buildPersonPairedOutfitContext } from '../paired-outfits/build-person-context';
import type { SuggestOutfitsLocation } from '../suggest-outfits';
import {
  generateOutfitSuggestionsFromBody,
  hasMinimumWardrobeForOutfit,
  type WardrobeItemPayload,
} from '../suggest-outfits';

export class DailyOutfitGenerationError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DailyOutfitGenerationError';
    this.status = status;
  }
}

function buildServerDailyInputSignature({
  localDate,
  wardrobe,
  stylistPreferences,
  userParameters,
  location,
}: {
  localDate: string;
  wardrobe: WardrobeItemPayload[];
  stylistPreferences: ReturnType<typeof buildPersonPairedOutfitContext>['stylistPreferences'];
  userParameters: ReturnType<typeof buildPersonPairedOutfitContext>['userParameters'];
  location: SuggestOutfitsLocation | null;
}): string {
  return buildDailyInputSignature({
    localDate,
    wardrobeIds: wardrobe.map((item) => item.id).sort(),
    wardrobeUpdatedAt: wardrobe.map((item) => item.lastWornAt ?? '').join('|'),
    stylistPreferences,
    userParameters,
    location,
  });
}

export async function generateAndStoreDailyOutfit({
  userId,
  localDate,
  location,
}: {
  userId: string;
  localDate: string;
  location: SuggestOutfitsLocation | null;
}): Promise<DailyOutfitResponse> {
  const person = buildPersonPairedOutfitContext(userId);

  if (!hasMinimumWardrobeForOutfit(person.wardrobe)) {
    throw new DailyOutfitGenerationError(422, 'Недостаточно вещей для daily outfit.');
  }

  const requestBody = {
    wardrobe: person.wardrobe,
    stylistPreferences: person.stylistPreferences,
    userParameters: person.userParameters,
    behavioralContext: person.behavioralContext,
    location,
  };

  const { outfits, weather } = await generateOutfitSuggestionsFromBody(requestBody);
  const outfit = outfits.find((candidate) => candidate.itemIds.length >= 2);

  if (!outfit) {
    throw new DailyOutfitGenerationError(502, 'Не удалось сгенерировать daily outfit.');
  }

  const inputSignature = buildServerDailyInputSignature({
    localDate,
    wardrobe: person.wardrobe,
    stylistPreferences: person.stylistPreferences,
    userParameters: person.userParameters,
    location,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[DAILY OUTFIT] generated user=${userId.slice(0, 8)} date=${localDate} items=${outfit.itemIds.length}`,
    );
  }

  return upsertDailyOutfit({
    userId,
    localDate,
    itemIds: outfit.itemIds,
    description: outfit.description,
    weather,
    inputSignature,
  });
}
