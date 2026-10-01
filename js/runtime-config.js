(() => {
    const host = window.location.hostname;
    const privateHost = /^(?:localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[::1\])$/i.test(host);
    const localPreview = privateHost
        || /(?:^|\.)local$/i.test(host)
        || (window.location.protocol === "http:" && Boolean(window.location.port) && window.location.port !== "80");
    window.MPWR_API_URL = localPreview
        ? `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:3000/v1`
        : "/api/v1";
})();
