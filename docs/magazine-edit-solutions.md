# magazine-edit 인페이지 HTML 에디터 — 문제별 해결책

참고: [magazine-edit-issues.md](magazine-edit-issues.md)

---

## 1. `document.execCommand` 전체 deprecated

### 핵심 방향
`execCommand`를 직접 호출하는 모든 서식 명령을 **Selection/Range API 기반의 자체 구현**으로 교체한다.

### 세부 전략

| 기능 | 현재 방식 | 대체 방식 |
|------|-----------|-----------|
| bold / italic / underline | `execCommand('bold')` 등 | 선택 영역을 `<strong>`, `<em>`, `<u>`로 직접 wrap/unwrap |
| 순서 없는 목록 | `execCommand('insertUnorderedList')` | 선택된 블록 노드들을 `<ul><li>…</li></ul>`로 변환 |
| 번호 목록 | `execCommand('insertOrderedList')` | 동일, `<ol>` 사용 |
| Shift+Enter 줄바꿈 | `execCommand('insertLineBreak')` | `Range.insertNode(document.createElement('br'))` |
| 붙여넣기 텍스트 삽입 | `execCommand('insertText', false, text)` | `Range.deleteContents()` 후 `Range.insertNode(document.createTextNode(text))` |
| 이미지 삽입 | `execCommand('insertImage', url)` | `Range.insertNode(img)` (이미지 URL 경로 — 아래 #7 해결책 참조) |

### 작업 범위
`html-editor.js`의 `exec()` 함수 내부와 `keydown` Shift+Enter 핸들러, `paste` 핸들러를 각각 개별 함수로 분리하여 교체한다. bold/italic/underline은 toggle 로직(이미 적용된 태그면 unwrap)이 필요하다.

### 참고
- MDN: [Selection API](https://developer.mozilla.org/en-US/docs/Web/API/Selection)
- MDN: [Range](https://developer.mozilla.org/en-US/docs/Web/API/Range)

---

## 2. 색상 피커 드래그 시 color span 중첩 누적

### 핵심 방향
`input` 이벤트를 `change`로 바꿔 최종 확정 값에만 반응하게 한다. 단, `change`는 피커를 닫아야 발화하므로 UX가 떨어질 수 있다면 **debounce + 선택 영역 고정** 방식을 사용한다.

### 옵션 A — 이벤트를 `change`로 교체 (가장 단순)
`colorInput.addEventListener("input", …)` → `colorInput.addEventListener("change", …)`

피커를 드래그하는 동안은 색상이 바뀌지 않고, 피커를 닫는 순간 한 번만 적용된다.

### 옵션 B — `mousedown`에 선택 영역을 스냅샷으로 고정 후 매번 대체
1. 피커 `mousedown` 시점에 `savedRange`를 별도 변수 `colorStartRange`에 스냅샷으로 보관한다.
2. `input` 이벤트마다 `colorStartRange`를 기준으로 **기존에 삽입한 color span을 unwrap → 새 span으로 교체**하여 항상 단일 span만 존재하도록 한다.
3. `change` 이벤트에서 `colorStartRange`를 초기화한다.

### 권장
옵션 A가 구현이 단순하고 버그 가능성이 없다. 실시간 미리보기가 필요하다면 옵션 B를 선택한다.

---

## 3. `insertHtmlAtCursor` 다중 노드 삽입 순서 역전

### 원인 재확인
`Range.insertNode()`는 range.start 위치에 노드를 삽입하되, range.start를 **삽입된 노드 앞**으로 이동시키지 않는다. 따라서 반복 삽입 시 나중에 삽입된 노드가 앞에 온다.

### 해결책 A — `DocumentFragment`를 사용해 한 번에 삽입
`<template>` 요소의 `content`(DocumentFragment)에 모든 노드가 이미 담겨 있으므로, fragment 자체를 `range.insertNode(fragment)`로 한 번에 삽입한다. `Range.insertNode`는 fragment의 경우 내부 노드들을 순서대로 삽입하는 것이 명세 동작이다.

```
현재: nodes.forEach(n => range.insertNode(n))
수정: range.insertNode(tpl.content)
```

이후 `last` 포인터가 필요하면 삽입 전에 `tpl.content.lastChild`를 미리 저장한다.

### 해결책 B — 역순 삽입
`nodes`를 `reverse()`해서 삽입하면 역전 효과가 상쇄된다. fragment 방식보다 직관성이 낮으나 현재 코드 변경 최소화 시 사용 가능.

### 권장
해결책 A. `<template>` 이미 사용 중이므로 코드 변경이 작다.

---

## 4. 에디터 본문 "삭제" 버튼이 bodyImagePool과 비동기화

### 원인
에디터 body 내 figure 삭제 버튼 핸들러(`bindEditorBodyImages` 내부)는 DOM에서 figure만 제거하고 `removeBodyImageFromPool`을 호출하지 않는다.

### 해결책
figure 삭제 버튼 클릭 핸들러에서 DOM 제거 직전에 해당 figure의 asset key로 pool 항목을 찾아 `removeBodyImageFromPool(id)`를 호출한다.

**key 추출 경로:**
1. `figure.querySelector("img")`로 img 요소를 얻는다.
2. `img.getAttribute("data-ti-asset-key")` 또는 `img.getAttribute("data-ti-temp")`로 assetPath를 얻는다.
3. `bodyImagePool`에서 `item.assetPath === normalizeAssetPath(assetKey)`인 항목의 `id`를 찾아 `removeBodyImageFromPool(id)`를 호출한다.

`removeBodyImageFromPool`은 이미 `removeFiguresByAsset`을 내부에서 호출하므로, figure DOM 제거는 pool 함수에 위임하고 현재 핸들러의 직접 `removeChild` 호출은 제거한다.

---

## 5. `sanitizeOutputHtml` 정규식이 mz-text-box를 삭제

### 원인
```js
.replace(/<div(\s[^>]*)?>\s*<br\s*\/?>\s*<\/div>/gi, "<br>")
```
이 정규식은 class 유무와 무관하게 모든 `<div><br></div>` 패턴을 `<br>`로 치환한다.

### 해결책 A — 정규식에 부정 lookahead 추가
`mz-text-box` 클래스를 가진 div는 제외하는 lookahead를 추가한다.

```
/<div(?![^>]*mz-text-box)(\s[^>]*)?>\s*<br\s*\/?>\s*<\/div>/gi
```

### 해결책 B — 정규식 전처리 제거, DOM 파싱 단계에서 처리
정규식 전처리(`.replace(…)`) 두 줄을 제거하고, 이후 DOM walk 단계의 `DIV` 처리 분기에서 비어있는 일반 div를 `<p><br></p>`로 변환하는 로직으로 통합한다. `mz-text-box` div는 기존대로 보존 분기를 타므로 자연스럽게 제외된다.

### 권장
해결책 B. 정규식으로 HTML을 전처리하는 것은 중첩 태그나 속성 내 특수문자에 취약하므로, DOM 파싱 후 처리하는 기존 `walk()` 패턴을 확장하는 것이 더 안전하다.

---

## 6. `window.prompt()` — iframe/팝업차단 환경에서 무음 실패

### 해결책 — 인라인 모달 또는 툴바 내 인라인 입력 UI로 교체

**옵션 A — 인라인 입력 row (권장, 구현 단순)**
툴바에 URL 버튼 클릭 시 버튼 옆에 `<input type="text" placeholder="https://…">` + 확인 버튼이 나타나는 방식. 에디터 포커스를 잃지 않아야 하므로, 툴바 input에서 Enter 또는 확인 버튼 클릭 시 에디터로 focus 복귀 후 `restoreSelection` → `applyLink` 순서로 실행한다.

**옵션 B — 관리자 페이지 전용 모달**
`admin.css`에 이미 관리자 스타일이 있으므로, 간단한 overlay + input 모달을 공통 헬퍼(`TiAdminModal.prompt(label)`)로 구현하고 `window.prompt()` 호출부를 교체한다. Promise 기반으로 만들면 기존 if(url) 분기를 그대로 재사용할 수 있다.

**적용 위치:** `html-editor.js`의 링크 버튼, `html-editor.js`의 이미지 URL 버튼 (단, 이미지 URL 버튼은 #7 해결책에 따라 제거 예정).

---

## 7. "이미지 URL" 삽입이 bodyImagePool에 등록 안 됨

### 현재 문제
- `execCommand("insertImage", url)` 사용 → deprecated
- `bodyImagePool`에 등록 안 됨 → 갤러리 비동기화
- `data-ti-asset-key`가 설정 안 됨 → 저장 시 경로 처리 불확실

### 해결책
이미지 URL 버튼의 동작을 **본문 이미지 업로드와 동일한 경로**로 통합한다.

1. URL을 입력받는다 (`window.prompt` → 위 #6 해결책 UI로 교체).
2. 입력된 URL을 `item.previewUrl`로, `normalizeAssetPath(url)`을 `item.assetPath`로 하는 pool 항목을 생성한다.
3. `addBodyImageToPool(url, url, true)`을 호출해 갤러리 등록 + 커서 위치에 삽입을 동시 처리한다.

단, 외부 URL 이미지는 서버 측에서 temp 경로로 관리되지 않으므로, 저장 API 설계에 따라 외부 URL을 허용할지 여부를 사전에 결정해야 한다. 허용하지 않는다면 이미지 URL 버튼 자체를 제거하고 파일 업로드만 남기는 것이 더 명확하다.

---

## 8. 제목 자동완성 정규식 오작동 가능성

### 현재 패턴
```js
var m = String(title || "").match(/<([^>]+)>/);   // movieTitle
var dash = String(title || "").indexOf(" - ");      // subtitle
```

### 문제
제목에 HTML 태그처럼 보이는 텍스트(`<리뷰>`, `<프리뷰>`)가 없는데 `<`와 `>`가 다른 위치에 올 경우 movieTitle이 엉뚱하게 파싱된다. 또한 대시(` - `) 앞에 영화 제목이 있을 때 movieTitle 파싱이 dash 파싱에 의존하지 않아 두 필드가 독립적으로 추출되어 불일치가 생길 수 있다.

### 해결책 A — 명확한 구분자 기반 포맷으로 전환
제목 포맷을 `영화제목 | 부제` 또는 `[영화제목] 부제` 형식으로 정의하고 정규식을 그에 맞춰 재작성한다. 기존 데이터 마이그레이션이 필요하다면 A/B 포맷 모두 인식하는 fallback을 추가한다.

### 해결책 B — 자동파싱 제거, 입력 필드 분리
제목, 영화 제목, 부제를 처음부터 별도 입력 필드로만 관리하고 `parseTitleFields` 자동파싱을 제거한다. 관리자가 직접 각 필드를 입력하므로 파싱 오류 가능성이 없어진다.

### 권장
해결책 B. 자동파싱은 편의 기능이지만 불일치 시 디버그가 어렵다. `title` 필드 자체를 제거하거나 읽기 전용 조합 미리보기로만 사용하는 것도 고려할 수 있다.

---

## 9. `focus` 이벤트 savedRange 덮어쓰기 엣지 케이스

### 해결책
`body.addEventListener("focus", saveSelection)` 리스너를 제거한다.

`saveSelection`은 `keyup`과 `mouseup`으로 이미 등록되어 있어, 사용자가 에디터 내에서 타이핑하거나 클릭할 때마다 갱신된다. `focus` 이벤트에서 추가로 저장할 필요가 없으며, 오히려 외부 클릭 후 툴바 버튼 클릭 시 브라우저가 focus 이동 중에 임의 커서를 설정하면 `savedRange`를 오염시킨다.

만약 에디터가 처음 포커스될 때 초기 커서 위치를 저장해야 하는 경우라면, `focus` 핸들러를 `{ once: true }` 옵션으로 등록해 최초 1회만 실행하도록 제한한다.

---

## 10. 선택 영역 없을 때 URL·색상·크기 버튼 무음 실패

### 해결책
각 `applyLink`, `applyColor`, `changeFontSize`, `insertQuoteBlock`, `insertTextBox` 함수의 `if (range.collapsed) return;` 분기에 **사용자에게 피드백을 제공**하는 로직을 추가한다.

**옵션 A — 툴바에 힌트 메시지 표시 (권장)**
에디터 툴바 하단에 `<div class="admin-editor-hint">` 영역을 마련하고, 선택 없이 버튼을 누를 때 "적용할 텍스트를 먼저 선택하세요."를 잠시 표시 후 자동 소거한다 (2초 timeout). `setBodyUploadStatus`와 유사한 패턴.

**옵션 B — 버튼 비활성화**
에디터 body에 `selectionchange` 이벤트를 등록해, 선택 영역이 collapsed(커서만 있음)이면 URL·색상·크기 버튼에 `disabled` 속성을 토글한다. 단, `selectionchange`는 에디터 외부 선택 변경에도 반응하므로 `body.contains(sel.anchorNode)` 조건 필터링이 필요하다.

### 권장
옵션 A. 구현이 단순하고 버튼 disabled가 오히려 기능을 숨겨 혼란을 줄 수 있다.

---

## 11. 업로드 진행 카운터 로직 가독성 문제

### 현재 문제
버그는 아니지만 `done`이 성공+실패 합계를 뜻하고 `failed`가 실패만 뜻하므로, 성공 수는 `done - failed`로 간접 계산해야 한다. 유지보수 중 `done`을 성공 전용 카운터로 오해하면 메시지 로직이 틀어진다.

### 해결책
변수 이름과 역할을 명확히 분리한다:
- `done` → `completed` (성공 + 실패 합계, 진행 표시용)
- `failed` 유지
- 성공 수는 `completed - failed` 대신 `succeeded` 변수를 별도 선언해 명시적으로 관리

최종 메시지 분기도 `succeeded === 0`, `failed === 0`, 혼합 세 가지로 명확하게 재작성한다.
