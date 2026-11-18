# PicoRuby Worker template for Cloudflare

Create a PicoRuby Rack application with Cloudflare's `create-cloudflare` CLI (C3).
The starter uses the `picoruby-cloudflare-template` gem for the Wasm build and
its Rake tasks for Wrangler.

## Create a Worker

Pass `uzumibirb/picoruby-rack` to C3 to create a project from GitHub.

```sh
npm create cloudflare@latest my-worker -- \
  --category remote-template \
  --template uzumibirb/picoruby-rack \
  --no-deploy
cd my-worker
```

C3 sets the package and Worker names from `my-worker` and installs the Node
dependencies. Continue in the generated project with the steps below.

## Local development

1. Install Git, Ruby >= 3.2 and Node.js (supported by Wrangler). On macOS, install Emscripten via Homebrew as shown below.
2. Run `bundle install`. C3 has already installed the Node dependencies. Run `npm install` after cloning this project.
3. Run `bundle exec rake doctor` to check the build prerequisites.
4. Run `npm run dev`. Wrangler's custom build also runs Rake on startup and Ruby changes.

On the first `doctor`, `build`, `dev`, `check` or `deploy` with
`PICORUBY_ROOT` unset, Rake clones the
[latest PicoRuby release](https://github.com/picoruby/picoruby/releases/latest)
and its submodules into the project's Git-ignored `picoruby/` directory.
Later runs reuse that checkout without fetching updates. To use another
checkout, set `PICORUBY_ROOT` to its path after initializing its submodules.

```sh
brew install emscripten
export PATH="$(brew --prefix emscripten)/bin:$PATH"
emcc --version
```

Emscripten 5.0.0 or later is accepted; 5.0.7 and Homebrew 6.0.9 are tested.
Newer versions are accepted but not necessarily tested. If switching from emsdk,
use a shell without `emsdk_env.sh` and unset `EMSDK`, `EM_CONFIG`, and `EM_CACHE`.

The template sets compatibility date `2026-08-22`. C3 installs Wrangler when creating the
project. Test with `npm run dev` when changing the Wrangler
version or compatibility date.

To build against a local copy of the gem, export
`PICORUBY_CLOUDFLARE_TEMPLATE_GEM_PATH=/path/to/picoruby-cloudflare-template`
before running `bundle install` and keep it set when running the build.

To use a local runtime checkout during development, set these attributes in the
`cloudflare_worker!` block in `build_config.rb`:

```ruby
conf.cloudflare_worker! do |cf|
  cf.picoruby_cloudflare_worker_wasm_mgem_dir = "/path/to/picoruby-cloudflare-worker-wasm"
  # Optional: use a local Rack checkout too.
  cf.mruby_rack_mgem_dir = "/path/to/mruby-rack"
end
```

The block receives the CrossBuild object itself and runs before build setup.
Calling without a block is also supported. Both directory attributes default to `nil`, which selects the GitHub sources
configured by the template gem. Override those refs in the same block using
`cf.picoruby_cloudflare_worker_wasm_revision` and `cf.mruby_rack_mgem_revision`.
Directory attributes take precedence over revision attributes; relative paths
are resolved against `build_config.rb`. These sources are not selected through
environment variables. The Worker source is pinned by the template gem; see its README for the current revision.

`build_config.rb` selects mrbgems and exports an ES module to `generated/worker/`.
Do not edit generated files. The generated Wasm, JS and app bytecode are one unit;
use Wrangler to bundle them, not a plain Node.js import of `src/index.js`.

`src/index.js` shows optional `rackEnv` and `afterRequest` hooks. Enable them in
the `createWorker` options to add request-scoped, JSON-compatible values to
Ruby's Rack env or inspect a snapshot after the app responds.
`rackEnv(request, env, ctx)` returns an object. `afterRequest(request, env, ctx,
rackEnv, response)` may return a replacement `Response` or `undefined` to keep
the original response. Exceptions are logged by the generated Worker handler.
These hooks require a Worker runtime with `handleRequestWithOptions` and ABI 8.

## Ruby APIs

The template's default Worker runtime is `0.10.0`. Ruby code can make
buffered HTTP(S) calls with `Cloudflare.fetch(url, method:, headers:, body:)`.
The returned `Cloudflare::FetchResponse` exposes `status`, `headers`, and `body`.

For secure randomness, use `SecureRandom.random_bytes`,
`SecureRandom.random_number`, or `SecureRandom.hex`. The runtime uses Web
Crypto for these APIs and for AES-GCM encryption.

```ruby
key = SecureRandom.random_bytes(32)
iv, encrypted = Crypto.encrypt(:AES_GCM, key, plaintext)
decrypted = Crypto.decrypt(:AES_GCM, key, iv, encrypted)
```

See the [Worker runtime docs](https://github.com/udzura/picoruby-cloudflare-worker-wasm/tree/master/docs)
and [examples](https://github.com/udzura/picoruby-cloudflare-worker-wasm/tree/master/examples)
for signatures, limits, and complete applications. Check each example's
runtime revision when using APIs introduced after `0.10.0`.

### Resource bindings

Configure resources in `wrangler.jsonc`. The build regenerates `bindings.js`,
and the Rack environment exposes the resulting bindings through
`env["cloudflare.env"]`, a `Cloudflare::Environment` proxy.

| Binding | Wrangler setting | Ruby class |
| --- | --- | --- |
| Workers KV | `kv_namespaces` | `Cloudflare::KV` |
| Queues producer | `queues.producers` | `Cloudflare::Queue` |
| Durable Objects | `durable_objects.bindings` | `Cloudflare::DurableObject` |
| D1 | `d1_databases` | `Cloudflare::D1` |
| R2 | `r2_buckets` | `Cloudflare::R2` |
| Workers AI | `ai` | `Cloudflare::AI` |
| Vectorize | `vectorize` | `Cloudflare::Vectorize` |

For example, `env["cloudflare.env"].CACHE_KV` and
`Cloudflare::KV.from_env(env, "CACHE_KV")` resolve the same KV binding.
`Cloudflare::DurableObject#put` accepts a POJO, Hash, Array, or an object
responding to `to_pojo`. Ruby `ENV` exposes variables and secrets as strings,
including serialized JSON for JSON variables.

Run `npm run setup:bindings` or `bundle exec rake setup:bindings` to add
`/kv`, `/queue`, `/durable-object` and `/access` to the starter app,
along with the example Wrangler configuration.
The command preserves unrelated Wrangler settings and checks for conflicts
before writing. The `.picoruby-cloudflare-template.json` manifest tracks
`app.rb` and `wrangler.jsonc` for subsequent runs.

### Cloudflare Access

For `/access`, set `CF_ACCESS_TEAM` to your team name (not its URL) in Wrangler vars
or .dev.vars, and send a `CF_Authorization` cookie issued by Access.
`Rack::Cloudflare::Access.new(app, team: "my-team")` is Rack middleware.
Omit `team:` to read `CF_ACCESS_TEAM` from the Worker environment.
Before calling the app, it stores the decoded identity in `env["cloudflare.identity"]`,
with `email`, `user_uuid` and `raw_data`. The generated example wraps only `/access`.
The helper `Cloudflare::Access.get_identity(token, team: "my-team")` calls
`Cloudflare.fetch` from Ruby. Missing/invalid configuration returns 503; missing/invalid
cookies and Access 401/403 responses return 401; upstream/protocol failures return 502.
Failures do not call the downstream app. This does not locally validate JWT signatures or audience.
Protect your application with Access and follow Cloudflare's token validation guidance.
The default Worker and mruby-rack revisions include Access, cookie parsing and
middleware keyword forwarding. No local mrbgem checkout overrides are required.

Keep secrets in `.dev.vars` locally and use `npx wrangler secret put NAME` remotely.
Never put them in `app.rb`, `build_config.rb` or committed config files.

For named environments, set `CLOUDFLARE_ENV=staging npm run dev` (or `npm run deploy`)
so Wrangler and the binding registry select the same environment. Do not select an
environment using only `--env`; custom build processes need `CLOUDFLARE_ENV` too.

Commit `Gemfile.lock` and `package-lock.json`. Deploy explicitly with `npm run deploy`.

## Optional Pondro objects

Add the `picoruby-cloudflare-pondro` mgem and
`pondro: { binding: "PONDRO", classes: ["Counter"] }` to `worker_export`.
Use a Worker runtime with ABI 9 and register the same class/binding in Ruby.
The template copies the host module and generates DO/plugin wiring without
Pondro-specific edits to `src/index.js`.

The source Wrangler config stays intact. The generated
`.picoruby-cloudflare-wrangler.jsonc` adds the Pondro binding and SQLite migration,
and points to a wrapper that retains the original entry's exports and handlers.
`npm run dev`, `npm run check` and `npm run deploy` build first and use this config.
For named environments, keep using `CLOUDFLARE_ENV` so export and Wrangler agree.
Keep applied migration history in source configuration when changing an already
deployed DO; the template does not infer deletion/rename migrations.

## Test from a local checkout

From the root of this repository, run the following against the current Git commit.
The URL rewrite applies only to this command.

```sh
GIT_CONFIG_COUNT=1 \
  GIT_CONFIG_KEY_0="url.file://$(pwd -P).insteadOf" \
  GIT_CONFIG_VALUE_0=ssh://git@github.com/uzumibirb/picoruby-rack \
  npm create cloudflare@latest /tmp/my-pico-worker -- \
    --category remote-template \
    --template uzumibirb/picoruby-rack \
    --template-mode git --no-git --no-agents --no-deploy --accept-defaults
```

## Template layout

C3 copies the project from the repository root. `scripts/setup-bindings.mjs`
adds the binding examples and records the generated files'
checksums. The gem dependency is pinned to the commit containing the plugin
and Pondro export code. Use `PICORUBY_CLOUDFLARE_TEMPLATE_GEM_PATH` to test
a local gem checkout.
