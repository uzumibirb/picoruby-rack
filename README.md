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
  --lang js --no-deploy
cd my-worker
```

C3 sets the package and Worker names from `my-worker` and installs the Node
dependencies. See the generated `README.md` for Ruby, Emscripten and PicoRuby
setup. Run `npm run setup:bindings` in the generated project to add the KV,
Queue, Durable Object and Access examples.

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
    --template-mode git --no-git --no-agents --lang js --no-deploy --accept-defaults
```

## Template layout

`js/` is the JavaScript template C3 copies. `scripts/setup-bindings.mjs`
inside that template adds the binding examples and records the generated files'
checksums. The gem dependency is pinned to the commit containing the plugin
and Pondro export code. Use `PICORUBY_CLOUDFLARE_TEMPLATE_GEM_PATH` to test
a local gem checkout.
