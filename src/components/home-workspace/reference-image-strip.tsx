import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneReferenceImageDraft } from "./shared";

export { ReferenceImageStrip };

function ReferenceImageStrip({
  addLabel,
  emptyLabel,
  images,
  isDisabled,
  removeLabel,
  title,
  onAddImages,
  onRemoveImage
}: {
  addLabel: string;
  emptyLabel: string;
  images: SceneReferenceImageDraft[];
  isDisabled?: boolean;
  removeLabel: string;
  title: string;
  onAddImages: (files: FileList | File[]) => void;
  onRemoveImage: (imageId: string) => void;
}) {
  return (
    <div role="group" aria-label={title} className="rounded-lg border border-border bg-background/70 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground/62">{title}</span>
        <label
          className={cn(
            "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border px-2 text-xs font-medium text-foreground/60 transition hover:bg-muted hover:text-foreground",
            isDisabled ? "pointer-events-none opacity-45" : ""
          )}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {addLabel}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={isDisabled}
            onChange={(event) => {
              if (event.target.files) {
                onAddImages(event.target.files);
              }

              event.target.value = "";
            }}
          />
        </label>
      </div>
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-md border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.previewUrl} alt="" className="aspect-video w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemoveImage(image.id)}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/86 text-foreground/70 opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100"
                aria-label={removeLabel}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span className="block truncate px-1.5 py-1 text-[0.68rem] text-foreground/50">{image.file.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border/75 px-3 py-2 text-xs text-foreground/42">{emptyLabel}</p>
      )}
    </div>
  );
}
