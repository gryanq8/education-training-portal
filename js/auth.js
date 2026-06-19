const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginMessage.textContent = "جاري تسجيل الدخول...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    loginMessage.textContent = "تعذر تسجيل الدخول: " + error.message;
    return;
  }

  loginMessage.textContent = "تم تسجيل الدخول بنجاح";
  window.location.href = "dashboard.html";
});
