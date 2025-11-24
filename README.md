# Dev CLI Tools

A comprehensive CLI toolkit for developers: semantic commits, README generation, environment management, project cleanup, and API testing.

## Features

- 🎯 **Semantic Commits**: Generate conventional commit messages interactively
- 📝 **README Generator**: Create beautiful README.md files with ease
- 🔐 **Environment Manager**: Manage `.env` files with set, get, delete, and switch commands
- 🧹 **Project Cleaner**: Clean up junk files and directories from projects
- 🌐 **API Tester**: Test APIs with GET, POST, PUT, PATCH, DELETE methods and save history

## Installation

```bash
npm install -g dev-cli-tools
```

Or use it locally in your project:

```bash
npm install dev-cli-tools
npx dev-cli <command>
```

## Usage

After installation, use the `dev-cli` command:

```bash
dev-cli --help
```

### 1. Commit - Semantic Commit Messages

Generate conventional commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification.

```bash
dev-cli commit
dev-cli commit --push  # Automatically commit and push after generating
```

**Example:**
```
Select the type of commit: feat
Enter the scope (optional): api
Enter the commit message: added new auth service

Generated commit message:
feat(api): added new auth service
```

**Commit Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that do not modify src or test files
- `revert`: Reverts a previous commit

---

### 2. README - README Generator

Generate beautiful README.md files with interactive prompts.

```bash
dev-cli readme                           # Generate README.md in current directory
dev-cli readme ./docs/README.md          # Generate at specific path
dev-cli readme --minimal                 # Generate minimal README
dev-cli readme --no-install              # Skip installation section
dev-cli readme -o ./docs/README.md       # Alternative output flag
```

**Prompts include:**
- Project name
- Description
- Installation steps (multi-line editor)
- Usage examples (multi-line editor)
- License

---

### 3. Envset - Environment Variable Manager

Manage environment variables in `.env` files with ease.

#### Set Environment Variables

```bash
dev-cli envset set PORT 8000
dev-cli envset set DB_URL "mongodb://localhost:27017"
dev-cli envset set API_KEY "secret-key" --prod    # Set in .env.production
dev-cli envset set DEBUG true --dev               # Set in .env.development
dev-cli envset set CUSTOM_VAR value -f .env.local # Set in specific file
```

#### Get Environment Variables

```bash
dev-cli envset get PORT
dev-cli envset get DB_URL --prod
dev-cli envset get API_KEY --dev
```

#### List All Variables

```bash
dev-cli envset list
dev-cli envset ls                      # Alias
dev-cli envset list -f .env.production # List from specific file
```

#### Delete Variables

```bash
dev-cli envset delete PORT
dev-cli envset del PORT                # Alias
dev-cli envset delete API_KEY --prod
```

#### Switch Between .env Files

```bash
dev-cli envset switch .env.production  # Copy .env.production to .env
dev-cli envset switch .env.development # Copy .env.development to .env
```

**Features:**
- Automatically creates `.env` file if it doesn't exist
- Supports `.env`, `.env.production`, `.env.development`, and custom files
- Preserves comments and formatting in `.env` files
- `--prod` flag for `.env.production`
- `--dev` flag for `.env.development`

---

### 4. Cleaner - Project Cleanup Tool

Clean up junk files and directories from your projects.

```bash
dev-cli cleaner                    # Clean current directory
dev-cli cleaner ./my-project       # Clean specific directory
dev-cli cleaner --dry-run          # Preview what will be deleted
dev-cli cleaner --force            # Skip confirmation prompt
dev-cli cleaner --node_modules     # Only delete node_modules
```

**What gets cleaned:**
- `node_modules/`
- `dist/`, `build/`, `out/`
- `.DS_Store` (macOS)
- Log files (`*.log`)
- Temporary files (`*.tmp`, `*.temp`)
- Cache directories
- And more...

**Safety Features:**
- `--dry-run`: Preview changes without deleting
- Interactive confirmation prompts
- Size calculation before deletion
- `--force`: Skip confirmation (use with caution)

---

### 5. Apitest - API Testing Tool

Test APIs with all HTTP methods and manage request history.

#### GET Requests

```bash
dev-cli apitest get https://api.example.com/users
dev-cli apitest GET https://api.example.com/users          # Uppercase alias
dev-cli apitest get https://api.example.com/users -H "Authorization: Bearer token"
dev-cli apitest get https://api.example.com/users --interactive-headers
```

#### POST Requests

```bash
dev-cli apitest post https://api.example.com/users -b '{"name":"John"}'
dev-cli apitest POST https://api.example.com/users --editor  # Open editor for body
dev-cli apitest post https://api.example.com/users -H "Content-Type: application/json"
```

#### PUT, PATCH, DELETE

```bash
dev-cli apitest put https://api.example.com/users/1 -b '{"name":"Jane"}'
dev-cli apitest patch https://api.example.com/users/1 -b '{"name":"Jane"}'
dev-cli apitest delete https://api.example.com/users/1
```

#### History Management

```bash
dev-cli apitest history           # View request history
dev-cli apitest history --clear   # Clear all history
```

**Features:**
- Support for GET, POST, PUT, PATCH, DELETE (with uppercase aliases)
- JSON request/response formatting
- Request history saved to `.apitest-history.json`
- Interactive header configuration
- Editor mode for complex request bodies (`--editor`)
- Custom headers via `-H` or `--header`
- Pretty-printed JSON responses
- History viewing and replay

**Options:**
- `-H, --header <header>`: Add HTTP header (format: `Key:Value`)
- `-b, --body <body>`: Request body (JSON string)
- `-e, --editor`: Open editor for request body
- `--no-history`: Skip saving to history
- `--interactive-headers`: Set headers interactively

---

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/hmoa12/dev-cli-tools.git
cd dev-cli-tools

# Install dependencies
npm install

# Run in development mode
npm run dev commit
npm run dev readme
# etc...

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Project Structure

```
dev-cli-tools/
├── bin/
│   └── index.ts          # Main CLI entry point
├── src/
│   └── commands/         # Individual command implementations
│       ├── commit.ts
│       ├── readme.ts
│       ├── envset.ts
│       ├── cleaner.ts
│       └── apitest.ts
├── __tests__/            # Test files
└── dist/                 # Compiled output (generated)
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Author

[Your Name]

## Repository

[https://github.com/hmoa12/dev-cli-tools](https://github.com/hmoa12/dev-cli-tools)

## Issues

Found a bug or have a feature request? Please open an issue on [GitHub](https://github.com/hmoa12/dev-cli-tools/issues).
