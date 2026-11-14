export type CropAsset = { uri: string; width: number; height: number; mimeType: string };
export type PhotoCropEditorProps = {
  asset: CropAsset | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
};
