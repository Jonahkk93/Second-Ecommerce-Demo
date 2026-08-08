(() => {
    fetch("index.html")
        .then(response => {
            if (!response.ok) throw new Error(`Unable to load page (${response.status})`);
            return response.text();
        })
        .then(markup => {
            markup = markup.replace(
                '<a href="index.html" class="logo">MPWR</a>',
                '<a href="index.html" class="category-back-button" aria-label="Back to home"></a>'
            );

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
