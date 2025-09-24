/**
 * This module holds a long form help text for the unified seeding CLI.  It
 * is deliberately kept in code so that it can be synchronised with
 * actual runtime options.  The README also contains usage examples.
 */

export const helpText = `
Unified seeding CLI
===================

Commands:

  reset              Drop the entire database.  Requires --yes unless --dry-run.
  list [patterns...] List discovered seeders in dependency order.  Patterns can be names,
                     globs, \"all\" or \"*\".  Use --json for machine output and --verbose for
                     more detail.
  seed               Run the seeding process.

General options (applies to most commands):

  --env <file>       Path to an .env file to load before running.
  --seeders <glob>   Glob for seeder files (default: seeds/**/*.seeder.{ts,js}).
  --data <glob>      Glob for data files (default: seeds/data/**/*.{json,ndjson}).

reset options:

  --dry-run          Print what would happen without making changes.
  --yes              Confirm destructive action (required without --dry-run).

list options:

  --json             Output a JSON representation of the discovered seeders.
  --deps             Include dependency information in the output.
  --verbose          Include extra details such as data files and available modes.

seed options:

  --only <list>      Comma/space separated list of seeder names or globs to include.
  --except <list>    Comma/space separated list of seeders to exclude after applying --only.
  --mode <mode>      Seeding mode: static | faker | both (default both).
  --fresh            Drop targeted collections before seeding (destructive).
  --append           Do not delete existing documents.
  --dry-run          Print actions without making changes.
  --yes              Confirm destructive action (required when using --fresh).
  --count <pairs>    Number of faker docs per seeder.  Format: \"*=n,users=10\".
  --top-up <pairs>   Add this many documents on top of existing counts.
  --upsert-on <pairs> Upsert keys per seeder.  Format: \"*=name;users=email,uid\".
  --batch-size <n>   Batch size for bulk upserts (default 500).
  --concurrency <n>  Parallel operations (not yet implemented; reserved).
  --strict           Fail on JSON validation errors rather than warn.

When no --only or --except flags are provided the CLI targets all discovered seeders.
Patterns are case insensitive and support the wildcard \"*\".  Dependencies are
automatically included.  Use --dry-run to see what would happen without
mutating your database.
`;

/** Print the long form help to stdout. */
export function printHelp(): void {
  console.log(helpText);
}