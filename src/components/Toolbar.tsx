import { useRef, useState } from 'react';
import { Download, FolderOpen, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from './ui/button';
import { SaveAsDialog } from './SaveAsDialog';
import type { RasterImage } from '@/formats/types';

type Props = {
  image: RasterImage | null;
  onPickFile: (file: File) => void;
  fitToView: boolean;
  onToggleFit: (next: boolean) => void;
  isLoading: boolean;
};

const ACCEPTED = '.png,.jpg,.jpeg,.gb7,image/png,image/jpeg';

export function Toolbar({ image, onPickFile, fitToView, onToggleFit, isLoading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onPickFile(file);
    event.target.value = '';
  };

  return (
    <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
      <h1 className="mr-2 font-semibold tracking-tight">Image Studio</h1>
      <div className="mx-2 h-6 w-px bg-border" />

      <Button
        variant="default"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
      >
        <FolderOpen className="mr-1 h-4 w-4" />
        Open
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={handlePick}
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => setSaveOpen(true)}
        disabled={!image || isLoading}
      >
        <Download className="mr-1 h-4 w-4" />
        Save As
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleFit(!fitToView)}
          disabled={!image}
          title={fitToView ? 'Показать 100%' : 'Вписать в экран'}
        >
          {fitToView ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          <span className="ml-1">{fitToView ? '100%' : 'Fit'}</span>
        </Button>
      </div>

      {image && (
        <SaveAsDialog
          image={image}
          open={saveOpen}
          onOpenChange={setSaveOpen}
        />
      )}
    </div>
  );
}
