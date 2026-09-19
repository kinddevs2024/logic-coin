import { useRef, useState } from "react";
import { Modal } from "react-native";
import { ReactCrop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import "./photo-crop-editor.css";
import { useAppTheme } from "@/hooks/use-app-theme";
import { avatarCropPixels, initialAvatarCrop } from "@/lib/avatar-crop";
import type { CropAsset, PhotoCropEditorProps } from "./photo-crop-editor.types";

export function PhotoCropEditor(props: PhotoCropEditorProps) {
  return props.asset ? <CropDialog key={props.asset.uri} {...props} asset={props.asset} /> : null;
}

function CropDialog({ asset, onCancel, onConfirm }: Omit<PhotoCropEditorProps, "asset"> & { asset: CropAsset }) {
  const theme = useAppTheme();
  const image = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<PercentCrop>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirm = async () => {
    if (!crop || !image.current || saving) return;
    setSaving(true);
    setError("");
    try {
      const source = image.current;
      await source.decode();
      const rect = avatarCropPixels(crop, source.naturalWidth, source.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 640;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 640, 640);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, 640, 640);
      onConfirm(canvas.toDataURL("image/jpeg", 0.9));
    } catch {
      setError("Не удалось обрезать фото. Попробуйте другое изображение.");
    } finally { setSaving(false); }
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={saving ? undefined : onCancel}>
      <div className="avatar-crop-backdrop">
        <section className="avatar-crop-dialog" aria-label="Редактирование аватарки" aria-busy={saving} style={{ background: String(theme.surface), color: String(theme.text) }}>
          <h2>Настройте фото</h2>
          <p style={{ color: String(theme.textMuted) }}>Перемещайте рамку и тяните за углы. Сохранится только выбранная область.</p>
          <div className="avatar-crop-stage">
            <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} aspect={1} keepSelection minWidth={32} minHeight={32} disabled={saving} ruleOfThirds>
              <img ref={image} src={asset.uri} alt="Фото для обрезки" draggable={false} onError={() => setError("Не удалось открыть фотографию")} onLoad={(event) => {
                const source = event.currentTarget;
                setCrop({ unit: "%", ...initialAvatarCrop(source.naturalWidth, source.naturalHeight) });
              }} />
            </ReactCrop>
          </div>
          {error ? <p role="alert" style={{ color: String(theme.danger) }}>{error}</p> : null}
          <div className="avatar-crop-actions">
            <button type="button" disabled={saving} onClick={onCancel} style={{ background: String(theme.surfaceRaised), color: String(theme.text) }}>Отмена</button>
            <button type="button" disabled={!crop || saving || !!error} onClick={() => void confirm()} style={{ background: String(theme.primary), color: String(theme.onPrimary) }}>{saving ? "Сохраняем…" : "Готово"}</button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
