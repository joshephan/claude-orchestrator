/**
 * CSS token extraction utility module
 *
 * Provides functions for extracting design tokens from CSS files,
 * CSS variables, and Tailwind configurations.
 */

import fs from 'fs-extra';
import path from 'path';
import type { DesignTokens, FontToken } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * CSS tokens extracted from project
 */
export interface CSSTokens {
  colors: Record<string, string>;
  fonts: Record<string, FontToken>;
  spacing: Record<string, string>;
  borderRadius?: Record<string, string>;
  shadows?: Record<string, string>;
}

/**
 * Options for CSS extraction
 */
export interface CSSExtractionOptions {
  /** Root directory to search */
  rootDir: string;
  /** CSS file patterns to include */
  cssPatterns?: string[];
  /** Whether to parse Tailwind config */
  parseTailwind?: boolean;
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract CSS tokens from a project
 *
 * @param options - Extraction options
 * @returns Extracted CSS tokens
 */
export async function extractCSSTokens(
  options: CSSExtractionOptions
): Promise<CSSTokens> {
  const tokens: CSSTokens = {
    colors: {},
    fonts: {},
    spacing: {},
    borderRadius: {},
    shadows: {},
  };

  const { rootDir, parseTailwind = true } = options;

  // Find and parse CSS files with variables
  const cssFiles = await findCSSFiles(rootDir);
  for (const cssFile of cssFiles) {
    const cssTokens = await parseCSSFile(cssFile);
    mergeTokens(tokens, cssTokens);
  }

  // Parse Tailwind config if present
  if (parseTailwind) {
    const tailwindTokens = await parseTailwindConfig(rootDir);
    if (tailwindTokens) {
      mergeTokens(tokens, tailwindTokens);
    }
  }

  return tokens;
}

// ============================================================================
// CSS File Parsing
// ============================================================================

/**
 * Find CSS files that might contain design tokens
 */
async function findCSSFiles(rootDir: string): Promise<string[]> {
  const cssFiles: string[] = [];
  const targetFiles = [
    'src/styles/variables.css',
    'src/styles/globals.css',
    'src/styles/tokens.css',
    'src/globals.css',
    'src/index.css',
    'styles/variables.css',
    'styles/globals.css',
    'app/globals.css',
    'css/variables.css',
    ':root.css',
  ];

  for (const file of targetFiles) {
    const fullPath = path.join(rootDir, file);
    if (await fs.pathExists(fullPath)) {
      cssFiles.push(fullPath);
    }
  }

  return cssFiles;
}

/**
 * Parse a CSS file for design tokens (CSS variables)
 */
async function parseCSSFile(filePath: string): Promise<Partial<CSSTokens>> {
  const tokens: Partial<CSSTokens> = {
    colors: {},
    fonts: {},
    spacing: {},
    borderRadius: {},
    shadows: {},
  };

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const variables = extractCSSVariables(content);

    for (const [name, value] of Object.entries(variables)) {
      categorizeToken(name, value, tokens);
    }
  } catch {
    // Ignore file read errors
  }

  return tokens;
}

/**
 * Extract CSS custom properties (variables) from CSS content
 */
export function extractCSSVariables(css: string): Record<string, string> {
  const variables: Record<string, string> = {};

  // Match CSS custom properties: --name: value;
  const regex = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = regex.exec(css)) !== null) {
    const name = match[1].trim();
    const value = match[2].trim();
    variables[name] = value;
  }

  return variables;
}

/**
 * Categorize a CSS variable into the appropriate token category
 */
function categorizeToken(
  name: string,
  value: string,
  tokens: Partial<CSSTokens>
): void {
  const lowerName = name.toLowerCase();

  // Color tokens
  if (
    lowerName.includes('color') ||
    lowerName.includes('bg') ||
    lowerName.includes('background') ||
    lowerName.includes('text') ||
    lowerName.includes('border-color') ||
    lowerName.includes('fill') ||
    lowerName.includes('stroke') ||
    isColorValue(value)
  ) {
    tokens.colors = tokens.colors || {};
    tokens.colors[name] = normalizeColorValue(value);
    return;
  }

  // Spacing tokens
  if (
    lowerName.includes('spacing') ||
    lowerName.includes('gap') ||
    lowerName.includes('margin') ||
    lowerName.includes('padding') ||
    lowerName.includes('space')
  ) {
    tokens.spacing = tokens.spacing || {};
    tokens.spacing[name] = value;
    return;
  }

  // Border radius tokens
  if (lowerName.includes('radius') || lowerName.includes('rounded')) {
    tokens.borderRadius = tokens.borderRadius || {};
    tokens.borderRadius[name] = value;
    return;
  }

  // Shadow tokens
  if (lowerName.includes('shadow')) {
    tokens.shadows = tokens.shadows || {};
    tokens.shadows[name] = value;
    return;
  }

  // Font tokens (partial - would need more context for full font token)
  if (
    lowerName.includes('font-size') ||
    lowerName.includes('font-family') ||
    lowerName.includes('font-weight') ||
    lowerName.includes('line-height')
  ) {
    // Store as spacing for now, fonts need special handling
    tokens.spacing = tokens.spacing || {};
    tokens.spacing[name] = value;
  }
}

// ============================================================================
// Tailwind Config Parsing
// ============================================================================

/**
 * Parse Tailwind config file for design tokens
 */
async function parseTailwindConfig(
  rootDir: string
): Promise<Partial<CSSTokens> | null> {
  const configPaths = [
    'tailwind.config.js',
    'tailwind.config.ts',
    'tailwind.config.mjs',
    'tailwind.config.cjs',
  ];

  for (const configPath of configPaths) {
    const fullPath = path.join(rootDir, configPath);
    if (await fs.pathExists(fullPath)) {
      return await extractTailwindTokens(fullPath);
    }
  }

  return null;
}

/**
 * Extract tokens from Tailwind config file
 * Note: This is a simplified extraction that reads the file as text
 */
async function extractTailwindTokens(
  configPath: string
): Promise<Partial<CSSTokens>> {
  const tokens: Partial<CSSTokens> = {
    colors: {},
    spacing: {},
    borderRadius: {},
  };

  try {
    const content = await fs.readFile(configPath, 'utf-8');

    // Extract colors using regex (simplified approach)
    const colorMatches = content.match(
      /colors\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s
    );
    if (colorMatches) {
      const colorsBlock = colorMatches[1];
      extractObjectTokens(colorsBlock, tokens.colors!);
    }

    // Extract spacing
    const spacingMatches = content.match(/spacing\s*:\s*\{([^}]+)\}/s);
    if (spacingMatches) {
      extractObjectTokens(spacingMatches[1], tokens.spacing!);
    }

    // Extract border radius
    const radiusMatches = content.match(/borderRadius\s*:\s*\{([^}]+)\}/s);
    if (radiusMatches) {
      extractObjectTokens(radiusMatches[1], tokens.borderRadius!);
    }
  } catch {
    // Ignore parsing errors
  }

  return tokens;
}

/**
 * Extract key-value pairs from a JavaScript object literal string
 */
function extractObjectTokens(
  objectStr: string,
  target: Record<string, string>
): void {
  // Match: key: 'value' or key: "value" or 'key': 'value'
  const regex = /['"]?([a-zA-Z0-9-_]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = regex.exec(objectStr)) !== null) {
    target[match[1]] = match[2];
  }
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Check if a value looks like a color
 */
function isColorValue(value: string): boolean {
  // Hex colors
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
    return true;
  }

  // RGB/RGBA
  if (/^rgba?\s*\(/.test(value)) {
    return true;
  }

  // HSL/HSLA
  if (/^hsla?\s*\(/.test(value)) {
    return true;
  }

  // CSS color keywords (common ones)
  const colorKeywords = [
    'transparent',
    'currentcolor',
    'inherit',
    'white',
    'black',
    'red',
    'blue',
    'green',
  ];
  return colorKeywords.includes(value.toLowerCase());
}

/**
 * Normalize color value to uppercase hex format when possible
 */
export function normalizeColorValue(value: string): string {
  const trimmed = value.trim();

  // Already a hex color
  if (trimmed.startsWith('#')) {
    // Expand shorthand hex
    if (trimmed.length === 4) {
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    return trimmed.toUpperCase();
  }

  // Convert rgb/rgba to hex
  const rgbMatch = trimmed.match(
    /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/
  );
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }

  return trimmed;
}

/**
 * Parse a spacing value to pixels
 */
export function parseSpacingValue(value: string): number | null {
  const trimmed = value.trim().toLowerCase();

  // px value
  const pxMatch = trimmed.match(/^([\d.]+)px$/);
  if (pxMatch) {
    return parseFloat(pxMatch[1]);
  }

  // rem value (assuming 16px base)
  const remMatch = trimmed.match(/^([\d.]+)rem$/);
  if (remMatch) {
    return parseFloat(remMatch[1]) * 16;
  }

  // em value (approximate, assuming 16px base)
  const emMatch = trimmed.match(/^([\d.]+)em$/);
  if (emMatch) {
    return parseFloat(emMatch[1]) * 16;
  }

  // Plain number (assume px)
  const numMatch = trimmed.match(/^[\d.]+$/);
  if (numMatch) {
    return parseFloat(trimmed);
  }

  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Merge partial tokens into main tokens object
 */
function mergeTokens(
  target: CSSTokens,
  source: Partial<CSSTokens>
): void {
  if (source.colors) {
    Object.assign(target.colors, source.colors);
  }
  if (source.fonts) {
    Object.assign(target.fonts, source.fonts);
  }
  if (source.spacing) {
    Object.assign(target.spacing, source.spacing);
  }
  if (source.borderRadius) {
    target.borderRadius = target.borderRadius || {};
    Object.assign(target.borderRadius, source.borderRadius);
  }
  if (source.shadows) {
    target.shadows = target.shadows || {};
    Object.assign(target.shadows, source.shadows);
  }
}

/**
 * Create empty CSS tokens structure
 */
export function createEmptyCSSTokens(): CSSTokens {
  return {
    colors: {},
    fonts: {},
    spacing: {},
    borderRadius: {},
    shadows: {},
  };
}

/**
 * Convert DesignTokens to CSSTokens format
 */
export function designTokensToCSSTokens(tokens: DesignTokens): CSSTokens {
  return {
    colors: { ...tokens.colors },
    fonts: { ...tokens.fonts },
    spacing: { ...tokens.spacing },
    borderRadius: tokens.borderRadius ? { ...tokens.borderRadius } : {},
    shadows: tokens.shadows ? { ...tokens.shadows } : {},
  };
}
