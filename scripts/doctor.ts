#!/usr/bin/env tsx

/**
 * Diagnostic tool for Eddo development environment
 * Checks system health and provides actionable fixes
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

import {
  checkContainerStatus,
  checkPort,
  checkServiceHealth,
  checkVersionedPrereq,
  type DiagnosticResult,
  displayResultGroup,
  displaySummary,
  exec,
  isContainerRunning,
  type PrereqCheckOptions,
} from './doctor-helpers.js';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

/**
 * Check prerequisites (Node.js, pnpm, Docker)
 */
function checkPrerequisites(): DiagnosticResult[] {
  const prereqs: PrereqCheckOptions[] = [
    {
      name: 'Node.js',
      command: 'node',
      versionArg: '--version',
      minVersion: '18.11.0',
      installHint: 'Install from https://nodejs.org/',
    },
    {
      name: 'pnpm',
      command: 'pnpm',
      versionArg: '--version',
      minVersion: '7.1.0',
      installHint: 'Install: npm install -g pnpm',
    },
    {
      name: 'Docker CLI',
      command: 'docker',
      versionArg: '--version',
      minVersion: '20.0.0',
      installHint: 'Install from https://docker.com/',
    },
  ];

  const results = prereqs.map(checkVersionedPrereq);

  // Docker daemon
  const dockerInfo = exec('docker info');
  results.push({
    name: 'Docker Daemon',
    status: dockerInfo ? 'pass' : 'fail',
    message: dockerInfo ? 'Docker daemon is running' : 'Docker daemon is not running',
    fix: dockerInfo ? undefined : 'Start Docker Desktop or run: sudo systemctl start docker',
  });

  return results;
}

/**
 * Check Docker services (CouchDB, Elasticsearch)
 */
function checkDockerServices(): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];

  // CouchDB container
  results.push(checkContainerStatus('eddo-couchdb', 'CouchDB Container'));

  // CouchDB health
  if (isContainerRunning('eddo-couchdb')) {
    results.push(checkServiceHealth('CouchDB Health', 'http://localhost:5984/_up', 5984));
  }

  // Elasticsearch container
  results.push(checkContainerStatus('eddo-elasticsearch', 'Elasticsearch Container'));

  // Elasticsearch health
  if (isContainerRunning('eddo-elasticsearch')) {
    results.push(
      checkServiceHealth('Elasticsearch Health', 'http://localhost:9222/_cluster/health', 9222),
    );
  }

  return results;
}

/**
 * Check configuration files
 */
function checkConfiguration(): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];

  // .env file
  const envPath = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const hasCouchDBUrl = envContent.includes('COUCHDB_URL=');

    results.push({
      name: '.env Configuration',
      status: hasCouchDBUrl ? 'pass' : 'warn',
      message: hasCouchDBUrl
        ? '.env file exists with CouchDB configuration'
        : '.env file exists but missing COUCHDB_URL',
      fix: hasCouchDBUrl
        ? undefined
        : 'Add COUCHDB_URL=http://admin:password@localhost:5984 to .env',
    });
  } else {
    results.push({
      name: '.env Configuration',
      status: 'fail',
      message: '.env file not found',
      fix: 'Run: pnpm setup (or copy .env.example to .env)',
    });
  }

  // node_modules
  const nodeModulesPath = path.join(ROOT_DIR, 'node_modules');
  results.push({
    name: 'Dependencies',
    status: fs.existsSync(nodeModulesPath) ? 'pass' : 'fail',
    message: fs.existsSync(nodeModulesPath)
      ? 'node_modules directory exists'
      : 'node_modules not found',
    fix: fs.existsSync(nodeModulesPath) ? undefined : 'Run: pnpm install',
  });

  return results;
}

/**
 * Check port availability
 */
function checkPorts(): DiagnosticResult[] {
  const ports = [
    { port: 3000, service: 'Eddo Web App', isDockerService: false },
    { port: 5173, service: 'Vite Dev Server', isDockerService: false },
    { port: 5984, service: 'CouchDB', isDockerService: true },
    { port: 9222, service: 'Elasticsearch', isDockerService: true },
  ];

  return ports.map(({ port, service, isDockerService }) =>
    checkPort(port, service, isDockerService),
  );
}

/**
 * Run all diagnostics
 */
function runDiagnostics(): void {
  console.log(chalk.bold.blue('\n🩺 Eddo Doctor - Environment Diagnostics\n'));

  const prerequisites = checkPrerequisites();
  displayResultGroup('Prerequisites', prerequisites);

  const dockerServices = checkDockerServices();
  displayResultGroup('Docker Services', dockerServices);

  const configuration = checkConfiguration();
  displayResultGroup('Configuration', configuration);

  const ports = checkPorts();
  displayResultGroup('Ports', ports);

  const allResults = [...prerequisites, ...dockerServices, ...configuration, ...ports];
  displaySummary(allResults);
}

// Run diagnostics
runDiagnostics();
