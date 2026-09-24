export type FixtureSilhouetteType =
  | 'tshirt'
  | 'shirt'
  | 'sweater'
  | 'hoodie'
  | 'jeans'
  | 'trousers'
  | 'shorts'
  | 'skirt'
  | 'jacket'
  | 'coat'
  | 'puffer'
  | 'windbreaker'
  | 'sneakers'
  | 'shoes'
  | 'boots'
  | 'sandals'
  | 'scarf'
  | 'bag'
  | 'belt'
  | 'hat';

export type FixturePatternKind = 'solid' | 'stripes' | 'plaid' | 'graphic';

export type FixtureImageMetadata = {
  fixtureId: string;
  image: string;
  category: string;
  baseName: string;
  color: string;
  pattern: string;
  printDescription: string | null;
};

export const FIXTURE_CANVAS_SIZE = 640;

export const SUPPORTED_SILHOUETTES: FixtureSilhouetteType[] = [
  'tshirt',
  'shirt',
  'sweater',
  'hoodie',
  'jeans',
  'trousers',
  'shorts',
  'skirt',
  'jacket',
  'coat',
  'puffer',
  'windbreaker',
  'sneakers',
  'shoes',
  'boots',
  'sandals',
  'scarf',
  'bag',
  'belt',
  'hat',
];

export const SUPPORTED_PATTERNS: FixturePatternKind[] = ['solid', 'stripes', 'plaid', 'graphic'];
