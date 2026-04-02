## Setup

```bash
npm install
cp .env.example .env  # fill in ANTHROPIC_API_KEY and GITHUB_TOKEN
```

## Usage

```bash
npx tsx src/index.ts          # start cli 
npx tsx src/index.ts --help   # info
```

# RECOMMENDED

For global CLI access: 
`npm run build && npm link`, then use `pr-review` from anywhere.
