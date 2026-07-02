(function () {
  TiAdminAuth.whenReady().then(function (loggedIn) {
    window.location.replace(loggedIn ? "dashboard.html" : "login.html");
  });
})();
