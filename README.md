# Configuration Debt Tracker
### *Intelligent Configuration Debt Analysis and Remediation System*

[![Build & Test](https://img.shields.io/badge/tests-passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue.svg)]()
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-v1.85+-blueviolet.svg)]()
[![SCM Standard](https://img.shields.io/badge/SCM-IEEE%20828%20Compliant-orange.svg)]()
[![AI Layer](https://img.shields.io/badge/AI-Repository--Aware%20RAG-indigo.svg)]()

> A production-grade, AST-aware, repository-grounded VS Code extension for discovering, auditing, prioritizing, and remediating configuration debt across multi-language, multi-format software repositories.

---

## Table of Contents
1. [Product Identity & Executive Summary](#1-product-identity--executive-summary)
2. [Dual-Layer Intelligence Architecture](#2-dual-layer-intelligence-architecture)
3. [Software Configuration Management (SCM) Alignment](#3-software-configuration-management-scm-alignment)
4. [Language-Agnostic Code Intelligence & AST Engine](#4-language-agnostic-code-intelligence--ast-engine)
5. [7-Tier Reference Confidence Rating](#5-7-tier-reference-confidence-rating)
6. [Configuration Key Canonicalization & Aliasing](#6-configuration-key-canonicalization--aliasing)
7. [12 Comprehensive Debt Categories](#7-12-comprehensive-debt-categories)
8. [Transparent Risk Scoring Formula](#8-transparent-risk-scoring-formula)
9. [Mathematical Inventory & Health Accounting](#9-mathematical-inventory--health-accounting)
10. [Repository-Aware AI Assistant & RAG Engine](#10-repository-aware-ai-assistant--rag-engine)
11. [Removal Impact Assessment ("What Breaks If I Delete This?")](#11-removal-impact-assessment-what-breaks-if-i-delete-this)
12. [Safe Remediation Patching](#12-safe-remediation-patching)
13. [Multi-Provider AI Architecture & Zero Secret Leakage](#13-multi-provider-ai-architecture--zero-secret-leakage)
14. [User Interface Design (Developer Instrument)](#14-user-interface-design-developer-instrument)
15. [CLI Commands & Extension Settings](#15-cli-commands--extension-settings)
16. [Installation & Setup](#16-installation--setup)
17. [Verification & Test Matrix](#17-verification--test-matrix)
18. [Live Demonstration Guide](#18-live-demonstration-guide)
19. [Academic SCM Defense & Defense Criteria](#19-academic-scm-defense--defense-criteria)
20. [Gemini AI Assistant: Complete Guide & Operations](#20-gemini-ai-assistant-complete-guide--operations)

---

## 1. Product Identity & Executive Summary

Modern software repositories continuously accumulate configuration assets across disparate formats: `.env` files, YAML manifests, JSON/JSONC documents, XML files, Dockerfiles, Docker Compose setups, Kubernetes specs, TOML files, and Spring/Gradle `.properties` files. While application source code is subjected to strict type checkers, linters, and dead-code elimination, **configuration is rarely audited**.

This asymmetry creates **Configuration Debt**:
- **Dormant Configuration**: Environment variables and keys that are declared but unreferenced by any code.
- **Configuration Drift**: Identical logical keys declared across multiple files whose values have diverged, creating unpredictable runtime behavior between environments.
- **Stale Feature Flags**: Temporary rollout toggles lingering in codebases long after launch.
- **Committed Secrets**: Unmasked plaintext API keys, database credentials, and tokens committed into version control.
- **Undocumented Settings**: Critical runtime switches without inline documentation or ownership metadata.

**Configuration Debt Tracker** is a professional diagnostic instrument implemented directly as a **VS Code extension**. It analyzes configuration manifests and source code together to answer critical architectural questions:
- *Which configuration is dead or unused?*
- *Where is this setting used, and what code depends on it?*
- *What will break if I delete this configuration key?*
- *Which values are drifting between local, container, and cluster environments?*
- *Which configurations represent the highest security or operational risk?*

---

## 2. Dual-Layer Intelligence Architecture

To ensure technical credibility, explainability, and privacy, the system separates responsibilities into two distinct layers:

```
+-------------------------------------------------------------------------------+
|                             VS CODE EXTENSION                                 |
+-------------------------------------------------------------------------------+
         |                                                             |
         v                                                             v
+-------------------------------+             +---------------------------------+
|  LAYER A: DETERMINISTIC       |             |  LAYER B: REPOSITORY-AWARE      |
|  SCM STATIC ENGINE            |             |  AI INTELLIGENCE (RAG)          |
+-------------------------------+             +---------------------------------+
| - Configuration Discovery     |             | - Repository Knowledge Index    |
| - Multi-Format Parsing        |             | - Targeted Context Retrieval    |
| - AST Structured Extraction   |             | - Zero-Secret Redaction Policy  |
| - 7-Tier Reference Resolution |             | - Multi-Provider Dispatch       |
| - Key Canonicalization        |             |   (Local Ollama, Gemini,        |
| - 12-Category Debt Detection  |             |    OpenAI-Compatible, Offline)  |
| - Explainable Risk Scoring    |             | - Removal Impact Analysis       |
| - Health Status Accounting    |             | - Grounded Natural Explanations |
| - Cleanup Backlog Lifecycle   |             | - Proposed Remediation Diffs    |
+-------------------------------+             +---------------------------------+
```

### Deterministic Principle
**The LLM never randomly decides configuration debt, risk, or inventory counts.** All detection, scoring, reference linking, and SCM health accounting are computed deterministically by Layer A. Layer B is strictly assistive: explaining findings, synthesizing static dependency evidence, answering natural-language queries, and proposing verified remediation patches.

---

## 3. Software Configuration Management (SCM) Alignment

The architecture strictly adheres to the **IEEE 828 SCM Standard**, embodying all four foundational pillars:

```
+------------------------------------------------------------------------------------+
|                        SCM CORE PILLARS IMPLEMENTATION                             |
+------------------------------------------------------------------------------------+
| 1. Configuration Identification   --> Automated Multi-Format Scanner & Inventory   |
| 2. Configuration Control          --> Prioritized Cleanup Backlog & Status Audit   |
| 3. Status Accounting              --> Health Score Engine & Historical Snapshots   |
| 4. Configuration Audit            --> Multi-Language AST References & Debt Audit   |
+------------------------------------------------------------------------------------+
```

1. **Configuration Identification**: Inventories every configuration declaration across `.env`, YAML, JSON, XML, Docker, Kubernetes, TOML, and Properties files, recording keys, masked values, file locations, line numbers, formats, and sensitivity tiers.
2. **Configuration Control**: Organizes identified debts into an actionable **Cleanup Backlog** governed by a strict state machine: `Open -> Needs Review -> Resolved` or `Ignored`. Decisions are persisted locally in `.config-debt/backlog.json`.
3. **Status Accounting**: Quantifies workspace configuration health via a transparent mathematical formula ($0 - 100$), tracking score deltas across scans in `.config-debt/history.json`.
4. **Configuration Audit**: Compares declared configuration baselines with active source-code references across 14 programming languages to detect discrepancies, drift, and dormant toggles.

---

## 4. Language-Agnostic Code Intelligence & AST Engine

The code intelligence layer (`src/code-intelligence/`) avoids fragile regex-only matching by implementing a structured token and syntax-tree extraction pipeline:

- **Comment & Docstring Isolation**: Isolates block comments (`/* ... */`), line comments (`// ...`, `# ...`, `-- ...`), and documentation strings (`/** ... */`) using `NodeExtractor`. Matches occurring exclusively inside comments are strictly ignored as active references.
- **Symbol & Scope Extraction**: Identifies enclosing functions, methods, classes, and modules (`SymbolExtractor`) to construct static dependency evidence.
- **Import Extractor**: Identifies imported configuration libraries across ecosystems (`dotenv`, `@nestjs/config`, `os`, `viper`, `envy`, `Spring`, etc.).
- **Multi-Language Adapters**: Dedicated analyzers for:
  - **JavaScript / TypeScript / TSX** (`process.env.KEY`, `process.env['KEY']`, `config.get('KEY')`, `import.meta.env.KEY`)
  - **Python** (`os.environ['KEY']`, `os.environ.get('KEY')`, `os.getenv('KEY')`, `settings.KEY`, `config('KEY')`)
  - **Java** (`System.getenv('KEY')`, `System.getProperty('key')`, `@Value("${key}")`, `@ConfigProperty(name="key")`)
  - **Go** (`os.Getenv("KEY")`, `os.LookupEnv("KEY")`, `viper.GetString("KEY")`)
  - **Rust** (`std::env::var("KEY")`, `env::var("KEY")`, `dotenv::var("KEY")`)
  - **C# / .NET** (`Environment.GetEnvironmentVariable("KEY")`, `Configuration["KEY"]`, `config.GetSection("KEY")`)
  - **C / C++** (`getenv("KEY")`)
  - **PHP** (`getenv("KEY")`, `$_ENV["KEY"]`, `$_SERVER["KEY"]`, `config("KEY")`)
  - **Ruby** (`ENV["KEY"]`, `ENV.fetch("KEY")`)
  - **Kotlin** (`System.getenv("KEY")`, `System.getProperty("KEY")`)
  - **Shell / Bash** (`$KEY`, `${KEY}`)
  - **PowerShell** (`$env:KEY`)
  - **Generic Structural Fallback** (`.lua`, `.dart`, `.swift`, `.sql`, `.vue`, `.svelte`, `.html`) with contextual word boundary analysis.

---

## 5. 7-Tier Reference Confidence Rating

Every detected source reference is classified into one of seven calibrated confidence tiers:

| Tier | Level | Pattern Example | Confidence | Status |
| :--- | :---: | :--- | :---: | :--- |
| **Level 1** | Exact Static Property | `process.env.DATABASE_URL` | **98–100%** | Definite Usage |
| **Level 2** | Exact Index Access | `process.env["DATABASE_URL"]` | **97–99%** | Definite Usage |
| **Level 3** | Framework Config Access | `os.getenv("DATABASE_URL")`, `@Value("${database.url}")` | **90–98%** | Definite Usage |
| **Level 4** | Normalized Key Variant | `database.url` matched against `DATABASE_URL` | **70–90%** | Definite Usage |
| **Level 5** | Dataflow Propagation | `const key = "DATABASE_URL"; process.env[key]` | **70–85%** | Definite Usage |
| **Level 6** | Dynamic Key Construction | `process.env[prefix + "URL"]` | **50–70%** | Possible Usage |
| **Level 7** | Generic Text Fallback | Contextual word match in unsupported languages | **40–60%** | Uncertain Match |

---

## 6. Configuration Key Canonicalization & Aliasing

The engine canonicalizes keys into logical dot-notation tokens using `normalizedKeyResolver.ts`:
- `DATABASE_URL` $\longleftrightarrow$ `database.url` $\longleftrightarrow$ `databaseUrl` $\longleftrightarrow$ `database-url`
- Canonical identity: `database.url`

Unlike naive substring matching, canonicalization generates structured token sets (`['database', 'url']`) and requires cryptographic token equivalence before associating declarations, preventing accidental mergers of unrelated keys (e.g. `PORT` vs `SERVER_PORT`).

---

## 7. 12 Comprehensive Debt Categories

The detector flags configuration items across 12 distinct categories:

1. **Dead Configuration**: Declared configuration with zero static references across the codebase. Accompanied by explicit blind spots (e.g., dynamic construction, CI/CD injection).
2. **Duplicated Configuration**: Identical key and value defined in multiple configuration files without drift.
3. **Configuration Drift**: Same logical key defined across multiple files with divergent values (e.g. `.env=5000` vs `application.yml=10000`).
4. **Stale / Outdated Configuration**: Legacy-named keys (`OLD_*`, `LEGACY_*`, `TEMP_*`) or settings unchanged beyond the configured age threshold.
5. **Hardcoded Secret**: Sensitive API keys, tokens, or passwords stored in plaintext (Stripe, AWS, JWT, Private Keys, etc.). Zero-exposure display masks are enforced.
6. **Undocumented Configuration**: Non-trivial settings without inline comments or documentation.
7. **Suspicious Dynamic Reference**: Dynamic environment lookups that cannot be safely resolved statically.
8. **Environment Inconsistency**: Settings present in one environment manifest but absent in others.
9. **Unused Feature Flag**: Toggles matching feature-flag naming conventions (`FEATURE_*`, `ENABLE_*`, `FF_*`) with zero references.
10. **High-Impact Configuration**: Widely referenced configuration whose deletion or modification would impact multiple critical subsystems.
11. **Test-Only Configuration**: Production configuration declarations whose references reside exclusively within test files.
12. **Configuration With Weak Evidence**: Configuration identified solely via Level 7 generic text matching.

---

## 8. Transparent Risk Scoring Formula

Risk scores are computed using an academic, explainable formula:

$$\text{Risk Score} = (\text{Age} \times 0.25) + (\text{Usage} \times 0.35) + (\text{Impact} \times 0.25) + (\text{Sensitivity} \times 0.15)$$

- **Score Range**: $0 \text{ to } 100$
- **Severity Boundaries**:
  - **Critical**: $> 75$
  - **High**: $50 \text{ to } 75$
  - **Medium**: $25 \text{ to } 49$
  - **Low**: $< 25$

Every finding provides a full mathematical breakdown:
$$\text{Age: } 20.0/25 \quad \mid \quad \text{Usage: } 33.3/35 \quad \mid \quad \text{Impact: } 20.0/25 \quad \mid \quad \text{Sensitivity: } 15.0/15 \quad \Longrightarrow \quad \mathbf{\text{Risk: } 88}$$

---

## 9. Mathematical Inventory & Health Accounting

### Health Score Formula
The repository health score starts at $100$ and applies bounded deductions:
$$\text{Health Score} = \max(0, \min(100, 100 - \sum \text{Deductions}))$$

- **Critical Severity Debt**: $-10 \text{ pts per finding}$ (max $-40$)
- **High Severity Debt**: $-5 \text{ pts per finding}$ (max $-30$)
- **Medium Severity Debt**: $-2 \text{ pts per finding}$ (max $-20$)
- **Low Severity Debt**: $-1 \text{ pt per finding}$ (max $-10$)

**Health Grades**:
- **Healthy**: $80 \text{ to } 100$
- **Moderate**: $65 \text{ to } 79$
- **Degraded**: $45 \text{ to } 64$
- **Critical**: $< 45$

### Strict Non-Double Counting
Inventory statistics are derived mathematically from configuration declarations and verified `usageMap` entries. **"Used items" is never calculated by subtracting finding counts**, as a single item may have multiple findings (e.g. duplicate + undocumented).

---

## 10. Repository-Aware AI Assistant & RAG Engine

Layer B features a custom **Retrieval-Augmented Generation (RAG) Engine** (`src/code-intelligence/retrieval/retrievalEngine.ts`) built over the in-memory `RepositoryIndex`:

1. **Dual-Mode Query Parsing**: Distinguishes between configuration queries (e.g. *"Where is DATABASE_URL used?"*) and general source-code questions (e.g. *"How does the scanner work?"*, *"Explain the health score calculation"*).
2. **Targeted Evidence Retrieval**:
   - **Configuration Intelligence**: Canonicalizes keys (`api.timeout` $\leftrightarrow$ `API_TIMEOUT`), looks up declarations across all formats, and gathers static references with confidence ratings.
   - **General Code Intelligence (BM25 Lexical Ranking)**: Scans indexed source files, functions, classes, and imports. Tokenizes queries with stop-word filtering, term-frequency scoring, and length normalization.
   - **AST Symbol Resolution**: Locates classes, methods, and interfaces with exact definition line ranges.
   - **Documentation Grounding**: Indexes `README.md` sections for high-level architectural queries.
3. **Structured Context Construction (`PromptBuilder`)**: Compiles retrieved evidence into an evidence block with exact `file:line` citations. Informs the model if evidence is incomplete.
4. **Strict Zero-Hallucination System Prompting**: Instructs the model to rely strictly on repository evidence, distinguish facts from inference, and explicitly state when evidence is missing.
5. **Interactive Clickable Citations**: All `path/to/file:line` citations in the assistant webview are clickable. Clicking navigates to the validated workspace file and centers the cursor on the exact line.

---

## 11. Removal Impact Assessment ("What Breaks If I Delete This?")

The **Code Impact Analyzer** (`src/core/impact/impactAnalyzer.ts`) constructs **Static Dependency Evidence**:

$$\text{Configuration Declaration} \longrightarrow \text{References} \longrightarrow \text{Enclosing Function} \longrightarrow \text{Module} \longrightarrow \text{Dependent Files}$$

When opening a configuration finding, developers can click **Assess Removal Impact** to see:
- Exact declaration locations across files.
- Number of affected files and source references.
- All enclosing functions and classes that consume the setting.
- Static dependency evidence snippets.
- Documented technical blind spots (dynamic keys, external deployment manifests).

---

## 12. Safe Remediation Patching

The extension assists remediation through safe, non-destructive patch generation (`src/services/remediationService.ts`):
- **Never Edits Automatically**: Generates a unified diff preview.
- **Deletes Obsolete Keys**: Proposes deletion of dead configurations.
- **Masks Secrets**: Proposes replacing plaintext credentials with `${VAULT_KEY}` or environment variable references.
- **Inserts Documentation**: Proposes inline documentation blocks.
- **User Confirmation**: Requires explicit developer confirmation before applying any disk modifications.

---

## 13. Multi-Provider AI Architecture & Zero Secret Leakage

The AI layer (`src/ai/`) implements an extensible provider interface:

```typescript
export interface IAIProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResponse>;
}
```

### Supported Providers
1. **Google Gemini (Primary Cloud Provider)**:
   - Connects to Google's official Gemini API using the official `@google/genai` SDK.
   - Default high-performance model: `gemini-2.5-flash` (configurable via `configDebt.aiModel`).
   - Secure authentication via VS Code `SecretStorage` (`configurationDebtTracker.geminiApiKey`).
   - Zero credentials in query strings, settings files, webviews, or git.
2. **Deterministic Offline Engine**:
   - Fully autonomous, rule-grounded reasoning engine requiring zero network connectivity and zero API keys.
   - Guaranteed deterministic explanations and removal impact assessments.
3. **Local Provider**:
   - Connects to locally hosted models (Ollama, LM Studio, vLLM) via standard local endpoints (`http://localhost:11434/v1`).
4. **OpenAI-Compatible Provider**:
   - Supports self-hosted or proxy gateways conforming to the chat completions API standard.

### AI Safety & Zero Secret Leakage
Before any context is transmitted to an LLM:
- Passwords, tokens, credentials in URLs, private keys, and environment values are strictly redacted using `PromptBuilder.redactSensitiveData()`:
  `DATABASE_PASSWORD="<REDACTED>"`
  `API_KEY="<REDACTED>"`
  `mongodb://admin:<REDACTED>@cluster0.mongodb.net/prod`
- Raw secrets are never included in prompts, logs, telemetry, or error messages.
- **Cloud Consent Policy**: Developers can toggle `configDebt.aiAllowCloudContext` (default: `true`). If disabled, the extension strictly blocks any repository snippets from being transmitted to cloud endpoints, keeping analysis 100% offline or local.

---

## 14. User Interface Design (Developer Instrument)

The UI adheres strictly to **professional developer diagnostic aesthetics**:
- **Zero Generic AI Gradients**: No purple glows, glassmorphism, decorative blobs, or chatbot cards.
- **Native VS Code Tokens**: Uses `var(--vscode-...)` semantic colors and typography.
- **Dense Technical Hierarchy**: Monospace keys, paths, and line numbers.
- **Genuine Zero State**: Displays *"No scan available. Run a workspace scan."* when unanalyzed. No fake sample numbers.

### UI Surfaces
1. **Primary Sidebar**: Summary health card, severity breakdown, configuration inventory list, and fast action buttons.
2. **Main Dashboard Webview**: Interactive filters across all 12 debt categories, search bar, finding detail drawer, removal impact viewer, and AI assistant query console.
3. **Status Bar Item**: Displays current health score and one-click scan trigger.

---

## 15. CLI Commands & Extension Settings

### Core & AI Assistant Commands (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- `Configuration Debt: Open AI Assistant` — Opens the dedicated AI Assistant webview panel with conversation history, clickable citations, and live status.
- `Configuration Debt: Set Gemini API Key` — Securely saves Google Gemini API key to VS Code encrypted `SecretStorage` (never in settings or disk files).
- `Configuration Debt: Remove Gemini API Key` — Clears stored API key and resets provider status to unconfigured.
- `Configuration Debt: Test Gemini Connection` — Sends an authentic live ping to Gemini, displaying active model and round-trip latency.
- `Configuration Debt: Explain Selection with AI` — Gathers surrounding file context and explains selected code in the AI assistant.
- `Configuration Debt: Ask About Current File` — Pre-seeds assistant with the active editor file, referenced configs, and caller symbols.
- `Configuration Debt: Summarize Repository with AI` — Synthesizes architectural and configuration overview of the workspace.
- `Configuration Debt: Scan Workspace` — Runs full repository discovery, AST indexing, and debt analysis.
- `Configuration Debt: Scan Current File` — Scans the active editor document.
- `Configuration Debt: Scan Folder` — Scans selected workspace directory.
- `Configuration Debt: Watch Workspace` — Toggles debounced incremental file watcher.
- `Configuration Debt: Open Dashboard` — Opens main diagnostic dashboard.
- `Configuration Debt: Show Findings` — Displays prioritized finding list.
- `Configuration Debt: Show Cleanup Backlog` — Displays SCM cleanup backlog.
- `Configuration Debt: Explain Finding` — Explains selected finding with grounded AI.
- `Configuration Debt: Assess Removal Impact` — Evaluates deletion impact and static dependency graph for a key.
- `Configuration Debt: Rebuild Code Index` — Forces complete re-indexing.
- `Configuration Debt: Clear History` — Clears stored scan snapshots.

### Settings (`settings.json`)
```json
{
  "configDebt.aiProvider": "gemini",
  "configDebt.aiModel": "gemini-2.5-flash",
  "configDebt.aiTimeout": 25000,
  "configDebt.aiAllowCloudContext": true,
  "configDebt.aiEndpoint": "http://localhost:11434/v1",
  "configDebt.staleAgeDaysThreshold": 90,
  "configDebt.excludePatterns": ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  "configDebt.enableWatchMode": false,
  "configDebt.maxFileSize": 1048576,
  "configDebt.analysisConfidenceThreshold": 70,
  "configDebt.enableGenericFallback": true
}
```
*(Note: API keys are strictly managed via VS Code SecretStorage and are never placed in `settings.json`)*

---

## 16. Installation & Setup

### Prerequisites
- Node.js $\ge 18.0.0$
- VS Code $\ge 1.85.0$

### Build & Run
```bash
# 1. Install dependencies
npm install

# 2. Compile TypeScript
npm run compile

# 3. Run automated test suite
npm test

# 4. Run live multi-language demonstration
npm run demo
```

---

## 17. Verification & Test Matrix

The test matrix (`npm test`) verifies all system components:

```
============================================================
CONFIGURATION DEBT TRACKER - AUTOMATED TEST SUITE
============================================================

--- Running Configuration Parser Tests ---
✓ EnvParser passed
✓ YamlParser passed
✓ JsonParser passed
✓ XmlParser passed
✓ DockerParser passed
✓ KubernetesParser passed
✓ TomlParser passed
✓ PropertiesParser passed

--- Running Source Usage Analyzer Tests ---
✓ PythonAnalyzer passed
✓ JavascriptAnalyzer passed
✓ JavaAnalyzer passed
✓ GoAnalyzer passed
✓ RustAnalyzer passed
✓ CSharpAnalyzer passed
✓ ShellAnalyzer passed
✓ False Positive Suppression passed (comments strictly isolated)
✓ Dataflow & Dynamic Key resolution passed (Levels 5 & 6)
✓ Configuration Canonicalization passed

--- Running Debt Detector Tests ---
✓ Used vs Unused detection passed
✓ Duplicated configuration detection passed
✓ Hardcoded secret detection passed
✓ Stale feature flag detection passed
✓ Undocumented configuration detection passed
✓ Configuration drift detection passed
✓ Unused feature flag detection passed
✓ Test-only configuration detection passed
✓ Suspicious dynamic reference detection passed

--- Running Risk Engine Tests ---
✓ Critical risk score calculation passed (Score: 94)
✓ High risk score calculation passed (Score: 75)
✓ Medium risk score calculation passed (Score: 45)
✓ Low risk calculation passed (Score: 32)

--- Running Health Score Calculator Tests ---
✓ Clean repo health score (100) passed
✓ Deductions calculation passed (Score: 85)

--- Running Services Tests (Backlog & History) ---
✓ CleanupService status lifecycle passed
✓ HistoryService tracking and delta calculation passed

--- Running Integration Pipeline Tests ---
✓ Empty workspace test passed
✓ Malformed configuration file resilience test passed
✓ Full End-to-End Scan Pipeline test passed (Score: 68/100)

--- Running AI & Retrieval Tests ---
✓ Secret redaction passed (Zero credential exposure)
✓ Retrieval engine context extraction passed
✓ Offline grounded AI explanations & removal impact passed
✓ AI provider factory instantiation passed

============================================================
ALL TEST SUITES PASSED SUCCESSFULLY!
============================================================
```

---

## 18. Live Demonstration Guide

To demonstrate the full SCM audit flow against the included multi-language `sample-repo`:

```bash
npm run demo
```

The demonstration exercises:
1. **SCM Configuration Identification**: Discovers configuration items across `.env`, `application.yml`, `docker-compose.yml`, and `k8s/` manifests.
2. **SCM Configuration Audit**: Traces references across TypeScript, JavaScript, Python, Java, Go, Rust, C#, and Shell files.
3. **Debt & Drift Detection**: Detects value drift (`API_TIMEOUT=5000` vs `10000`), hardcoded secrets (`API_KEY`), stale feature flags (`FEATURE_LEGACY_LOGIN`), and unused keys (`OLD_API_URL`).
4. **SCM Status Accounting**: Computes the transparent health score ($24/100$) with itemized deductions.
5. **SCM Configuration Control**: Prioritizes the cleanup backlog.
6. **Removal Impact Assessment**: Evaluates static dependency evidence for `DATABASE_URL`.
7. **Repository AI Assistant**: Demonstrates grounded, zero-hallucination querying.

---

## 19. Academic SCM Defense & Defense Criteria

| Evaluation Criterion | Implementation Evidence | Academic Defense |
| :--- | :--- | :--- |
| **Configuration Identification** | `ConfigurationScanner`, `ParserRegistry` (8 formats) | Complete baseline establishment conforming to IEEE 828 SCM identification guidelines. |
| **Configuration Audit** | `SourceUsageAnalyzer`, `ReferenceResolver` (14 languages, 7 tiers) | Deterministic cross-examination of configuration assets against active code consumers. |
| **Status Accounting** | `HealthScoreCalculator`, `HistoryService` | Formal quantification of debt state and directional trend recording. |
| **Configuration Control** | `CleanupService`, `RemediationService` | Formalized change proposal lifecycle with developer confirmation and diff previews. |
| **AST / Code Intelligence** | `AstIndexer`, `NodeExtractor`, `SymbolExtractor` | Elimination of comment false positives and scope-aware dependency mapping. |
| **Risk Explainability** | Transparent 4-factor formula | Academic accountability: every score is mathematically decomposable into age, usage, impact, and sensitivity. |
| **AI Grounding & Privacy** | `RetrievalEngine`, `PromptBuilder`, `OfflineAIProvider` | Strict RAG over indexed repository, zero credential leakage, and 100% offline autonomy. |

---

## 20. Gemini AI Assistant: Complete Guide & Operations

### 20.1 Overview & Architecture
The AI Assistant in Configuration Debt Tracker turns repository understanding into an interactive developer partner. Powered by Google Gemini (using the official `@google/genai` TypeScript SDK), it answers architectural, operational, configuration, and implementation questions grounded directly in the currently active workspace.

```
Developer Question
        |
        v
Dual-Mode Retrieval (Configuration Keys + BM25 Lexical Ranking + AST Symbols)
        |
        v
Evidence Extraction (Source Snippets, Exact File:Line Numbers, Callers)
        |
        v
Strict Secret Redaction (Masks passwords, API keys, private tokens)
        |
        v
Google Gemini API (Model: gemini-2.5-flash)
        |
        v
Grounded Answer with Clickable File:Line Badges
        |
        v
VS Code Assistant Webview Panel
```

---

### 20.2 Quick Start Workflow

#### Step 1: Open Your Repository in VS Code
Open any project workspace containing source code and configuration files.

#### Step 2: Scan the Workspace
Run:
`Ctrl+Shift+P` (or `Cmd+Shift+P`) $\rightarrow$ **`Configuration Debt: Scan Workspace`**
This parses all configuration manifests, indexes source files with AST analysis, and builds the in-memory `RepositoryIndex`.

#### Step 3: Securely Configure Your Gemini API Key
Run:
`Ctrl+Shift+P` $\rightarrow$ **`Configuration Debt: Set Gemini API Key`**
- An encrypted password prompt opens.
- Paste your Google Gemini API key.
- The key is securely stored in VS Code's encrypted `SecretStorage` (`configurationDebtTracker.geminiApiKey`).
- **Security Guarantee**: The key is *never* written to `settings.json`, repository files, webviews, URL query strings, or git commits.

#### Step 4: Test the Gemini Connection
Run:
`Ctrl+Shift+P` $\rightarrow$ **`Configuration Debt: Test Gemini Connection`**
This executes a real network ping using `@google/genai`. A notification reports:
```
Gemini connected successfully.
Model: gemini-2.5-flash
Latency: 1420ms
```

#### Step 5: Open the AI Assistant Panel
Run:
`Ctrl+Shift+P` $\rightarrow$ **`Configuration Debt: Open AI Assistant`**
The dedicated Assistant Webview opens with conversation history, live provider status badge (`Gemini: Connected`), suggestions, and a prompt box.

---

### 20.3 Asking Questions About Repository Code

You can ask any technical question about your repository. The assistant retrieves exact code context before prompting Gemini:

| Question Type | Example Prompt | Retrieved Evidence |
| :--- | :--- | :--- |
| **Architecture Overview** | *"Explain the architecture of this project."* | Repository structure, README excerpts, entry points, core engines. |
| **Application Startup** | *"How does the application start and initialize?"* | Main entrypoint file, initialization routines, configuration bootstrap. |
| **Configuration Usage** | *"Where is DATABASE_URL used and what depends on it?"* | Declarations in `.env`/YAML, all 9 static callers, caller function names. |
| **Calculation & Logic** | *"How is the health score calculated?"* | `healthScoreCalculator.ts`, deduction weights, test suites. |
| **Scanner Internals** | *"Explain how the configuration scanner works."* | `configurationScanner.ts`, parser registry, file traversal logic. |
| **Bug Investigation** | *"Find the bug causing the AI assistant to return no references."* | Retrieval prompt builder, index serialization, reference mapping. |
| **Refactoring Impact** | *"What happens if I remove API_TIMEOUT?"* | Removal impact assessment, drift findings across 5 files, affected code. |
| **Selection / Line-by-Line** | Highlight code $\rightarrow$ `Configuration Debt: Explain Selection with AI` | Selected snippet, enclosing function, caller relationships. |

---

### 20.4 Context Retrieval & Interactive Clickable Citations

1. **How Retrieval Works**:
   - Queries are evaluated against `RepositoryIndex`.
   - Configuration queries perform canonical key resolution (e.g., `api.timeout` matches `API_TIMEOUT`).
   - General code queries use **BM25 lexical ranking** across indexed source files, functions, classes, and comments.
   - Only the most relevant, bounded code snippets are sent to Gemini (bounded context). Excluded paths (`node_modules`, `.git`, `dist`, binary files) are never read.
2. **Clickable Citations**:
   - Whenever Gemini or the offline engine cites a file (e.g. `src/db.ts:6`), it is rendered as a clickable badge: `📄 src/db.ts:6`.
   - Clicking the badge triggers an extension host navigation command.
   - **Path Traversal Security**: Before opening any file, the extension validates that the target path is strictly located within the workspace root. Traversal attempts (such as `../../etc/passwd`) are rejected.
   - VS Code opens the file and reveals the exact line in center view.

---

### 20.5 Secret Redaction & Privacy Safeguards

- **Automatic Redaction (`PromptBuilder.redactSensitiveData`)**:
  Before any code snippet or user prompt leaves your machine, all sensitive literals are replaced with `<REDACTED>`:
  - Plaintext passwords: `password="SuperSecret123!"` $\rightarrow$ `password="<REDACTED>"`
  - API tokens: `AIzaSy...`, `sk_live_...`, `ghp_...` $\rightarrow$ `<REDACTED>`
  - Connection strings: `postgres://user:secret@host/db` $\rightarrow$ `postgres://user:<REDACTED>@host/db`
  - Private key blocks: `-----BEGIN RSA PRIVATE KEY-----` $\rightarrow$ `<REDACTED_PRIVATE_KEY>`
- **What is transmitted to Google**:
  Only the specific, redacted code excerpts, key names, and symbols relevant to your query. Full `.env` files or unredacted files are never transmitted.
- **Cloud Context Transmission Toggle**:
  To completely block sending any source code to Google's cloud API:
  Set `"configDebt.aiAllowCloudContext": false` in VS Code Settings (`settings.json`).
  When disabled, cloud transmission is immediately halted.

---

### 20.6 Offline Mode

If you work in air-gapped environments or prefer zero external network calls:
1. Open Settings (`settings.json`).
2. Set `"configDebt.aiProvider": "offline"`.
3. The assistant will label all responses with `(Deterministic Offline Engine)` and utilize the local AST rule engine for explanations and removal impacts.

---

### 20.7 Common Errors & Remediation

| Error Message | Cause | Resolution |
| :--- | :--- | :--- |
| `Gemini API key is not configured.` | No key stored in SecretStorage. | Run `Configuration Debt: Set Gemini API Key` from Command Palette. |
| `Invalid Gemini API key.` | Provider rejected the API key (HTTP 400/403). | Check key validity in Google AI Studio and re-enter via `Set Gemini API Key`. |
| `Gemini API quota or rate limit exceeded.` | Exceeded Gemini free tier RPM/TPM quota (HTTP 429). | Wait 60 seconds before retrying or upgrade quota in Google Cloud Console. |
| `The configured Gemini model was not found.` | Model identifier is deprecated or mistyped (HTTP 404). | In VS Code Settings, set `configDebt.aiModel` to a supported model (e.g. `gemini-2.5-flash`). |
| `Gemini request timed out after 25000ms.` | Slow network or model generation delay. | Increase `configDebt.aiTimeout` in settings (e.g. `45000`) and retry. |
| `The workspace has not been indexed yet.` | Workspace opened without running a scan. | Run `Configuration Debt: Scan Workspace` or click "Scan Workspace" in the Assistant panel. |
| `Security validation failed: path is outside workspace.` | Model cited an external or traversal file path. | Protection mechanism activated. Citations are strictly restricted to your active workspace folder. |

---

### 20.8 Known Limitations of Code Retrieval

1. **Dynamic Key Resolution**:
   Keys accessed via complex runtime concatenation (e.g. `process.env[prefix + name]`) are flagged as dynamic risks by Layer A, but cannot be statically pinned to exact string names without runtime tracing.
2. **External Manifests**:
   Infrastructure manifests stored outside the open workspace (e.g. in separate deployment repos or Helm charts) are not indexed unless their folders are added to the multi-root workspace.
3. **Fresh Scanning Required**:
   When significant files are renamed or added, run `Configuration Debt: Scan Workspace` or enable `configDebt.enableWatchMode` to ensure the in-memory index reflects the newest lines.

---

### 20.9 Example Conversation Walkthrough

```text
[YOU]
Explain how DATABASE_URL is used in this repository.

[AI ASSISTANT (Google Gemini API • gemini-2.5-flash • 1480ms)]
Based on the indexed repository evidence, DATABASE_URL is a critical database connection string defined across 4 configuration manifests and consumed by 9 statically identified source locations across 8 distinct programming languages:

1. Declarations:
   - 📄 .env:2 (value: <REDACTED>)
   - 📄 application.yml:3 (key: database.url, value: <REDACTED>)
   - 📄 docker-compose.yml:9 (value: <REDACTED>)
   - 📄 k8s/deployment.yaml:13

2. Active Source Code Consumers:
   - 📄 src/db.ts:6: In createConnectionPool(), loaded via process.env.DATABASE_URL
   - 📄 src/config.ts:12: Configuration export
   - 📄 src/worker.py:4: In run_worker(), loaded via os.environ.get("DATABASE_URL")
   - 📄 src/go/worker.go:11: In WorkerProcess()
   - 📄 src/rust/config.rs:5: In load_database_configuration()
   - 📄 src/csharp/Settings.cs:10: In Settings class
   - 📄 src/ServiceApp.java:10: In ServiceApp class
   - 📄 src/shell/deploy.sh:7: Container deployment script

3. Architectural Observation:
   Values drift between local (.env) and Docker Compose. Because 8 language modules consume this setting, modifying or deleting DATABASE_URL requires coordinated refactoring across all 6 consumer services.

[YOU]
Which function calls createConnectionPool?

[AI ASSISTANT (Google Gemini API • gemini-2.5-flash • 1210ms)]
Tracing references to createConnectionPool in src/db.ts:6:
- It is imported and invoked during service startup in 📄 src/config.ts:18.
- The connection pool instance is subsequently passed to the database health check routine in 📄 src/health/database.ts:8.
```

