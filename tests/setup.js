// tests/setup.js - Make jest globals available in ESM mode
import { jest } from '@jest/globals';

globalThis.jest = jest;
