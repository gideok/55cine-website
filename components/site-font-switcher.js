/**
 * 과거 헤더의 폰트 선택 UI 연동 스크립트였음.
 * 사이트 기본 폰트는 components/site-common.css 에서 Spoqa Han Sans Neo 로 고정.
 * 브라우저에 저장돼 있던 선택값만 제거해 예전 적용값이 남지 않게 한다.
 */
(function () {
  try {
    localStorage.removeItem("55cine-site-font");
  } catch (e) {
    /* noop */
  }
})();
