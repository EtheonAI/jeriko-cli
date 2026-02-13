import { promises as fs } from 'fs'
import path from 'path'

const FILE_PLACEHOLDER_REGEX = /\{\{FILE:([^}]+)\}\}/g

/**
 * Generate a README file from a template with {{FILE:xxx}} placeholder support.
 *
 * @param {Object} options
 * @param {string} options.repoRoot - Root directory of the repository
 * @param {string} [options.templateName] - Template name (e.g., 'app', 'web-static')
 * @param {string} [options.templatePath] - Custom path to the template file
 * @param {string} [options.outputPath] - Custom output path for the rendered file
 * @param {string} [options.templateBase] - Base directory for resolving {{FILE:xxx}} paths
 * @param {boolean} [options.skipTemplateJson=false] - Skip updating template.json
 */
export async function generateReadme({
  repoRoot,
  templateName,
  templatePath,
  outputPath,
  templateBase: customTemplateBase,
  skipTemplateJson = false,
}) {
  if (!templateName && (!templatePath || !outputPath)) {
    throw new Error('Either templateName or templatePath/outputPath must be provided')
  }

  const resolvedTemplatePath =
    templatePath ?? path.join(repoRoot, 'alternative_readmes', `${templateName}_README_template.md`)
  const resolvedOutputPath = outputPath ?? path.join(repoRoot, 'templates', templateName, 'README.md')
  const templateJsonPath = path.join(repoRoot, 'templates', templateName, 'template.json')
  const templateBase =
    customTemplateBase ??
    (templateName ? path.join(repoRoot, 'templates', templateName) : path.dirname(resolvedOutputPath))

  let templateJsonContents = null
  if (!skipTemplateJson) {
    const rawTemplateJsonContents = JSON.parse(await fs.readFile(templateJsonPath, 'utf8'))
    templateJsonContents = {
      id: rawTemplateJsonContents.id,
      name: rawTemplateJsonContents.name,
      description: rawTemplateJsonContents.description,
      capabilities: rawTemplateJsonContents.capabilities,
      files: {},
    }
  }

  const template = await fs.readFile(resolvedTemplatePath, 'utf8')
  const matches = [...template.matchAll(FILE_PLACEHOLDER_REGEX)]

  const cache = new Map()
  for (const [, rawPath] of matches) {
    const relativePath = rawPath.trim()
    if (cache.has(relativePath)) continue
    const absolutePath = path.resolve(templateBase, relativePath)
    const contents = await fs.readFile(absolutePath, 'utf8')
    cache.set(relativePath, contents.trimEnd())
    if (templateJsonContents) {
      templateJsonContents.files[relativePath] = contents.trimEnd()
    }
  }

  const rendered = template.replace(FILE_PLACEHOLDER_REGEX, (_, rawPath) => {
    const relativePath = rawPath.trim()
    if (!cache.has(relativePath)) {
      throw new Error(`Missing cached contents for ${relativePath}`)
    }
    return cache.get(relativePath)
  })

  // Ensure output directory exists
  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true })

  await fs.writeFile(resolvedOutputPath, rendered.trimEnd() + '\n', 'utf8')

  if (!skipTemplateJson && templateJsonContents) {
    await fs.writeFile(templateJsonPath, JSON.stringify(templateJsonContents, null, 2) + '\n', 'utf8')
  }

  return { placeholders: matches.length, outputPath: resolvedOutputPath }
}
