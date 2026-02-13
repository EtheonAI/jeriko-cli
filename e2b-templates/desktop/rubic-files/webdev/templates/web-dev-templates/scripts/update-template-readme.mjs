#!/usr/bin/env node
import { generateReadme } from "./lib/readme-generator.mjs";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const helpText = `Usage: node scripts/update-template-readme.mjs <template-name>|--all\n\nExamples:\n  node scripts/update-template-readme.mjs web-basic\n  node scripts/update-template-readme.mjs --all`;

/**
 * Configuration for additional README files per template.
 * Each entry maps a template name to an array of extra README configs.
 */
const EXTRA_READMES = {
  app: [
    {
      // Backend development guide for Expo app template
      templateFile: "app_backend_README_template.md",
      outputSubPath: "server/README.md",
    },
  ],
};

async function listTemplates() {
  const entries = await fs.readdir(path.join(repoRoot, "templates"), {
    withFileTypes: true,
  });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function run() {
  if (args.length === 0 || args.includes("--help")) {
    console.log(helpText);
    return;
  }

  let templates = [];
  if (args.includes("--all")) {
    templates = await listTemplates();
  } else {
    templates = args;
  }

  if (templates.length === 0) {
    console.error("No templates specified.");
    process.exit(1);
  }

  const results = [];
  for (const templateName of templates) {
    // Process main README
    const mainTemplateFile = path.join(
      repoRoot,
      "alternative_readmes",
      `${templateName}_README_template.md`
    );

    try {
      await fs.access(mainTemplateFile);
    } catch {
      console.warn(
        `Skipping ${templateName}: missing template file at ${path.relative(
          repoRoot,
          mainTemplateFile
        )}`
      );
      continue;
    }

    try {
      const result = await generateReadme({ repoRoot, templateName });
      results.push({ templateName, type: "main", ...result });
    } catch (error) {
      console.error(`Failed to update README for ${templateName}:`, error.message, error);
      process.exitCode = 1;
    }

    // Process extra READMEs if configured
    const extraConfigs = EXTRA_READMES[templateName];
    if (extraConfigs && Array.isArray(extraConfigs)) {
      for (const config of extraConfigs) {
        const extraTemplatePath = path.join(repoRoot, "alternative_readmes", config.templateFile);
        const extraOutputPath = path.join(
          repoRoot,
          "templates",
          templateName,
          config.outputSubPath
        );
        const templateBase = path.join(repoRoot, "templates", templateName);

        try {
          await fs.access(extraTemplatePath);
        } catch {
          console.warn(
            `Skipping extra README for ${templateName}: missing template file at ${path.relative(
              repoRoot,
              extraTemplatePath
            )}`
          );
          continue;
        }

        try {
          const result = await generateReadme({
            repoRoot,
            templateName,
            templatePath: extraTemplatePath,
            outputPath: extraOutputPath,
            templateBase,
            skipTemplateJson: true,
          });
          results.push({
            templateName,
            type: config.outputSubPath,
            ...result,
          });
        } catch (error) {
          console.error(
            `Failed to update extra README (${config.outputSubPath}) for ${templateName}:`,
            error.message
          );
          process.exitCode = 1;
        }
      }
    }
  }

  if (results.length > 0) {
    for (const { templateName, type, placeholders } of results) {
      const typeLabel = type === "main" ? "README" : type;
      console.log(
        `Updated ${templateName} ${typeLabel} with ${placeholders} placeholder${
          placeholders === 1 ? "" : "s"
        }.`
      );
    }
  }
}

run();
