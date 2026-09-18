import fs from "node:fs";
import path from "node:path";

const KB_PATH =
  process.env.TEGRIDY_KB_PATH ||
  "/data/workspace/knowledge_base.json";

const BACKUP_DIR =
  process.env.TEGRIDY_KB_BACKUP_DIR ||
  "/data/workspace/kb-backups";

function fail(message, code = 1) {
  process.stderr.write(
    JSON.stringify({
      ok: false,
      error: message,
    }) + "\n"
  );
  process.exit(code);
}

function success(data) {
  process.stdout.write(
    JSON.stringify({
      ok: true,
      ...data,
    }) + "\n"
  );
}

function readInput() {
  const raw = process.argv[2];

  if (!raw) {
    fail(
      'Missing operation. Expected JSON such as {"oldText":"$102","newText":"$105"}'
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    fail("Operation is not valid JSON.");
  }
}

function validateOperation(operation) {
  if (
    !operation ||
    typeof operation !== "object" ||
    Array.isArray(operation)
  ) {
    fail("Operation must be a JSON object.");
  }

  const allowedKeys = new Set(["oldText", "newText"]);

  for (const key of Object.keys(operation)) {
    if (!allowedKeys.has(key)) {
      fail(`Unsupported operation field: ${key}`);
    }
  }

  if (
    typeof operation.oldText !== "string" ||
    operation.oldText.length === 0
  ) {
    fail("oldText must be a non-empty string.");
  }

  if (typeof operation.newText !== "string") {
    fail("newText must be a string.");
  }

  if (operation.oldText === operation.newText) {
    fail("oldText and newText are identical.");
  }
}

function validateJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(`${label} is not valid JSON: ${err.message}`);
  }
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let position = 0;

  while (true) {
    const index = haystack.indexOf(needle, position);

    if (index === -1) {
      break;
    }

    count += 1;
    position = index + needle.length;
  }

  return count;
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
}

const operation = readInput();
validateOperation(operation);

if (!fs.existsSync(KB_PATH)) {
  fail(`Knowledge base not found: ${KB_PATH}`);
}

const currentText = fs.readFileSync(KB_PATH, "utf8");
const currentJson = validateJson(
  currentText,
  "Current knowledge base"
);

const matches = countOccurrences(
  currentText,
  operation.oldText
);

if (matches === 0) {
  fail(
    "The expected current text was not found. The KB may have changed since the proposal was created."
  );
}

if (matches > 1) {
  fail(
    `The expected current text occurs ${matches} times. Refusing an ambiguous update.`
  );
}

const updatedText = currentText.replace(
  operation.oldText,
  operation.newText
);

const updatedJson = validateJson(
  updatedText,
  "Proposed knowledge base"
);

if (
  JSON.stringify(currentJson) ===
  JSON.stringify(updatedJson)
) {
  fail("The operation produced no JSON data change.");
}

// Increment numeric KB version when available.
if (
  typeof updatedJson.version === "number" &&
  Number.isFinite(updatedJson.version)
) {
  updatedJson.version += 1;
}

// Record the UTC calendar date of the successful update.
if (
  Object.prototype.hasOwnProperty.call(
    updatedJson,
    "last_updated"
  )
) {
  updatedJson.last_updated =
    new Date().toISOString().slice(0, 10);
}

const finalText =
  JSON.stringify(updatedJson, null, 2) + "\n";

// Validate the exact bytes we intend to write.
validateJson(finalText, "Final knowledge base");

fs.mkdirSync(BACKUP_DIR, {
  recursive: true,
});

const backupPath = path.join(
  BACKUP_DIR,
  `knowledge_base.${timestamp()}.json`
);

fs.copyFileSync(KB_PATH, backupPath);

const tempPath =
  `${KB_PATH}.tmp-${process.pid}-${Date.now()}`;

try {
  fs.writeFileSync(tempPath, finalText, {
    encoding: "utf8",
    mode: 0o600,
  });

  // Final validation before replacing the live KB.
  const tempText = fs.readFileSync(
    tempPath,
    "utf8"
  );

  validateJson(
    tempText,
    "Temporary knowledge base"
  );

  fs.renameSync(tempPath, KB_PATH);
} catch (err) {
  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  } catch {
    // Ignore cleanup errors.
  }

  fail(`Failed to write knowledge base: ${err.message}`);
}

success({
  message: "Knowledge base updated successfully.",
  backup: backupPath,
  version:
    typeof updatedJson.version === "number"
      ? updatedJson.version
      : null,
  last_updated:
    updatedJson.last_updated ?? null,
});
