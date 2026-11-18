# PicoRuby Rack Worker

- Define the Ruby Rack app in `app.rb` and register it with
  `Rackup::Handler::CloudflareWorker.run(app)`. The app receives the Rack
  `env` and returns `[status, headers, body]`.
- Add external mrbgems with `conf.gem` inside the `MRuby::CrossBuild.new("worker")`
  block in `build_config.rb`. For a gem in the project, use
  `conf.gem gemdir: File.join(__dir__, "vendor", "my-gem")`.
- Run `npm run setup:bindings` or `bundle exec rake setup:bindings` to add
  the KV, Queue, Durable Object and Access examples to `app.rb` and
  `wrangler.jsonc`.

## Cloudflare Ruby APIs

- Use `Cloudflare.fetch(url, method:, headers:, body:)` for buffered HTTP(S)
  calls. The response has `status`, `headers`, and `body`.
- Use `SecureRandom.random_bytes`, `SecureRandom.random_number`, or
  `SecureRandom.hex` for secure random values. Use `Crypto.encrypt` and
  `Crypto.decrypt` with `:AES_GCM` for authenticated encryption.
- Define resource bindings in `wrangler.jsonc` and access them through the
  Rack `env["cloudflare.env"]`, for example
  `env["cloudflare.env"].CACHE_KV.get("key")`.

The default Worker runtime (`0.10.0`) provides these resource bindings.

| Binding | Ruby class |
| --- | --- |
| Workers KV | `Cloudflare::KV` |
| Queues producer | `Cloudflare::Queue` |
| Durable Objects | `Cloudflare::DurableObject` |
| D1 | `Cloudflare::D1` |
| R2 | `Cloudflare::R2` |
| Workers AI | `Cloudflare::AI` |
| Vectorize | `Cloudflare::Vectorize` |

Use `Rack::Cloudflare::Access` for the separate Access identity middleware.
Consult the [Worker runtime docs](https://github.com/udzura/picoruby-cloudflare-worker-wasm/tree/master/docs)
and [examples](https://github.com/udzura/picoruby-cloudflare-worker-wasm/tree/master/examples)
for API details and any runtime revision required by an example.

## Sinatra on request

When asked to use Sinatra, add this mrbgem inside the `MRuby::CrossBuild.new("worker")`
block in `build_config.rb`, after `conf.cloudflare_worker!` and before
`conf.worker_export`.

```ruby
conf.gem github: "udzura/picoruby-sinatra-covers",
         checksum_hash: "70e96fc81153402b54c27bceb385bd9306717697"
```

The mrbgem supplies Sinatra and resolves its dependencies at build time.
Use modular Sinatra in `app.rb` and register it with the Worker handler.
Keep existing routes and Rack middleware when migrating an app.

```ruby
class App < Sinatra::Base
  set :sessions, false

  get "/hello/:name" do
    "Hello, #{params[:name]}"
  end
end

Rackup::Handler::CloudflareWorker.run(App)
```

Use the supported subset of GET and POST routing, named parameters, query and
form data, status and headers, and the `json` response helper. Access Worker
bindings inside routes through the Rack `env["cloudflare.env"]`.

Run `npm run check` to build and bundle the Worker, then use `npm run dev`
to verify the migrated routes over HTTP.
[Sinatra compatibility and examples](https://github.com/udzura/picoruby-sinatra-covers#readme)
