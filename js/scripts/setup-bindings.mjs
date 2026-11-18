import { createHash } from "node:crypto";
import { lstatSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { applyEdits, modify, parse } from "jsonc-parser";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestName = ".picoruby-cloudflare-template.json";
// Fingerprint of the unmodified starter app.rb.
const starterAppHash = "efcc1012edb79477365b0e77a68033e6e1735731ffb12b02332536459216de64";
const examples = [
  [["kv_namespaces"], [{ binding: "CACHE_KV" }]],
  [["queues", "producers"], [{ binding: "EVENTS", queue: "events" }]],
  [["durable_objects", "bindings"], [{ name: "OBJECTS", class_name: "PicoRubyDurableObject" }]],
  [["migrations"], [{ tag: "v1", new_sqlite_classes: ["PicoRubyDurableObject"] }]],
  [["vars", "CF_ACCESS_TEAM"], ""],
];

function readProjectFile(name, optional = false) {
  const path = join(root, name);
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat && optional) return undefined;
  if (!stat?.isFile()) throw new Error(name + " must be a regular file");
  return readFileSync(path, "utf8");
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addExamples(source) {
  const errors = [];
  const config = parse(source, errors, { allowTrailingComma: true });
  if (errors.length || !isObject(config)) throw new Error("Invalid wrangler.jsonc");

  const indentation = source.match(/^([ \t]+)"/m)?.[1] ?? "  ";
  const formattingOptions = {
    insertSpaces: !indentation.startsWith("\t"),
    tabSize: indentation.length,
    eol: source.includes("\r\n") ? "\r\n" : "\n",
  };

  for (const [path, value] of examples) {
    const [key, nested] = path;
    const section = config[key];
    if (nested && section !== undefined && !isObject(section)) {
      throw new Error("Binding examples conflict with wrangler.jsonc: " + key);
    }
    const current = nested ? section?.[nested] : section;
    if (current === undefined) {
      source = applyEdits(source, modify(source, path, value, { formattingOptions }));
    } else if (!isDeepStrictEqual(current, value)) {
      throw new Error("Binding examples conflict with wrangler.jsonc: " + path.join("."));
    }
  }
  return source;
}

function setupBindings() {
  const app = readProjectFile("app.rb");
  const config = readProjectFile("wrangler.jsonc");
  const sampleApp = readFileSync(new URL("bindings-app.rb", import.meta.url), "utf8");
  const manifest = readProjectFile(manifestName, true);
  const previous = manifest === undefined ? undefined : JSON.parse(manifest);
  if (previous !== undefined && (previous?.format_version !== 1 || !isObject(previous.files))) {
    throw new Error("Invalid binding examples manifest");
  }

  if (app !== sampleApp && ![starterAppHash, previous?.files["app.rb"]].includes(sha256(app))) {
    throw new Error("Binding examples conflict with modified app.rb");
  }
  if (previous && sha256(config) !== previous.files["wrangler.jsonc"]) {
    throw new Error("Binding examples conflict with modified wrangler.jsonc");
  }

  const sampleConfig = addExamples(config);
  const nextManifest = JSON.stringify({
    format_version: 1,
    features: ["kv", "queue", "durable_object", "access"],
    files: { "app.rb": sha256(sampleApp), "wrangler.jsonc": sha256(sampleConfig) },
  }, null, 2) + "\n";
  const changes = [
    ["app.rb", app, sampleApp],
    ["wrangler.jsonc", config, sampleConfig],
    [manifestName, manifest, nextManifest],
  ].filter(([, before, after]) => before !== after);

  if (changes.length === 0) {
    console.log("Binding examples are up to date.");
    return;
  }

  const stage = mkdtempSync(join(root, ".binding-examples-"));
  try {
    for (const [name, , after] of changes) writeFileSync(join(stage, name), after);
    for (const [name] of changes) renameSync(join(stage, name), join(root, name));
  } finally {
    rmSync(stage, { recursive: true });
  }
  console.log("Added KV, Queue, Durable Object and Access examples.");
}

try {
  setupBindings();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
