// Reload even when the current address already matches the application's URL.
document.querySelector("#retry-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  location.reload();
});
