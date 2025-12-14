/**
 * Figma integration utility module
 *
 * Provides functions for extracting design tokens from Figma files
 * using the Figma REST API.
 */

import type { DesignTokens, FontToken, FigmaConfig } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Figma API response for variables
 */
interface FigmaVariablesResponse {
  status: number;
  error: boolean;
  meta: {
    variableCollections: Record<string, FigmaVariableCollection>;
    variables: Record<string, FigmaVariable>;
  };
}

interface FigmaVariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variableIds: string[];
}

interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR';
  valuesByMode: Record<string, FigmaVariableValue>;
}

type FigmaVariableValue =
  | boolean
  | number
  | string
  | { r: number; g: number; b: number; a: number };

// ============================================================================
// API Functions
// ============================================================================

/**
 * Extract design tokens from a Figma file
 *
 * @param config - Figma configuration with file key and access token
 * @returns Extracted design tokens
 */
export async function extractFigmaTokens(
  config: FigmaConfig
): Promise<DesignTokens | null> {
  if (!config.enabled || !config.fileKey || !config.accessToken) {
    return null;
  }

  try {
    const tokens: DesignTokens = {
      colors: {},
      fonts: {},
      spacing: {},
      borderRadius: {},
      shadows: {},
    };

    // Try to get variables (Figma's newer token system)
    const variables = await fetchFigmaVariables(
      config.fileKey,
      config.accessToken
    );
    if (variables) {
      processVariables(variables, tokens);
    }

    // If we got tokens, return them
    if (
      Object.keys(tokens.colors).length > 0 ||
      Object.keys(tokens.spacing).length > 0
    ) {
      return tokens;
    }

    return null;
  } catch (error) {
    console.error('Failed to extract Figma tokens:', error);
    return null;
  }
}

/**
 * Fetch variables from Figma API
 */
async function fetchFigmaVariables(
  fileKey: string,
  accessToken: string
): Promise<FigmaVariablesResponse | null> {
  try {
    const response = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/variables/local`,
      {
        headers: {
          'X-Figma-Token': accessToken,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as FigmaVariablesResponse;
  } catch {
    return null;
  }
}

/**
 * Process Figma variables into design tokens
 */
function processVariables(
  response: FigmaVariablesResponse,
  tokens: DesignTokens
): void {
  const { variables } = response.meta;

  for (const variable of Object.values(variables)) {
    const name = normalizeTokenName(variable.name);
    // Get the first mode's value
    const modeValues = Object.values(variable.valuesByMode);
    const value = modeValues[0];

    if (value === undefined) continue;

    switch (variable.resolvedType) {
      case 'COLOR':
        if (typeof value === 'object' && 'r' in value) {
          tokens.colors[name] = rgbaToHex(value);
        }
        break;

      case 'FLOAT':
        if (typeof value === 'number') {
          // Determine if it's spacing or border radius based on name
          if (
            name.includes('radius') ||
            name.includes('corner') ||
            name.includes('round')
          ) {
            tokens.borderRadius = tokens.borderRadius || {};
            tokens.borderRadius[name] = `${value}px`;
          } else {
            tokens.spacing[name] = `${value}px`;
          }
        }
        break;

      case 'STRING':
        // String variables might be font families or other tokens
        break;
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert RGBA color object to hex string
 */
function rgbaToHex(color: { r: number; g: number; b: number; a: number }): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');

  const hex = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;

  // Include alpha if not fully opaque
  if (color.a < 1) {
    return `${hex}${toHex(color.a)}`;
  }

  return hex.toUpperCase();
}

/**
 * Normalize token name from Figma naming convention
 * e.g., "Colors/Primary/500" -> "colors-primary-500"
 */
function normalizeTokenName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Create a default font token
 */
export function createFontToken(
  family: string,
  size: string,
  weight: string,
  lineHeight?: string
): FontToken {
  return {
    family,
    size,
    weight,
    lineHeight,
  };
}

/**
 * Create empty design tokens structure
 */
export function createEmptyDesignTokens(): DesignTokens {
  return {
    colors: {},
    fonts: {},
    spacing: {},
    borderRadius: {},
    shadows: {},
  };
}

/**
 * Merge two design token objects
 */
export function mergeDesignTokens(
  base: DesignTokens,
  override: Partial<DesignTokens>
): DesignTokens {
  return {
    colors: { ...base.colors, ...override.colors },
    fonts: { ...base.fonts, ...override.fonts },
    spacing: { ...base.spacing, ...override.spacing },
    borderRadius: { ...base.borderRadius, ...override.borderRadius },
    shadows: { ...base.shadows, ...override.shadows },
  };
}

/**
 * Check if Figma config is valid and complete
 */
export function isFigmaConfigValid(config?: FigmaConfig): boolean {
  return !!(config?.enabled && config.fileKey && config.accessToken);
}
