# Image Studio

Учебный редактор растровых изображений. Lab-1 — загрузка, отрисовка и
сохранение PNG / JPEG / GB7. Следующие лабы наращивают функционал
(фильтры, цветовые модели, гистограммы и т.д.).

## Запуск

```bash
npm install
npm run dev          # http://localhost:5173
```

## Команды

```bash
npm run typecheck    # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm run test         # vitest
npm run build        # production-сборка в dist/
npm run preview      # просмотр production-сборки
npm run lint         # eslint .
```

## Стек

React 18 + TypeScript (strict), Vite, Tailwind CSS, Vitest.
