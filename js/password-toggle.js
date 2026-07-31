document.querySelectorAll('input[type="password"]').forEach(input => {
    const wrapper = document.createElement("div");
    wrapper.className = "password-field";
    input.before(wrapper);
    wrapper.append(input);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-toggle";
    button.setAttribute("aria-label", "Show password");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <svg class="eye-on" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
      <svg class="eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 6.2A9 9 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-3 3.7M6.2 6.2C3.8 7.9 2.5 12 2.5 12s3.5 6 9.5 6a10 10 0 0 0 3-.5"/></svg>`;

    button.addEventListener("click", () => {
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.setAttribute("aria-pressed", String(reveal));
        button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
        input.focus({preventScroll:true});
    });
    wrapper.append(button);
});
