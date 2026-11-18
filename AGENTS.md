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
