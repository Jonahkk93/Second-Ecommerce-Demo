(() => {
    fetch("index.html")
        .then(response => {
            if (!response.ok) throw new Error(`Unable to load page (${response.status})`);
            return response.text();
        })
        .then(markup => {
            document.open();
            document.write(markup);
            document.close();
        })
        .catch(error => {
            document.body.innerHTML = `
                <main style="padding:40px;font-family:system-ui;text-align:center">
                    <h1>Unable to load this page</h1>
                    <p>${error.message}</p>
                    <a href="index.html">Return home</a>
                </main>
            `;
        });
})();
