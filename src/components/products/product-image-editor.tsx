"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import type { Product } from "@/types/database";
import {
  updateProductImageAction,
  uploadProductImageAction,
} from "@/app/dashboard/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProductImageEditorProps {
  product: Product;
  onUpdated: (imageUrl: string | null) => void;
}

export function ProductImageEditor({ product, onUpdated }: ProductImageEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(product.image_url ?? "");
  const [isSavingUrl, startSaveUrl] = useTransition();
  const [isUploading, startUpload] = useTransition();

  useEffect(() => {
    setImageUrl(product.image_url ?? "");
  }, [product.image_url, product.id]);

  function handleSaveUrl() {
    startSaveUrl(async () => {
      const trimmed = imageUrl.trim();
      const result = await updateProductImageAction(product.id, trimmed || null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const nextUrl = trimmed || null;
      onUpdated(nextUrl);
      toast.success("Image updated");
    });
  }

  function handleUpload(file: File) {
    const formData = new FormData();
    formData.set("file", file);

    startUpload(async () => {
      const result = await uploadProductImageAction(product.id, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const nextUrl = result.url ?? null;
      setImageUrl(nextUrl ?? "");
      onUpdated(nextUrl);
      toast.success("Image uploaded");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
  }

  const isDirty = imageUrl.trim() !== (product.image_url ?? "");
  const isBusy = isSavingUrl || isUploading;

  return (
    <div className="space-y-4 border-t p-4">
      <div className="space-y-2">
        <Label htmlFor="product_image_file">Upload image</Label>
        <input
          id="product_image_file"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={isBusy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          disabled={isBusy}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {isUploading ? "Uploading..." : "Choose file"}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP, or GIF · max 5 MB. Saved to storage and linked to this SKU.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product_image_url">Or paste image URL</Label>
        <Input
          id="product_image_url"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="https://..."
          disabled={isBusy}
        />
      </div>

      <Button
        type="button"
        size="sm"
        disabled={isBusy || !isDirty}
        onClick={handleSaveUrl}
      >
        {isSavingUrl ? "Saving..." : "Save URL"}
      </Button>
    </div>
  );
}
