export type StoredImage = {
  key: string;
  contentType: string;
  size: number;
};

export interface ImageStorage {
  put(key: string, data: Buffer, contentType: string): Promise<StoredImage>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}
