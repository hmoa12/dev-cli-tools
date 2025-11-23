# Dev CLI Tools

A CLI tool for generating semantic commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Installation

```bash
npm install
npm run build
```

## Usage

Run the commit command to generate a semantic commit message:

```bash
npm run dev commit
```

Or after building:

```bash
npm run build
node dist/bin/index.js commit
```

## Examples

The tool will prompt you for:
1. **Type**: Select from conventional commit types (feat, fix, refactor, test, docs, style, perf, chore, ci, build, revert)
2. **Scope**: Enter an optional scope (e.g., api, ui, db)
3. **Message**: Enter the commit message

### Example Output

```
Select the type of commit: feat
Enter the scope (optional): api
Enter the commit message: added new auth service

Generated commit message:
feat(api): added new auth service
```

### Without Scope

```
Select the type of commit: fix
Enter the scope (optional): 
Enter the commit message: resolved login bug

Generated commit message:
fix: resolved login bug
```

## Commit Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that do not modify src or test files
- **revert**: Reverts a previous commit

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev commit

# Build the project
npm run build
```

