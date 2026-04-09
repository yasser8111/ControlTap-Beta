/**
 * main.js
 * Bootstraps the application natively.
 */
document.addEventListener("DOMContentLoaded", () => {
  window.App = new AppController();
  window.App.init().catch((err) =>
    console.error("Critical Failure to initialize StartPage system.", err),
  );
});
