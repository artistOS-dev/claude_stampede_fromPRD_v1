#!/usr/bin/env node
/**
 * delete-all-rodeos.js
 *
 * Wipes every row from the rodeos table.
 * All child rows cascade automatically:
 *   credit_pools, distribution_rules, rodeo_entries, rodeo_entry_songs,
 *   rodeo_votes, rodeo_rankings, rodeo_results, rodeo_song_results,
 *   rodeo_credit_distributions
 *
 * Usage:
 *   node scripts/delete-all-rodeos.js            # prompts for confirmation
 *   node scripts/delete-all-rodeos.js --force    # skips prompt
 *
 * Reads from apps/web/.env (or env vars set before running):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const { readFileSync } = require('fs')
const { createInterface } = require('readline')
const { resolve } = require('path')

// ── Load .env ─────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(__dirname, '../apps/web/.env')
  try {
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    // .env absent — rely on process.env already being set
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Set them in apps/web/.env or export them before running this script.')
  process.exit(1)
}

// ── Supabase REST helpers (no SDK dep needed) ─────────────────

const BASE = `${SUPABASE_URL}/rest/v1`
const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
}

async function supabaseGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function supabaseDelete(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: HEADERS })
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}: ${await res.text()}`)
}

// ── Prompt ────────────────────────────────────────────────────

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => { rl.close(); resolve(answer) })
  })
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const force = process.argv.includes('--force')

  // Count existing rodeos
  const rows = await supabaseGet('/rodeos?select=id')
  const count = rows.length

  if (count === 0) {
    console.log('No rodeos found — nothing to delete.')
    return
  }

  console.log(`Found ${count} rodeo${count !== 1 ? 's' : ''}.`)

  if (!force) {
    const answer = await prompt(`Delete all ${count} rodeo${count !== 1 ? 's' : ''} and their related data? [y/N] `)
    if (answer.trim().toLowerCase() !== 'y') {
      console.log('Aborted.')
      return
    }
  }

  // Delete all — neq on a nil uuid matches every real row, cascades to all children
  await supabaseDelete('/rodeos?id=neq.00000000-0000-0000-0000-000000000000')

  console.log(`Deleted ${count} rodeo${count !== 1 ? 's' : ''} and all related data.`)
}

main().catch((err) => { console.error(err.message); process.exit(1) })
