import { useRef, useState } from 'react';
import {
  Download,
  FolderOpen,
  Pipette,
  Scaling,
  SlidersHorizontal,
  Wand2,
} from 'lucide-react';
import { Button } from './ui/button';
import { SaveAsDialog } from './SaveAsDialog';
import type { RasterImage } from '@/formats/types';
import type { Tool } from '@/tools/types';

type Props = {
  image: RasterImage | null;
  onPickFile: (file: File) => void;
  isLoading: boolean;
  tool: Tool;
  onToggleTool: (next: Tool) => void;
  onOpenLevels: () => void;
  onOpenResize: () => void;
  onOpenFilter: () => void;
};

const ACCEPTED = '.png,.jpg,.jpeg,.gb7,image/png,image/jpeg';

export function Toolbar({
  image,
  onPickFile,
  isLoading,
  tool,
  onToggleTool,
  onOpenLevels,
  onOpenResize,
  onOpenFilter,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const eyedropperOn = tool === 'eyedropper';

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

      <div className="mx-1 h-6 w-px bg-border" />

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenResize}
        disabled={!image || isLoading}
        title="Размер изображения — изменить ширину и высоту"
      >
        <Scaling className="mr-1 h-4 w-4" />
        Размер
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenLevels}
        disabled={!image || isLoading}
        title="Уровни — гистограмма + точки чёрного, белого и средних тонов"
      >
        <SlidersHorizontal className="mr-1 h-4 w-4" />
        Уровни
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenFilter}
        disabled={!image || isLoading}
        title="Фильтр — свёртка с 3×3 ядром + пресеты"
      >
        <Wand2 className="mr-1 h-4 w-4" />
        Фильтр
      </Button>

      <Button
        variant={eyedropperOn ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onToggleTool(eyedropperOn ? 'none' : 'eyedropper')}
        disabled={!image}
        title="Пипетка — кликни по пикселю, чтобы увидеть его RGB и L*a*b*"
        aria-pressed={eyedropperOn}
      >
        <Pipette className="mr-1 h-4 w-4" />
        Пипетка
      </Button>

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
