import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabaseClient";
import authService from "./authService";
import { withNetworkTimeout } from "./networkTimeout";

const BUCKET_NAME = "receipts";
const SHARED_FOLDER = "all-receipts";
const AVATAR_FOLDER = "avatars";
const LOCAL_RECEIPT_FOLDER = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}eyegasto-receipts/`
  : null;

class ExpenseStorageService {
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index);
    }

    return bytes.buffer;
  }

  private async getArrayBufferFromUri(uri: string): Promise<ArrayBuffer> {
    if (/^(https?:|blob:|data:)/i.test(uri)) {
      const response = await withNetworkTimeout(fetch(uri));
      return response.arrayBuffer();
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return this.base64ToArrayBuffer(base64);
  }

  private getFileExtension(uri: string, mimeType?: string | null) {
    if (mimeType?.includes("/")) {
      return mimeType.split("/")[1];
    }

    const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match?.[1] || "jpg";
  }

  private isManagedLocalReceipt(uri?: string | null) {
    return Boolean(LOCAL_RECEIPT_FOLDER && uri?.startsWith(LOCAL_RECEIPT_FOLDER));
  }

  async persistLocalImage(
    uri?: string | null,
    prefix = "receipt",
    mimeType?: string | null,
  ): Promise<string | null | undefined> {
    if (!uri || /^(https?:|blob:|data:)/i.test(uri) || !LOCAL_RECEIPT_FOLDER) {
      return uri;
    }

    if (this.isManagedLocalReceipt(uri)) {
      return uri;
    }

    try {
      const folderInfo = await FileSystem.getInfoAsync(LOCAL_RECEIPT_FOLDER);
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(LOCAL_RECEIPT_FOLDER, {
          intermediates: true,
        });
      }

      const extension = this.getFileExtension(uri, mimeType);
      const localPath = `${LOCAL_RECEIPT_FOLDER}${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      await FileSystem.copyAsync({ from: uri, to: localPath });
      return localPath;
    } catch (error) {
      console.warn("Failed to persist local receipt image", error);
      return uri;
    }
  }

  async removeLocalImage(uri?: string | null): Promise<void> {
    if (!this.isManagedLocalReceipt(uri)) {
      return;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(uri as string);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(uri as string, { idempotent: true });
      }
    } catch (error) {
      console.warn("Failed to remove local receipt image", error);
    }
  }

  async uploadReceipt(
    uri: string,
    mimeType?: string | null,
  ): Promise<{ success: boolean; imageUrl?: string; path?: string; error?: string }> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: "User not authenticated" };
      }

      const fileData = await this.getArrayBufferFromUri(uri);
      const extension = this.getFileExtension(uri, mimeType);
      const path = `${SHARED_FOLDER}/${currentUser.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error } = await withNetworkTimeout(
        supabase.storage
          .from(BUCKET_NAME)
          .upload(path, fileData, {
            contentType: mimeType || `image/${extension}`,
            upsert: false,
          }),
      );

      if (error) {
        return { success: false, error: error.message };
      }

      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
      await this.removeLocalImage(uri);
      return { success: true, imageUrl: data.publicUrl, path };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to upload receipt",
      };
    }
  }

  async uploadAvatar(
    uri: string,
    mimeType?: string | null,
  ): Promise<{ success: boolean; imageUrl?: string; path?: string; error?: string }> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: "User not authenticated" };
      }

      const fileData = await this.getArrayBufferFromUri(uri);
      const extension = this.getFileExtension(uri, mimeType);
      const path = `${AVATAR_FOLDER}/${currentUser.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error } = await withNetworkTimeout(
        supabase.storage
          .from(BUCKET_NAME)
          .upload(path, fileData, {
            contentType: mimeType || `image/${extension}`,
            upsert: false,
          }),
      );

      if (error) {
        return { success: false, error: error.message };
      }

      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
      return { success: true, imageUrl: data.publicUrl, path };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to upload avatar",
      };
    }
  }

  async removeReceipt(path?: string | null): Promise<void> {
    if (!path) {
      return;
    }

    try {
      await withNetworkTimeout(
        supabase.storage.from(BUCKET_NAME).remove([path]),
      );
    } catch (error) {
      console.warn("Failed to remove receipt from storage", error);
    }
  }

  getReceiptPublicUrl(path?: string | null): string | undefined {
    if (!path) {
      return undefined;
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl || undefined;
  }
}

export default new ExpenseStorageService();
