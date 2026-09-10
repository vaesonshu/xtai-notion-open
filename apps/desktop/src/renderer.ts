const retry = document.getElementById("retry")

retry?.addEventListener("click", () => {
  void window.electronDesktop?.retryLoad()
})
