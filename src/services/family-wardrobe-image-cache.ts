import {
  familyMemberOriginalImageEndpoint,
  familyMemberProcessedImageEndpoint,
} from '@/config/api';
import { downloadFamilyMemberWardrobeImage } from '@/services/family-api';
import type { FamilyWardrobeItem } from '@/services/family-api';
import {
  buildFamilyWardrobeCachedImageFile,
  buildFamilyWardrobeImageMetaFile,
  localFamilyImageFileExists,
} from '@/utils/family-wardrobe-local-image-path';

type FamilyImageKind = 'original' | 'processed';

type FamilyImageMeta = {
  serverUpdatedAt: string | null;
  contentType: string;
};

function pickFamilyImageKind(item: FamilyWardrobeItem): FamilyImageKind | null {
  if (item.images.processedAvailable) {
    return 'processed';
  }

  if (item.images.originalAvailable) {
    return 'original';
  }

  return null;
}

function getFamilyImageEndpoint(
  memberPublicId: string,
  itemId: string,
  kind: FamilyImageKind,
): string {
  return kind === 'processed'
    ? familyMemberProcessedImageEndpoint(memberPublicId, itemId)
    : familyMemberOriginalImageEndpoint(memberPublicId, itemId);
}

function getServerUpdatedAt(item: FamilyWardrobeItem, kind: FamilyImageKind): string | null {
  return kind === 'processed' ? item.images.processedUpdatedAt : item.images.originalUpdatedAt;
}

async function readFamilyImageMeta(
  memberPublicId: string,
  itemId: string,
  kind: FamilyImageKind,
): Promise<FamilyImageMeta | null> {
  try {
    const metaFile = await buildFamilyWardrobeImageMetaFile(memberPublicId, itemId, kind);

    if (!metaFile.exists) {
      return null;
    }

    const raw = await metaFile.text();
    const parsed = JSON.parse(raw) as FamilyImageMeta;

    if (typeof parsed.contentType !== 'string') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function writeFamilyImageMeta(
  memberPublicId: string,
  itemId: string,
  kind: FamilyImageKind,
  meta: FamilyImageMeta,
): Promise<void> {
  const metaFile = await buildFamilyWardrobeImageMetaFile(memberPublicId, itemId, kind);
  metaFile.write(JSON.stringify(meta));
}

async function readCachedFamilyImageUri(
  memberPublicId: string,
  itemId: string,
  kind: FamilyImageKind,
  serverUpdatedAt: string | null,
): Promise<string | null> {
  const meta = await readFamilyImageMeta(memberPublicId, itemId, kind);

  if (!meta || meta.serverUpdatedAt !== serverUpdatedAt) {
    return null;
  }

  const cachedFile = await buildFamilyWardrobeCachedImageFile(
    memberPublicId,
    itemId,
    kind,
    meta.contentType,
  );

  if (!localFamilyImageFileExists(cachedFile.uri)) {
    return null;
  }

  return cachedFile.uri;
}

export async function resolveFamilyWardrobeItemImageUri(
  token: string,
  memberPublicId: string,
  item: FamilyWardrobeItem,
): Promise<string | null> {
  const kind = pickFamilyImageKind(item);

  if (!kind) {
    return null;
  }

  const serverUpdatedAt = getServerUpdatedAt(item, kind);
  const cachedUri = await readCachedFamilyImageUri(memberPublicId, item.id, kind, serverUpdatedAt);

  if (cachedUri) {
    return cachedUri;
  }

  try {
    const endpoint = getFamilyImageEndpoint(memberPublicId, item.id, kind);
    const downloaded = await downloadFamilyMemberWardrobeImage(token, endpoint);
    const cachedFile = await buildFamilyWardrobeCachedImageFile(
      memberPublicId,
      item.id,
      kind,
      downloaded.contentType,
    );

    cachedFile.write(downloaded.bytes);
    await writeFamilyImageMeta(memberPublicId, item.id, kind, {
      serverUpdatedAt,
      contentType: downloaded.contentType,
    });

    return cachedFile.uri;
  } catch {
    return null;
  }
}

export async function clearFamilyWardrobeImageCache(memberPublicId: string, itemId: string): Promise<void> {
  for (const kind of ['original', 'processed'] as const) {
    try {
      const imageFile = await buildFamilyWardrobeCachedImageFile(
        memberPublicId,
        itemId,
        kind,
        'image/png',
      );
      const metaFile = await buildFamilyWardrobeImageMetaFile(memberPublicId, itemId, kind);

      if (imageFile.exists) {
        imageFile.delete();
      }

      if (metaFile.exists) {
        metaFile.delete();
      }
    } catch {
      // Ignore cache cleanup failures.
    }
  }
}
