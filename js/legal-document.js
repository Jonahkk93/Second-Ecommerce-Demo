document.querySelector(".information-print")?.addEventListener("click", () => window.print());
const topicLinks = [...document.querySelectorAll(".information-contents a")];
function updateCurrentTopic() {
    topicLinks.forEach(link => {
        if (link.hash === window.location.hash) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
    });
}
window.addEventListener("hashchange", updateCurrentTopic);
updateCurrentTopic();
