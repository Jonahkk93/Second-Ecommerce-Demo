import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "dist");
const assetDirectories = ["css", "data", "fonts", "images", "js"];
const deploymentVersion = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString()).slice(0,12);

if (outputRoot === projectRoot || path.dirname(outputRoot) !== projectRoot) {
    throw new Error("Refusing to build outside the project dist directory.");
}

await rm(outputRoot, { recursive:true, force:true });
await mkdir(outputRoot, { recursive:true });

const rootEntries = await readdir(projectRoot, { withFileTypes:true });
const htmlFiles = rootEntries
    .filter(entry => entry.isFile() && entry.name.endsWith(".html"))
    .map(entry => entry.name);

await Promise.all([
    ...assetDirectories.map(directory =>
        cp(path.join(projectRoot,directory), path.join(outputRoot,directory), { recursive:true })
    ),
    ...htmlFiles.map(file => cp(path.join(projectRoot,file), path.join(outputRoot,file)))
]);

async function versionLocalReferences(directory) {
    const entries = await readdir(directory, { withFileTypes:true });
    await Promise.all(entries.map(async entry => {
        const target = path.join(directory,entry.name);
        if (entry.isDirectory()) {
            await versionLocalReferences(target);
            return;
        }
        if (!entry.name.endsWith(".html") && !entry.name.endsWith(".js")) return;
        const source = await readFile(target,"utf8");
        const versioned = source.replace(
            /(["'`])((?!https?:|data:)[^"'`\s?]+\.(?:css|js))(?:\?[^"'`\s]*)?/g,
            `$1$2?v=${deploymentVersion}`
        );
        if (versioned !== source) await writeFile(target,versioned);
    }));
}

await versionLocalReferences(outputRoot);
console.log(`Built MPWR into dist with asset version ${deploymentVersion}.`);
