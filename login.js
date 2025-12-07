document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.querySelector(".login-form");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault(); // Prevent form from actually submitting
    window.location.href = "plot.html"; // Redirect to plot.html
  });
});