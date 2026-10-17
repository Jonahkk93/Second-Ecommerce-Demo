import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
function shell({ title, description, content, back = "about-mpwr.html", backLabel = "Back to About MPWR", script = "", hub = false }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="description" content="${escape(description)}">
    <title>${escape(title)} | MPWR</title>
    <link rel="stylesheet" href="css/Larke.css">
    <link rel="stylesheet" href="css/information.css">
    <link rel="stylesheet" href="css/mpwr-select.css">
    <script type="module" src="js/mpwr-select.js"></script>
    <link rel="stylesheet" href="css/cookie-consent.css">
    <script src="js/cookie-consent.js"></script>
    <script src="js/runtime-config.js"></script>
    ${script ? `<script type="module" src="js/${escape(script)}"></script>` : ""}
</head>
<body class="${hub ? "information-hub" : "information-detail"}">
    <a class="information-skip" href="#main-content">Skip to content</a>
    <header class="information-header">
        <a class="information-back" href="${escape(back)}" aria-label="${escape(backLabel)}"></a>
        <h1>${escape(title)}</h1>
        <span aria-hidden="true"></span>
    </header>
    ${content}
</body>
</html>
`;
}

export async function buildInformationPages() {
    const pages = JSON.parse(await readFile(path.join(root, "data/information-pages.json"), "utf8"));
    for (const page of pages) {
        if (!/^[a-z0-9-]+$/.test(page.slug)) throw new Error("Invalid information page slug");
        const content = `<main id="main-content" class="information-article">
        <a class="information-breadcrumb" href="about-mpwr.html#${page.slug}">About MPWR <span aria-hidden="true">/</span> ${escape(page.title)}</a>
        ${page.updated ? `<p class="information-updated">Updated ${escape(page.updated)}${page.version ? ` · Version ${escape(page.version)}` : ""}</p>` : ""}
        <div class="information-intro"><p class="information-kicker">MPWR · Shopping & information</p><h2>${escape(page.intro)}</h2></div>
        ${page.version ? `<nav class="information-contents" aria-labelledby="information-contents-title"><div class="information-contents-heading"><h2 id="information-contents-title">On this page</h2><span>${page.sections.length} topics</span></div><ol>${page.sections.map((section, index) => `<li><a href="#${escape(section.id || `section-${index + 1}`)}"><span class="information-topic-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><span class="information-topic-label">${escape(section.title.replace(/^\d+\.\s*/, ""))}</span><span class="information-topic-arrow" aria-hidden="true"></span></a></li>`).join("")}</ol></nav><p class="information-print-row"><button class="information-print" type="button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-3"/><path d="M7 14h10v7H7zM17 11h1"/></svg><span>Print / save a copy</span></button></p><script src="js/legal-document.js" defer></script>` : ""}
        ${page.sections.map((section, index) => `<section class="information-section" id="${escape(section.id || `section-${index + 1}`)}"><h2>${escape(section.title)}</h2>${section.html}</section>`).join("\n        ")}
        <nav class="information-actions" aria-label="Related actions">${page.actions.map(([href, label], index) => `<a class="${index ? "information-secondary-action" : "information-primary-action"}" href="${escape(href)}">${escape(label)}<span aria-hidden="true">›</span></a>`).join("")}</nav>
        <a class="information-all-topics" href="about-mpwr.html#${page.slug}">Back to all topics</a>
    </main>`;
        await writeFile(path.join(root, `${page.slug}.html`), shell({ title: page.title, description: page.intro, content, back: `about-mpwr.html#${page.slug}`, script: page.script }));
    }
    const links = [...pages.map(page => ({ href: `${page.slug}.html`, id: page.slug, title: page.title })), { href: "feedback.html", id: "feedback", title: "Feedback & Rating" }, { href: "manage-cookies.html", id: "manage-cookies", title: "Manage Cookies" }];
    const content = `<main id="main-content" class="information-directory">
        <nav aria-label="About MPWR information">
            ${links.map(link => `<a class="information-row" id="${link.id}" href="${link.href}"${link.id === "manage-cookies" ? " data-manage-cookies" : ""}><span>${escape(link.title)}</span><span class="information-chevron" aria-hidden="true"></span></a>`).join("\n            ")}
        </nav>
    </main>`;
    await writeFile(path.join(root, "about-mpwr.html"), shell({ title: "About MPWR", description: "MPWR shipping, returns, payments, reviews, shopping guides and information about us.", content, back: "Account.html", backLabel: "Back to my account", hub: true }));
    // A version is immutable: changing a policy requires a new version and archive.
    const version = pages.find(page => page.slug === "terms-and-conditions").version;
    if (!/^[0-9.-]+$/.test(version)) throw new Error("Invalid legal policy version");
    const archive = path.join(root, "legal-archive", version);
    await mkdir(archive, { recursive: true });
    const archived = pages.filter(page => ["terms-and-conditions", "privacy-policy", "return-policy", "refunds"].includes(page.slug));
    for (const page of archived) {
        const article = page.sections.map(section => `<section${section.id ? ` id="${escape(section.id)}"` : ""}><h2>${escape(section.title)}</h2>${section.html}</section>`).join("\n");
        const linked = article.replace(/href="([^"#]+)"/g, (match, href) => /^(https?:|mailto:|tel:)/.test(href) ? match : `href="${archived.some(item => href.split("#")[0] === `${item.slug}.html`) ? href : `../../${href}`}"`);
        const snapshot = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(page.title)} · MPWR · ${version}</title><style>body{font:16px/1.7 system-ui,sans-serif;color:#333;max-width:800px;margin:40px auto;padding:0 24px}h1{font-size:30px}h2{font-size:22px;margin-top:32px}a{color:#925337}@media print{body{margin:0;max-width:none}}</style></head><body><p>MPWR · Policy archive · Version ${version} · Effective 17 October 2026</p><h1>${escape(page.title)}</h1>${linked}</body></html>\n`;
        const target = path.join(archive, `${page.slug}.html`);
        try { await writeFile(target, snapshot, { flag: "wx" }); }
        catch (error) {
            if (error.code !== "EEXIST") throw error;
            if (await readFile(target, "utf8") !== snapshot) throw new Error(`Archived policy changed: ${page.slug}. Create a new legal policy version.`);
        }
    }
    return pages;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const pages = await buildInformationPages();
    console.log(`Built About MPWR and ${pages.length} information pages.`);
}
