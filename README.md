# Image Studio

Учебный редактор растровых изображений. Lab-1 — загрузка, отрисовка и
сохранение PNG / JPEG / GB7. Следующие лабы наращивают функционал
(фильтры, цветовые модели, гистограммы и т.д.).

**🌐 Live**: _добавлю ссылку после деплоя на Vercel_

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

## Тестовые изображения

В [`public/samples/`](public/samples/) лежат три GB7-файла (из LMS):
`gradient-half-mask.gb7`, `kapibara-mask.gb7`, `vertical-kapibara.gb7`.
Открываются как обычные PNG/JPG — кнопкой Open или перетаскиванием.

## Стек

React 18 + TypeScript (strict), Vite, Tailwind CSS, shadcn/ui, Vitest,
sonner. Деплой — Vercel (auto-build из `main`).
