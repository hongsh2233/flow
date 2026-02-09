# config

앱 전역에서 쓰는 **링크, 메뉴, 라우트** 등은 이 폴더에 두고 불러와 사용합니다.

- **nav-items.json** – 하단 네비 메뉴 항목 (id, label, href). 아이콘 매핑은 `nav.ts`에서 처리.
- **nav.ts** – JSON + 아이콘을 합쳐 `navItems`로 export. 컴포넌트는 `import { navItems } from '@/config/nav'` 로 사용.

새로운 링크/메뉴가 생기면 JSON 또는 새 config 파일을 여기에 추가하고, 한 곳에서 import 하는 방식으로 통일하면 됩니다.
