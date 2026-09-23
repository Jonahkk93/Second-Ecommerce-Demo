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
      <img class="eye-on" src="images/Icon Folder/Password Visible Icon_333 .PNG" alt="">
      <img class="eye-off" src="images/Icon Folder/Password Hidden Icon_333.PNG" alt="">`;

    button.addEventListener("click", () => {
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.setAttribute("aria-pressed", String(reveal));
        button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
        input.focus({preventScroll:true});
    });
    wrapper.append(button);
});
