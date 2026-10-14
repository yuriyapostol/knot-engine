# Публічні функції core

Імпортуйте з `knot-engine/core`, щоб працювати з даними без Vue, Three.js і глобальних об’єктів браузера. Кореневий вхід також експортує ці функції. Це реалізований API, а не запропонований resolver просторів імен і ресурсів.

| Функція | Вхід | Результат |
| --- | --- | --- |
| validateKnotAsset | unknown, необов’язкове `{strict?: boolean}` | `{valid: true, asset, warnings}` або `{valid: false, issues}` |
| validateGridDiagram | unknown, необов’язкове `{strict?: boolean}` | `{valid: true, diagram, warnings}` або `{valid: false, issues}` |
| resolveKnotAsset | unknown, необов’язкове `{representationId?, snapshotId?}` | RenderableModel; кидає ViewerError при некоректному чи непідтримуваному виборі |
| selectKnotAsset | unknown, `{representations?: string[], diagrams?: string[]}` | Перевірений, клонований скорочений asset із залежностями |
| composeKnotAsset | readonly unknown[] | Перевірений об’єднаний asset; відхиляє порожній вхід і конфлікти ідентичності, одиниць чи записів |

Строга валідація відхиляє невідомі поля. Issues мають path, code й message. Валідація не доводить тотожності вузлів. Див. [контракт asset](knot-asset.uk.md) та [схему](schema/knot-asset.schema.json).

Resolver вибирає 3D-представлення й snapshot, типово перші доступні. Непідтримуваний 2D-rendering, відсутній вибір і порожня геометрія є помилками. Результат містить копії кривих і необов’язкові camera/warnings, а не сцену Three.js. Виділення й композиція працюють у пам’яті без завантаження посилань.

Legacy validateKnotModelV1 і resolveKnotModelV1 залишаються експортованими до запланованого повного переходу; див. їхній [контракт входу](model-format.uk.md). TypeScript-типи, ліміти та ViewerError також є публічними експортами. API не означає HTTP-сервер.
