/**
 * VCR Environment Setup
 * Must run BEFORE any module imports to ensure env vars are set
 * before config modules evaluate them.
 */

// Force consistent persona for VCR cassette matching
// Cassettes were recorded with gtd_coach persona
process.env.BOT_PERSONA_ID = 'gtd_coach';
