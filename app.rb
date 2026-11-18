app = lambda do |env|
  begin
    # Run npm run setup:bindings to add Cloudflare binding examples.
    # env["cloudflare.env"].CACHE_KV
    message = ENV["GREETING"] || "Hello from PicoRuby on Cloudflare!"
    [200, { "content-type" => "text/plain; charset=utf-8" }, [message + "\n"]]
  rescue => e
    [500, { "content-type" => "text/plain; charset=utf-8" }, ["Internal Server Error:\n\t#{e.message}\n"]]
  end
end

Rackup::Handler::CloudflareWorker.run(app)
