/**
 * 간단한 contenteditable HTML 에디터
 */
(function (global) {
  function createHtmlEditor(container, initialHtml) {
    var toolbar = document.createElement("div");
    toolbar.className = "admin-editor-toolbar";

    var body = document.createElement("div");
    body.className = "admin-editor-body";
    body.contentEditable = "true";
    body.innerHTML = initialHtml || "";

    function exec(cmd, val) {
      body.focus();
      document.execCommand(cmd, false, val || null);
    }

    var buttons = [
      { label: "굵게", cmd: "bold" },
      { label: "기울임", cmd: "italic" },
      { label: "밑줄", cmd: "underline" },
      { label: "링크", cmd: "createLink", prompt: "URL" },
      { label: "목록", cmd: "insertUnorderedList" },
      { label: "번호목록", cmd: "insertOrderedList" }
    ];

    buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.label;
      btn.addEventListener("click", function () {
        if (b.prompt) {
          var url = global.prompt(b.prompt);
          if (url) exec(b.cmd, url);
        } else {
          exec(b.cmd);
        }
      });
      toolbar.appendChild(btn);
    });

    var imgBtn = document.createElement("button");
    imgBtn.type = "button";
    imgBtn.textContent = "이미지 URL";
    imgBtn.addEventListener("click", function () {
      var url = global.prompt("이미지 URL");
      if (url) exec("insertImage", url);
    });
    toolbar.appendChild(imgBtn);

    container.appendChild(toolbar);
    container.appendChild(body);

    return {
      getHtml: function () {
        return body.innerHTML;
      },
      setHtml: function (html) {
        body.innerHTML = html || "";
      },
      getBodyEl: function () {
        return body;
      }
    };
  }

  global.TiHtmlEditor = { create: createHtmlEditor };
})(typeof window !== "undefined" ? window : globalThis);
