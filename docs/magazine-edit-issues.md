# magazine-edit 인페이지 HTML 에디터 — 잠재적 문제 목록

대상 파일
- `admin/magazine-edit.html`
- `js/admin/html-editor.js`
- `js/admin/magazine-edit-page.js`

---

## 1. `document.execCommand` 전체 deprecated

**파일:** `html-editor.js:132, 740, 753`

`bold`, `italic`, `underline`, `insertUnorderedList`, `insertOrderedList`, `insertLineBreak`, `insertText` 등 핵심 서식 기능이 모두 `document.execCommand()`에 의존한다. 이 API는 W3C에서 deprecated 처리됐고 Chrome/Firefox 최신 버전에서 단계적으로 제거 예정이다. 현재는 동작하지만, 미래 브라우저 업데이트 시 서식 기능 전체가 동시에 중단될 수 있다.

---

## 2. 색상 피커 드래그 시 color span 중첩 누적

**파일:** `html-editor.js:160–202, 711–713`

`<input type="color">`의 이벤트 핸들러가 `change`가 아닌 `input`으로 등록되어 있다. 사용자가 피커 안에서 드래그하면 `applyColor`가 연속으로 수십 회 호출된다.

`applyColor` 내부는 매번:
1. `range.extractContents()` — 기존 선택 영역을 DOM에서 제거
2. 새 `<span style="color:...">` 생성 후 삽입
3. `savedRange`를 새 span 내부로 갱신

결과적으로 드래그할 때마다 span이 중첩(`<span><span><span>…</span></span></span>`)되어 최종 저장 HTML이 불필요하게 오염된다.

---

## 3. `insertHtmlAtCursor` 다중 노드 삽입 순서 역전

**파일:** `html-editor.js:552–581`

```js
nodes.forEach(function (node) {
  range.insertNode(node);   // 매번 range.start 위치에 삽입
  last = node;
});
```

`Range.insertNode()`는 range.start 위치에 노드를 삽입하고 range.start를 **해당 노드 앞**으로 이동시키지 않는다. 결과적으로 두 번째 노드가 첫 번째 노드 앞에 들어간다.

**직접 영향:** `insertTextBox`에서 전달하는 HTML
```
'<div class="mz-text-box">…</div><p><br></p>'
```
가 실제로는 `<p><br></p>` → `<div class="mz-text-box">…</div>` 순서로 삽입된다. 즉, 빈 단락이 텍스트박스 앞에 생성된다.

---

## 4. 에디터 본문 "삭제" 버튼이 bodyImagePool과 동기화 안 됨

**파일:** `magazine-edit-page.js:779–789`

에디터 body 내 figure의 "삭제" 버튼 클릭 시 DOM에서 figure만 제거한다. 그러나 `removeBodyImageFromPool(id)`를 호출하지 않아 **하단 갤러리 썸네일은 그대로 남는다.** 사용자가 삭제한 이미지를 갤러리에서 다시 드래그해 본문에 재삽입할 수 있고, 저장 시 서버에 해당 temp 경로가 그대로 전달된다.

반면 갤러리의 "×" 버튼(pool 삭제)은 `removeBodyImageFromPool`을 통해 에디터 본문 figure도 함께 제거한다. 두 경로의 동작이 비대칭이다.

---

## 5. `sanitizeOutputHtml` 정규식이 mz-text-box를 삭제

**파일:** `html-editor.js:455–456`

```js
.replace(/<div(\s[^>]*)?>\s*<br\s*\/?>\s*<\/div>/gi, "<br>")
```

이 정규식은 `<br>` 만 포함한 모든 `<div>`를 `<br>` 하나로 치환한다. 빈 텍스트박스 `<div class="mz-text-box"><br></div>`도 동일하게 매칭되어 클래스 정보가 소실된 `<br>` 로 변환된다. 사용자가 텍스트박스를 비워놓고 저장하면 텍스트박스 구조 자체가 사라진다.

---

## 6. `window.prompt()` 로 URL·이미지 URL 입력

**파일:** `html-editor.js:631, 647, 725`

URL 입력 및 이미지 URL 삽입에 `window.prompt()`를 사용한다. 이 API는:
- 크로스오리진 iframe 내에서 차단됨
- 일부 브라우저/환경의 팝업 차단기에 의해 무음 차단될 수 있음
- 모바일에서 UX가 매우 나쁨

`window.prompt()`가 차단되면 `null`이 반환되어 링크/이미지 삽입 자체가 조용히 실패한다.

---

## 7. "이미지 URL" 버튼 삽입 이미지가 bodyImagePool에 등록 안 됨

**파일:** `html-editor.js:724–728`, `magazine-edit-page.js`

"이미지 URL" 버튼은 `execCommand("insertImage", url)`로 이미지를 삽입한다. 이 경로에서는:
- `addBodyImageToPool`이 호출되지 않아 하단 갤러리에 나타나지 않음
- `data-ti-asset-key`가 자동으로 설정되지 않아 `wrapImgAsFigure`에서 `pathFromImgSrc(src)`로 asset path를 추정함
- 전체 절대 URL(`https://…`)이 src에 들어갈 경우 `normalizeAssetPath`에서 pathname만 추출해 key로 쓰이는데, 이것이 서버 측 예상 경로와 일치한다는 보장이 없음

---

## 8. `parseTitleFields` 정규식이 HTML 태그처럼 보이는 제목에 오작동

**파일:** `magazine-edit-page.js:175`

```js
var m = String(title || "").match(/<([^>]+)>/);
if (m) movieTitle = m[1].trim();
```

제목에 꺽쇠 문자(`<`, `>`)가 포함된 경우(예: `"<기생충> 리뷰 - 봉준호의 귀환"`) `movieTitle`이 의도대로 파싱된다. 그러나 이 정규식은 HTML 태그 형식 없이 `<`와 `>` 문자만 있는 문자열에도 반응한다. 제목 필드에 `<` 와 `>` 가 잘못된 위치에 오면 `movieTitle` 자동완성이 엉뚱한 값으로 채워질 수 있다.

---

## 9. `saveSelection`을 `focus` 이벤트에 등록하여 savedRange 덮어쓰기 가능

**파일:** `html-editor.js:733`

```js
body.addEventListener("focus", saveSelection);
```

사용자가 에디터 외부의 요소를 클릭 → 툴바 버튼 클릭 순서로 조작할 때, `body.focus()`가 내부적으로 호출되면서 `focus` 이벤트가 발생한다. 이때 브라우저가 selection을 에디터 내부의 임의 위치로 이동시키면 `saveSelection`이 `savedRange`를 덮어쓰고, 이후 `restoreSelection`이 의도하지 않은 위치로 커서를 복원할 수 있다.

현재는 `if (!body.contains(sel.anchorNode)) return` 조건이 대부분의 경우를 막지만, 브라우저가 focus 시 body 내부에 기본 커서를 놓는 경우에는 이 방어 코드가 작동하지 않는다.

---

## 10. `applyLink` / `applyColor` / `changeFontSize` 가 collapsed range에서 조용히 실패

**파일:** `html-editor.js:213, 168, 307`

텍스트를 선택하지 않고(커서만 위치한 상태) URL 버튼, 색상 피커, 글자 크기 버튼을 누르면 `if (range.collapsed) return;`으로 조용히 종료된다. 사용자에게 아무런 피드백이 없어 기능이 고장난 것처럼 보일 수 있다.

---

## 11. 업로드 진행 카운터가 완료 직전에 잘못된 수치 표시

**파일:** `magazine-edit-page.js:711, 738`

`uploadBodyFiles` 초기 상태 메시지가 `"업로드 중… (0/N)"` 으로 시작하고, 각 완료 시 `done += 1` 후 `"(done/total)"` 을 표시한다. 마지막 파일이 완료되어 `next()`가 호출될 때 `list.length === 0`이 되어 최종 메시지를 표시하지만, 이때 `done`은 이미 `total`과 같다. 정상 동작이나, 성공/실패 혼합 케이스의 최종 메시지에서 `done - failed`가 성공 수를 올바르게 계산하는지 주의가 필요하다(`done`은 성공+실패 합계이므로 실제로는 맞음). 이슈는 없으나 가독성이 낮아 유지보수 시 혼동 가능.
