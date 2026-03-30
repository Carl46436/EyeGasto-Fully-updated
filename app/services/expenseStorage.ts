import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabaseClient";
import authService from "./authService";

const BUCKET_NAME = "receipts";
const SHARED_FOLDER = "all-receipts";

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
      const response = await fetch(uri);
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

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, fileData, {
          contentType: mimeType || `image/${extension}`,
          upsert: false,
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
      return { success: true, imageUrl: data.publicUrl, path };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to upload receipt",
      };
    }
  }

  async removeReceipt(path?: string | null): Promise<void> {
    if (!path) {
      return;
    }

    try {
      await supabase.storage.from(BUCKET_NAME).remove([path]);
    } catch (error) {
      console.warn("Failed to remove receipt from storage", error);
    }
  }
}

export default new ExpenseStorageService();
