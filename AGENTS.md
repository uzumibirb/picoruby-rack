# PicoRuby Rack Worker

- Define the Ruby Rack app in `app.rb` and register it with
  `Rackup::Handler::CloudflareWorker.run(app)`. The app receives the Rack
  `env` and returns `[status, headers, body]`.
- Add external mrbgems with `conf.gem` inside the `MRuby::CrossBuild.new("worker")`
  block in `build_config.rb`. For a gem in the project, use
  `conf.gem gemdir: File.join(__dir__, "vendor", "my-gem")`.
- Define Cloudflare resource bindings in `wrangler.jsonc` and access them
  from Ruby through `env["cloudflare.env"]` in the Rack app. For a KV binding
  named `CACHE_KV`, use `env["cloudflare.env"].CACHE_KV.get("key")`.
- Run `npm run setup:bindings` or `bundle exec rake setup:bindings` to add
  the KV, Queue, Durable Object and Access examples to `app.rb` and
  `wrangler.jsonc`.

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
