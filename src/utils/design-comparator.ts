/**
 * Design token comparison utility module
 *
 * Provides functions for comparing Figma design tokens with
 * CSS implementation tokens to detect discrepancies.
 */

import type { DesignTokens, DiscrepancyItem, DesignVerificationMessage, Platform } from '../types.js';
import type { CSSTokens } from './css-extractor.js';
import { normalizeColorValue, parseSpacingValue } from './css-extractor.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of comparing design tokens with CSS tokens
 */
export interface ComparisonResult {
  /** Whether all tokens match */
  verified: boolean;
  /** Match percentage (0-100) */
  matchPercentage: number;
  /** Total number of tokens checked */
  totalChecked: number;
  /** Number of matching tokens */
  matchingCount: number;
  /** Number of mismatched tokens */
  mismatchedCount: number;
  /** Number of tokens in design but not in CSS */
  missingInCSSCount: number;
  /** Number of tokens in CSS but not in design */
  extraInCSSCount: number;
  /** List of discrepancies */
  discrepancies: DiscrepancyItem[];
}

/**
 * Options for comparison
 */
export interface ComparisonOptions {
  /** Color tolerance in percentage (0-100) */
  colorTolerance?: number;
  /** Spacing tolerance in pixels */
  spacingTolerance?: number;
  /** Whether to check extra tokens in CSS */
  checkExtraTokens?: boolean;
  /** Minimum match percentage to pass verification */
  minMatchPercentage?: number;
}

const DEFAULT_OPTIONS: ComparisonOptions = {
  colorTolerance: 5, // 5% color difference allowed
  spacingTolerance: 2, // 2px difference allowed
  checkExtraTokens: false,
  minMatchPercentage: 90,
};

// ============================================================================
// Main Comparison Function
// ============================================================================

/**
 * Compare design tokens with CSS tokens
 *
 * @param designTokens - Tokens from Figma or design specification
 * @param cssTokens - Tokens extracted from CSS
 * @param options - Comparison options
 * @returns Comparison result
 */
export function compareDesignTokens(
  designTokens: DesignTokens,
  cssTokens: CSSTokens,
  options: ComparisonOptions = {}
): ComparisonResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const discrepancies: DiscrepancyItem[] = [];
  let totalChecked = 0;
  let matchingCount = 0;
  let mismatchedCount = 0;
  let missingInCSSCount = 0;

  // Compare colors
  const colorResult = compareColors(
    designTokens.colors,
    cssTokens.colors,
    opts.colorTolerance!
  );
  discrepancies.push(...colorResult.discrepancies);
  totalChecked += colorResult.total;
  matchingCount += colorResult.matching;
  mismatchedCount += colorResult.mismatched;
  missingInCSSCount += colorResult.missing;

  // Compare spacing
  const spacingResult = compareSpacing(
    designTokens.spacing,
    cssTokens.spacing,
    opts.spacingTolerance!
  );
  discrepancies.push(...spacingResult.discrepancies);
  totalChecked += spacingResult.total;
  matchingCount += spacingResult.matching;
  mismatchedCount += spacingResult.mismatched;
  missingInCSSCount += spacingResult.missing;

  // Compare border radius if available
  if (designTokens.borderRadius) {
    const radiusResult = compareSpacing(
      designTokens.borderRadius,
      cssTokens.borderRadius || {},
      opts.spacingTolerance!,
      'borderRadius'
    );
    discrepancies.push(...radiusResult.discrepancies);
    totalChecked += radiusResult.total;
    matchingCount += radiusResult.matching;
    mismatchedCount += radiusResult.mismatched;
    missingInCSSCount += radiusResult.missing;
  }

  // Calculate match percentage
  const matchPercentage =
    totalChecked > 0 ? Math.round((matchingCount / totalChecked) * 100) : 100;

  const verified = matchPercentage >= (opts.minMatchPercentage || 90);

  return {
    verified,
    matchPercentage,
    totalChecked,
    matchingCount,
    mismatchedCount,
    missingInCSSCount,
    extraInCSSCount: 0, // Not calculated by default
    discrepancies,
  };
}

// ============================================================================
// Color Comparison
// ============================================================================

interface TokenComparisonResult {
  total: number;
  matching: number;
  mismatched: number;
  missing: number;
  discrepancies: DiscrepancyItem[];
}

/**
 * Compare color tokens
 */
function compareColors(
  designColors: Record<string, string>,
  cssColors: Record<string, string>,
  tolerance: number
): TokenComparisonResult {
  const discrepancies: DiscrepancyItem[] = [];
  let matching = 0;
  let mismatched = 0;
  let missing = 0;
  const total = Object.keys(designColors).length;

  for (const [name, designValue] of Object.entries(designColors)) {
    // Try to find matching CSS token
    const cssValue = findMatchingToken(name, cssColors);

    if (!cssValue) {
      missing++;
      discrepancies.push({
        type: 'color',
        tokenName: name,
        expectedValue: designValue,
        actualValue: 'NOT_FOUND',
        difference: 'Token not found in CSS',
        severity: 'warning',
      });
      continue;
    }

    // Normalize and compare
    const normalizedDesign = normalizeColorValue(designValue);
    const normalizedCSS = normalizeColorValue(cssValue);

    if (normalizedDesign === normalizedCSS) {
      matching++;
    } else {
      const colorDiff = calculateColorDifference(
        normalizedDesign,
        normalizedCSS
      );

      if (colorDiff <= tolerance) {
        matching++;
      } else {
        mismatched++;
        discrepancies.push({
          type: 'color',
          tokenName: name,
          expectedValue: designValue,
          actualValue: cssValue,
          difference: `Color difference: ${colorDiff.toFixed(1)}%`,
          severity: colorDiff > 20 ? 'error' : 'warning',
        });
      }
    }
  }

  return { total, matching, mismatched, missing, discrepancies };
}

/**
 * Calculate color difference as percentage
 */
function calculateColorDifference(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  if (!rgb1 || !rgb2) {
    return 100; // Can't compare, treat as max difference
  }

  // Calculate Euclidean distance in RGB space
  const rDiff = Math.abs(rgb1.r - rgb2.r);
  const gDiff = Math.abs(rgb1.g - rgb2.g);
  const bDiff = Math.abs(rgb1.b - rgb2.b);

  const maxDiff = Math.sqrt(255 * 255 * 3); // Max possible difference
  const actualDiff = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

  return (actualDiff / maxDiff) * 100;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');

  if (cleaned.length !== 6) {
    return null;
  }

  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return null;
  }

  return { r, g, b };
}

// ============================================================================
// Spacing Comparison
// ============================================================================

/**
 * Compare spacing tokens
 */
function compareSpacing(
  designSpacing: Record<string, string>,
  cssSpacing: Record<string, string>,
  tolerance: number,
  type: DiscrepancyItem['type'] = 'spacing'
): TokenComparisonResult {
  const discrepancies: DiscrepancyItem[] = [];
  let matching = 0;
  let mismatched = 0;
  let missing = 0;
  const total = Object.keys(designSpacing).length;

  for (const [name, designValue] of Object.entries(designSpacing)) {
    const cssValue = findMatchingToken(name, cssSpacing);

    if (!cssValue) {
      missing++;
      discrepancies.push({
        type,
        tokenName: name,
        expectedValue: designValue,
        actualValue: 'NOT_FOUND',
        difference: 'Token not found in CSS',
        severity: 'warning',
      });
      continue;
    }

    const designPx = parseSpacingValue(designValue);
    const cssPx = parseSpacingValue(cssValue);

    if (designPx === null || cssPx === null) {
      // Can't parse, do string comparison
      if (designValue === cssValue) {
        matching++;
      } else {
        mismatched++;
        discrepancies.push({
          type,
          tokenName: name,
          expectedValue: designValue,
          actualValue: cssValue,
          difference: 'Values differ (unparseable)',
          severity: 'warning',
        });
      }
      continue;
    }

    const diff = Math.abs(designPx - cssPx);

    if (diff <= tolerance) {
      matching++;
    } else {
      mismatched++;
      discrepancies.push({
        type,
        tokenName: name,
        expectedValue: designValue,
        actualValue: cssValue,
        difference: `Spacing difference: ${diff}px`,
        severity: diff > 8 ? 'error' : 'warning',
      });
    }
  }

  return { total, matching, mismatched, missing, discrepancies };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find a matching token in the target object using various naming conventions
 */
function findMatchingToken(
  name: string,
  tokens: Record<string, string>
): string | undefined {
  // Direct match
  if (tokens[name] !== undefined) {
    return tokens[name];
  }

  // Normalize name for comparison
  const normalized = name.toLowerCase().replace(/[-_]/g, '');

  for (const [key, value] of Object.entries(tokens)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    if (normalizedKey === normalized) {
      return value;
    }
  }

  // Try partial match (e.g., "color-primary" matches "primary")
  const baseName = name.split('-').pop()?.toLowerCase();
  if (baseName) {
    for (const [key, value] of Object.entries(tokens)) {
      if (key.toLowerCase().endsWith(baseName)) {
        return value;
      }
    }
  }

  return undefined;
}

/**
 * Generate a human-readable summary of the comparison
 */
export function generateComparisonSummary(result: ComparisonResult): string {
  const lines: string[] = [];

  lines.push(`## Design Verification Report`);
  lines.push('');
  lines.push(`**Status:** ${result.verified ? 'PASSED' : 'NEEDS ATTENTION'}`);
  lines.push(`**Match Rate:** ${result.matchPercentage}%`);
  lines.push(`**Total Tokens Checked:** ${result.totalChecked}`);
  lines.push('');

  if (result.discrepancies.length > 0) {
    lines.push(`### Discrepancies Found (${result.discrepancies.length})`);
    lines.push('');

    // Group by type
    const byType = new Map<string, DiscrepancyItem[]>();
    for (const d of result.discrepancies) {
      const items = byType.get(d.type) || [];
      items.push(d);
      byType.set(d.type, items);
    }

    for (const [type, items] of byType) {
      lines.push(`#### ${type.charAt(0).toUpperCase() + type.slice(1)} (${items.length})`);
      lines.push('');
      lines.push('| Token | Expected | Actual | Difference |');
      lines.push('|-------|----------|--------|------------|');

      for (const item of items) {
        lines.push(
          `| ${item.tokenName} | ${item.expectedValue} | ${item.actualValue} | ${item.difference} |`
        );
      }
      lines.push('');
    }
  } else {
    lines.push('No discrepancies found. Design and implementation are in sync.');
  }

  return lines.join('\n');
}

/**
 * Create a DesignVerificationMessage from comparison result
 */
export function createVerificationMessage(
  taskId: string,
  platform: Platform,
  result: ComparisonResult
): DesignVerificationMessage {
  return {
    type: 'design_verification',
    taskId,
    platform,
    timestamp: new Date().toISOString(),
    verified: result.verified,
    matchPercentage: result.matchPercentage,
    totalChecked: result.totalChecked,
    discrepancies: result.discrepancies,
    summary: generateComparisonSummary(result),
  };
}

/**
 * Determine overall severity from discrepancies
 */
export function getOverallSeverity(
  discrepancies: DiscrepancyItem[]
): 'error' | 'warning' | 'info' | 'none' {
  if (discrepancies.length === 0) {
    return 'none';
  }

  const hasError = discrepancies.some((d) => d.severity === 'error');
  if (hasError) {
    return 'error';
  }

  const hasWarning = discrepancies.some((d) => d.severity === 'warning');
  if (hasWarning) {
    return 'warning';
  }

  return 'info';
}
